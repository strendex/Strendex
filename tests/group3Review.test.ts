// Group 3 — the Athlete Review re-scores against the dataset the SAVED result
// was scored against, never whichever dataset is active now.
//
// The route test drives the real POST handler with global fetch replaced by a
// fake that answers Supabase and OpenAI. No network request is made and no
// OpenAI call is paid for.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RECALCULATE_MESSAGE,
  validateBenchmark,
} from "../lib/athleteReview/benchmarkValidation";
import { QUESTIONS } from "../lib/athleteReview/questions";
import { describeTargets } from "../lib/athleteReview/targets";
import { loadSnapshot, saveSnapshot, snapshotHasBenchmark } from "../lib/athleteReview/snapshot";
import type { AssessmentAnswers } from "../lib/athleteReview/types";
import { computeScore } from "../lib/scoring";
import { SCORE_VERSION, ScoringError, datasetConfidence } from "../lib/scoring/core";
import { computeDatasetHash } from "../lib/server/hashing";
import { createSupabaseScoreRepository } from "../lib/server/scoreRepository";

const DATASET_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"; // saved result's (now retired)
const DATASET_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"; // active now

function population(center: number, spread: number): number[] {
  return Array.from({ length: 60 }, (_, i) => Math.max(0, Math.min(100, center + ((i % 21) - 10) * spread)));
}

function datasetRow(id: string, strength: number[], endurance: number[], lifecycle: string) {
  return {
    id,
    label: `dataset ${id.slice(0, 1)}`,
    kind: "legacy_mixed_provisional",
    score_version: SCORE_VERSION,
    strength_reference: strength,
    endurance_reference: endurance,
    eligible_sample_size: strength.length,
    confidence: datasetConfidence(strength.length),
    lifecycle,
    dataset_hash: computeDatasetHash({
      scoreVersion: SCORE_VERSION,
      datasetKind: "legacy_mixed_provisional",
      eligibleSampleSize: strength.length,
      strengthReference: strength,
      enduranceReference: endurance,
    }),
  };
}

// Deliberately different populations, so A and B give different percentiles.
const ROW_A = datasetRow(DATASET_A, population(40, 3), population(40, 3), "retired");
const ROW_B = datasetRow(DATASET_B, population(75, 2), population(75, 2), "active");

// --- request validation ------------------------------------------------------------

function benchmark(extra: Record<string, unknown> = {}) {
  return {
    bodyweight_kg: 90,
    bench_kg: 110,
    squat_kg: 150,
    deadlift_kg: 190,
    endurance_seconds: 6900,
    // The run as entered: a 1:55:00 half converts to exactly 6900 s.
    run_distance: "half",
    run_seconds: 6900,
    unit_system: "kg",
    dataset_version_id: DATASET_A,
    score_version: SCORE_VERSION,
    ...extra,
  };
}

describe("review request must name its saved benchmark", () => {
  it("accepts and returns the dataset and score version", () => {
    const r = validateBenchmark(benchmark({ dataset_version_id: DATASET_A.toUpperCase() }));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.benchmark.datasetVersionId, DATASET_A);
      assert.equal(r.benchmark.scoreVersion, SCORE_VERSION);
    }
  });

  for (const [label, extra] of [
    ["missing dataset id", { dataset_version_id: undefined }],
    ["null dataset id", { dataset_version_id: null }],
    ["malformed dataset id", { dataset_version_id: "not-a-uuid" }],
    ["numeric dataset id", { dataset_version_id: 42 }],
    ["missing score version", { score_version: undefined }],
    ["empty score version", { score_version: "" }],
  ] as const) {
    it(`asks to recalculate on a ${label}`, () => {
      const body = benchmark(extra);
      for (const [k, v] of Object.entries(body)) if (v === undefined) delete (body as Record<string, unknown>)[k];
      const r = validateBenchmark(body);
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.recalculate, true);
        assert.equal(r.error, RECALCULATE_MESSAGE);
      }
    });
  }
});

// --- snapshot -------------------------------------------------------------------------

describe("the stored snapshot carries the benchmark", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  const inputs = {
    bodyweightKg: 90, benchKg: 110, squatKg: 150, deadliftKg: 190, enduranceSeconds: 6900,
    runDistance: "5k", runTimeText: "25:00", runSeconds: 1500, unitSystem: "kg" as const,
  };
  const display = {
    hybridScore: 50, strengthPercentile: 50, endurancePercentile: 50, strengthIndex: 66.9,
    enduranceIndex: 59.1, tier: "INTERMEDIATE", archetype: "BALANCED HYBRID",
    rank: null, totalAthletes: null, betterThanPercent: null,
  };

  it("round-trips the dataset and score version", () => {
    saveSnapshot({ inputs, display, benchmark: { datasetVersionId: DATASET_A, scoreVersion: SCORE_VERSION } });
    const snap = loadSnapshot();
    assert.deepEqual(snap?.benchmark, { datasetVersionId: DATASET_A, scoreVersion: SCORE_VERSION });
    assert.equal(snapshotHasBenchmark(snap!), true);
  });

  it("a pre-Group-3 snapshot loads without one, and is flagged for recalculation", () => {
    store.set("strendex_ar_snapshot_v1", JSON.stringify({ v: 1, savedAt: Date.now(), inputs, display }));
    const snap = loadSnapshot();
    assert.ok(snap);
    assert.deepEqual(snap.benchmark, { datasetVersionId: null, scoreVersion: null });
    assert.equal(snapshotHasBenchmark(snap), false);
  });
});

// --- repository: dataset by id --------------------------------------------------------

describe("loading a specific frozen dataset version", () => {
  function fake(rows: Record<string, unknown>[]) {
    const calls: Array<[string, unknown[]]> = [];
    let idFilter: unknown = null;
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "limit", "maybeSingle"]) {
      builder[m] = (...args: unknown[]) => {
        calls.push([m, args]);
        if (m === "eq" && args[0] === "id") idFilter = args[1];
        return builder;
      };
    }
    builder.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows.find((r) => r.id === idFilter) ?? null, error: null }).then(ok);
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, calls };
  }

  it("returns the saved result's RETIRED dataset even though another is active", async () => {
    const { client, calls } = fake([ROW_A, ROW_B]);
    const ds = await createSupabaseScoreRepository(client).loadDatasetVersion(DATASET_A);
    assert.equal(ds?.datasetVersionId, DATASET_A);
    assert.deepEqual(ds?.strengthReference, ROW_A.strength_reference);
    assert.deepEqual(calls.filter(([m]) => m === "eq").map(([, a]) => a), [["id", DATASET_A], ["frozen", true]]);
    assert.deepEqual(calls.find(([m]) => m === "in")?.[1], ["lifecycle", ["active", "retired"]]);
  });

  it("returns null for an unknown id, and never queries for a non-UUID", async () => {
    const unknown = fake([ROW_B]);
    assert.equal(await createSupabaseScoreRepository(unknown.client).loadDatasetVersion(DATASET_A), null);
    const bad = fake([ROW_A]);
    assert.equal(await createSupabaseScoreRepository(bad.client).loadDatasetVersion("'; drop"), null);
    assert.equal(bad.calls.length, 0);
  });

  it("refuses a dataset whose content no longer matches its hash", async () => {
    const tampered = { ...ROW_A, strength_reference: [...ROW_A.strength_reference.slice(1), 1] };
    await assert.rejects(
      () => createSupabaseScoreRepository(fake([tampered]).client).loadDatasetVersion(DATASET_A),
      (e: unknown) => e instanceof ScoringError && e.code === "DATASET_CORRUPT",
    );
  });
});

// --- the route, end to end, with fetch replaced ---------------------------------------

function validAnswers(): Partial<AssessmentAnswers> {
  const out: Record<string, unknown> = {};
  for (const q of QUESTIONS) {
    if (q.showIf && !q.showIf(out as Partial<AssessmentAnswers>)) continue;
    if (!q.required) continue;
    if (q.kind === "options") {
      const excluded = q.excludeValue?.(out as Partial<AssessmentAnswers>);
      out[q.id] = q.options!.find((o) => o.value !== excluded)!.value;
    } else if (q.kind === "count" || q.kind === "number") {
      out[q.id] = q.min ?? 1;
    } else {
      out[q.id] = "Test answer";
    }
  }
  return out as Partial<AssessmentAnswers>;
}

const REPORT = {
  headline: "Headline",
  athleteSummary: "Summary",
  profileInterpretation: "Interpretation",
  strengths: [1, 2, 3].map((i) => ({ title: `S${i}`, explanation: "e", evidence: "v" })),
  limiters: [1, 2, 3].map((i) => ({ title: `L${i}`, impact: "medium", explanation: "e", evidence: "v" })),
  highestLeverageMove: { title: "t", why: "w", whatToDo: "d", whatToMaintain: "m", deprioritize: "p" },
  priorities: [1, 2, 3].map((priority) => ({ priority, action: "a", reason: "r" })),
  focusPlan: {
    durationWeeks: 8, strengthFocus: "s", enduranceFocus: "e", recoveryFocus: "r",
    // validAnswers() picks the minimum of every count: 1 day available.
    weeklyStructure: ["d1"],
  },
  retest: { recommendedWeeks: 8, metricsToRetest: ["5K"], successSignal: "faster" },
  confidenceNote: "Self-reported inputs.",
};

type Seen = { url: string; method: string; body: string };

function installFakeFetch(datasets: Record<string, unknown>[]) {
  const seen: Seen[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = typeof init?.body === "string" ? init.body : "";
    seen.push({ url, method, body });
    const json = (v: unknown, status = 200) =>
      new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

    if (url.includes("/rest/v1/rpc/ai_rl_hit")) return json(1);
    if (url.includes("/rest/v1/scoring_dataset_versions")) {
      const u = new URL(url);
      const id = u.searchParams.get("id")?.replace(/^eq\./, "");
      const lifecycle = u.searchParams.get("lifecycle");
      return json(
        datasets.filter(
          (d) =>
            (!id || d.id === id) &&
            (!lifecycle || lifecycle.includes(String(d.lifecycle)) || lifecycle === `eq.${d.lifecycle}`),
        ),
      );
    }
    if (url.startsWith("https://api.openai.com/")) {
      return json({
        id: "resp_test", object: "response", status: "completed", model: "test",
        output: [{ type: "message", id: "msg", role: "assistant", status: "completed",
          content: [{ type: "output_text", text: JSON.stringify(REPORT), annotations: [] }] }],
      });
    }
    throw new Error(`unexpected network call in test: ${method} ${url}`);
  }) as typeof fetch;
  return { seen, restore: () => void (globalThis.fetch = original) };
}

describe("POST /api/athlete-review scores against the saved dataset", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
    process.env.OPENAI_API_KEY = "stub-openai";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  async function call(bench: Record<string, unknown>, datasets = [ROW_A, ROW_B]) {
    const { POST } = await import("../app/api/athlete-review/route");
    const fake = installFakeFetch(datasets);
    try {
      const res = await POST(
        new Request("http://localhost/api/athlete-review", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ benchmark: bench, answers: validAnswers() }),
        }),
      );
      return { res, body: await res.json(), seen: fake.seen };
    } finally {
      fake.restore();
    }
  }

  it("saved dataset A is used although B is active — percentiles match A, not B", async () => {
    const { res, body, seen } = await call(benchmark());
    assert.equal(res.status, 200, JSON.stringify(body));

    const input = { bodyweightKg: 90, benchKg: 110, squatKg: 150, deadliftKg: 190, enduranceSeconds: 6900 };
    const onA = computeScore(input, { strengthScores: ROW_A.strength_reference, enduranceScores: ROW_A.endurance_reference });
    const onB = computeScore(input, { strengthScores: ROW_B.strength_reference, enduranceScores: ROW_B.endurance_reference });
    assert.notEqual(onA.hq, onB.hq, "fixture: the two datasets must disagree");

    assert.equal(body.computed.hq, onA.hq);
    assert.equal(body.computed.strengthPercentile, onA.strengthPercentile);
    assert.equal(body.computed.endurancePercentile, onA.endurancePercentile);
    assert.equal(body.meta.datasetVersionId, DATASET_A);
    assert.equal(body.meta.scoreVersion, SCORE_VERSION);

    const datasetCalls = seen.filter((s) => s.url.includes("scoring_dataset_versions"));
    assert.equal(datasetCalls.length, 1);
    assert.match(datasetCalls[0].url, new RegExp(`id=eq.${DATASET_A}`));
    assert.doesNotMatch(datasetCalls[0].url, /lifecycle=eq\.active/, "never looks up the active dataset");
    assert.equal(seen.filter((s) => s.url.startsWith("https://api.openai.com/")).length, 1, "one mocked OpenAI call");

    // The report's diagnosis is built on the server from the same score and
    // scenarios, and the model is handed exactly those findings.
    assert.equal(body.diagnosis.hybridScore, onA.hq);
    assert.equal(body.diagnosis.strengthPercentile, onA.strengthPercentile);
    const primary = body.scenarios.find((s: { isPrimary: boolean }) => s.isPrimary);
    assert.equal(body.diagnosis.bestFit?.id ?? null, primary?.projected ? primary.id : null);
    const openaiBody = JSON.parse(seen.find((s) => s.url.startsWith("https://api.openai.com/"))!.body);
    const userMessage = openaiBody.input.find((m: { role: string }) => m.role === "user").content as string;
    const data = JSON.parse(userMessage.replace(/^DATA:\n/, ""));
    // The model gets the best fit's numbers and its targets in the athlete's
    // own run and units — not the internal change description.
    for (const k of ["id", "projectedHybridScore", "projectedGain", "projectedTier", "horizonWeeks"]) {
      assert.deepEqual(data.diagnosis.bestFit[k], body.diagnosis.bestFit[k], k);
    }
    assert.deepEqual(data.diagnosis.bestFit.performanceTargets, describeTargets(body.diagnosis.bestFit.targets));
    assert.equal("description" in data.diagnosis.bestFit, false);
    assert.deepEqual(data.diagnosis.nextTier, body.diagnosis.nextTier);
    assert.doesNotMatch(userMessage, /HalfMarathonEquivalent|canonical|enduranceIndex|strengthIndex/i);
  });

  for (const [label, bench, datasets] of [
    ["no dataset id", (() => { const b = benchmark(); delete (b as Record<string, unknown>).dataset_version_id; return b; })(), [ROW_A, ROW_B]],
    ["a malformed dataset id", benchmark({ dataset_version_id: "nope" }), [ROW_A, ROW_B]],
    ["an unknown dataset id", benchmark({ dataset_version_id: "cccccccc-3333-4333-8333-cccccccccccc" }), [ROW_A, ROW_B]],
    ["another score version", benchmark({ score_version: "1.0.0" }), [ROW_A, ROW_B]],
  ] as const) {
    it(`${label} → 409 recalculate, no fallback to the active dataset, no OpenAI call`, async () => {
      const { res, body, seen } = await call(bench, [...datasets]);
      assert.equal(res.status, 409);
      assert.equal(body.code, "RECALCULATE_REQUIRED");
      assert.equal(body.error, RECALCULATE_MESSAGE);
      assert.ok(!seen.some((s) => /lifecycle=eq\.active/.test(s.url)), "must not fall back to the active dataset");
      assert.ok(!seen.some((s) => s.url.startsWith("https://api.openai.com/")), "must not call OpenAI");
    });
  }
});
