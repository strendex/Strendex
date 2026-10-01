// Group 4 — global daily Athlete Review attempt cap, single attempt, and
// allow-list logging. The real POST handler runs with global fetch replaced:
// Supabase and OpenAI are fakes. No network, no paid call.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_REVIEW_DAILY_CAP,
  REVIEW_CAP_KEY,
  parseReviewDailyCap,
  reserveReviewAttempt,
  utcDayBucket,
} from "../lib/server/reviewCap";
import { QUESTIONS } from "../lib/athleteReview/questions";
import type { AssessmentAnswers } from "../lib/athleteReview/types";
import { SCORE_VERSION, datasetConfidence } from "../lib/scoring/core";
import { computeDatasetHash } from "../lib/server/hashing";

// --- configuration ------------------------------------------------------------------

describe("ATHLETE_REVIEW_DAILY_CAP parsing", () => {
  it("defaults to 50 when absent", () => {
    assert.equal(DEFAULT_REVIEW_DAILY_CAP, 50);
    assert.deepEqual(parseReviewDailyCap(undefined), { enabled: true, cap: 50 });
  });
  it("accepts a plain positive integer", () => {
    assert.deepEqual(parseReviewDailyCap("1"), { enabled: true, cap: 1 });
    assert.deepEqual(parseReviewDailyCap("250"), { enabled: true, cap: 250 });
    assert.deepEqual(parseReviewDailyCap(" 30 "), { enabled: true, cap: 30 });
  });
  it("zero disables generation", () => {
    assert.deepEqual(parseReviewDailyCap("0"), { enabled: false, reason: "disabled" });
  });
  for (const bad of ["", "   ", "-1", "-0", "1.5", "2.0", "abc", "50abc", "1e3", "0x10", "NaN", "Infinity", "+5", "99999999999999999999"]) {
    it(`fails closed on ${JSON.stringify(bad)}`, () => {
      assert.deepEqual(parseReviewDailyCap(bad), { enabled: false, reason: "invalid" });
    });
  }
});

describe("UTC-day bucket", () => {
  it("changes exactly at UTC midnight and nowhere else", () => {
    const before = Date.parse("2026-09-29T23:59:59.999Z");
    const after = Date.parse("2026-09-30T00:00:00.000Z");
    assert.equal(utcDayBucket(before) + 1, utcDayBucket(after));
    assert.equal(utcDayBucket(Date.parse("2026-09-29T00:00:00Z")), utcDayBucket(before));
  });
});

describe("the cap counter key cannot collide with per-IP counters", () => {
  it("no per-IP key, for any IP string, equals the cap key", () => {
    const ips = ["global", "cap:global", "-cap:global", "review-cap:global", "unknown", "203.0.113.7", "::1", "", ":"];
    for (const ip of ips) {
      for (const scope of ["review", "rank", "submit", "score"]) {
        assert.notEqual(`${scope}:${ip}`, REVIEW_CAP_KEY, `${scope}:${ip}`);
      }
    }
    // Every per-IP key starts with "<scope>:"; the cap key starts with "review-cap:".
    assert.ok(REVIEW_CAP_KEY.startsWith("review-cap:"));
  });
  it("the per-IP code paths build keys only as <scope>:<ip>", () => {
    const route = readFileSync(new URL("../app/api/athlete-review/route.ts", import.meta.url), "utf8");
    const rl = readFileSync(new URL("../lib/server/rateLimit.ts", import.meta.url), "utf8");
    assert.match(route, /p_ip: `review:\$\{ip\}`/);
    assert.match(rl, /type RateLimitScope = "rank" \| "submit" \| "score" \| "review"/);
  });
});

// --- reservation --------------------------------------------------------------------

function rpcClient(respond: (args: Record<string, unknown>) => unknown) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return respond(args);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("reserveReviewAttempt", () => {
  const NOW = Date.parse("2026-09-29T15:00:00Z");

  it("increments the shared UTC-day counter under the cap key", async () => {
    const { client, calls } = rpcClient(() => ({ data: 1, error: null }));
    assert.deepEqual(await reserveReviewAttempt(client, 50, NOW), { ok: true, used: 1 });
    assert.deepEqual(calls, [{ name: "ai_rl_hit", args: { p_ip: REVIEW_CAP_KEY, p_bucket: "day", p_bucket_id: utcDayBucket(NOW) } }]);
  });

  it("allows exactly up to the cap, refuses one over", async () => {
    for (const [used, ok] of [[49, true], [50, true], [51, false], [1000, false]] as const) {
      const r = await reserveReviewAttempt(rpcClient(() => ({ data: used, error: null })).client, 50, NOW);
      assert.equal(r.ok, ok, `used ${used}`);
      if (!r.ok) assert.equal(r.reason, "cap_reached");
    }
  });

  for (const [label, respond] of [
    ["an RPC error", () => ({ data: null, error: { message: "boom" } })],
    ["a thrown error", () => { throw new Error("network"); }],
    ["null", () => ({ data: null, error: null })],
    ["zero", () => ({ data: 0, error: null })],
    ["a negative number", () => ({ data: -3, error: null })],
    ["a fraction", () => ({ data: 1.5, error: null })],
    ["NaN", () => ({ data: Number.NaN, error: null })],
    ["a non-numeric string", () => ({ data: "lots", error: null })],
    ["an object", () => ({ data: { count: 1 }, error: null })],
  ] as const) {
    it(`fails closed on ${label}`, async () => {
      const r = await reserveReviewAttempt(rpcClient(respond as (a: Record<string, unknown>) => unknown).client, 50, NOW);
      assert.deepEqual(r, { ok: false, reason: "counter_failed" });
    });
  }

  it("accepts the numeric-string form PostgREST may return", async () => {
    assert.deepEqual(await reserveReviewAttempt(rpcClient(() => ({ data: "7", error: null })).client, 50, NOW), { ok: true, used: 7 });
  });
});

// --- the route, end to end, fetch replaced -------------------------------------------

const DATASET = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const REF = Array.from({ length: 60 }, (_, i) => Math.max(0, Math.min(100, 40 + ((i % 21) - 10) * 3)));
const DATASET_ROW = {
  id: DATASET, label: "g4", kind: "legacy_mixed_provisional", score_version: SCORE_VERSION,
  strength_reference: REF, endurance_reference: REF, eligible_sample_size: REF.length,
  confidence: datasetConfidence(REF.length), lifecycle: "active",
  dataset_hash: computeDatasetHash({
    scoreVersion: SCORE_VERSION, datasetKind: "legacy_mixed_provisional", eligibleSampleSize: REF.length,
    strengthReference: REF, enduranceReference: REF,
  }),
};

function validAnswers(): Partial<AssessmentAnswers> {
  const out: Record<string, unknown> = {};
  for (const q of QUESTIONS) {
    if (q.showIf && !q.showIf(out as Partial<AssessmentAnswers>)) continue;
    if (!q.required) continue;
    if (q.kind === "options") {
      const excluded = q.excludeValue?.(out as Partial<AssessmentAnswers>);
      out[q.id] = q.options!.find((o) => o.value !== excluded)!.value;
    } else if (q.kind === "count" || q.kind === "number") out[q.id] = q.min ?? 1;
    else out[q.id] = "Test answer";
  }
  return out as Partial<AssessmentAnswers>;
}

const REPORT = {
  headline: "Headline", athleteSummary: "Summary", profileInterpretation: "Interpretation",
  strengths: [1, 2, 3].map((i) => ({ title: `S${i}`, explanation: "e", evidence: "v" })),
  limiters: [1, 2, 3].map((i) => ({ title: `L${i}`, impact: "medium", explanation: "e", evidence: "v" })),
  highestLeverageMove: { title: "t", why: "w", whatToDo: "d", whatToMaintain: "m", deprioritize: "p" },
  priorities: [1, 2, 3].map((priority) => ({ priority, action: "a", reason: "r" })),
  focusPlan: { durationWeeks: 8, strengthFocus: "s", enduranceFocus: "e", recoveryFocus: "r", weeklyStructure: ["1"] },
  retest: { recommendedWeeks: 8, metricsToRetest: ["5K"], successSignal: "faster" },
  confidenceNote: "Self-reported.",
};

type OpenAIMode = "ok" | "http500" | "network" | "timeout" | "abort";
type CapMode = "count" | "error" | "garbage";

/** A fake backend. Counters increment synchronously on receipt, like a single SQL statement. */
function fakeBackend(opts: { capStart?: number; capMode?: CapMode; openai?: OpenAIMode; delayMs?: () => number } = {}) {
  const counters = new Map<string, number>();
  if (opts.capStart) counters.set(`${REVIEW_CAP_KEY}|day`, opts.capStart);
  const state = { openaiCalls: 0, capHits: 0, perIpHits: 0, datasetReads: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/rpc/ai_rl_hit")) {
      const args = JSON.parse(String(init?.body));
      const k = `${args.p_ip}|${args.p_bucket}`;
      const isCap = args.p_ip === REVIEW_CAP_KEY;
      if (isCap) state.capHits++; else state.perIpHits++;
      if (isCap && opts.capMode === "error") return json({ message: "boom" }, 500);
      if (isCap && opts.capMode === "garbage") return json("lots");
      const n = (counters.get(k) ?? 0) + 1; // atomic: no await between read and write
      counters.set(k, n);
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs!()));
      return json(n);
    }
    if (url.includes("/rest/v1/scoring_dataset_versions")) { state.datasetReads++; return json([DATASET_ROW]); }
    if (url.startsWith("https://api.openai.com/")) {
      state.openaiCalls++;
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs!()));
      switch (opts.openai ?? "ok") {
        case "http500": return json({ error: { message: "upstream exploded with secret-ish detail" } }, 500);
        case "network": throw new TypeError("fetch failed: connect ECONNREFUSED");
        case "timeout": throw new DOMException("The operation timed out.", "TimeoutError");
        case "abort": throw new DOMException("This operation was aborted", "AbortError");
        default:
          return json({ id: "resp", object: "response", status: "completed", model: "test",
            output: [{ type: "message", id: "m", role: "assistant", status: "completed",
              content: [{ type: "output_text", text: JSON.stringify(REPORT), annotations: [] }] }] });
      }
    }
    throw new Error(`unexpected network call in test: ${url}`);
  }) as typeof fetch;
  return { state, restore: () => void (globalThis.fetch = original) };
}

function benchmark() {
  return { bodyweight_kg: 90, bench_kg: 110, squat_kg: 150, deadlift_kg: 190, endurance_seconds: 6900, run_distance: "half", run_seconds: 6900,
    unit_system: "kg", dataset_version_id: DATASET, score_version: SCORE_VERSION };
}

async function post(body: unknown, ip = "203.0.113.7", contentType = "application/json") {
  const { POST } = await import("../app/api/athlete-review/route");
  const res = await POST(new Request("http://localhost/api/athlete-review", {
    method: "POST", headers: { "content-type": contentType, "x-real-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
}

const validBody = () => ({ benchmark: benchmark(), answers: validAnswers() });

describe("POST /api/athlete-review: global cap and single attempt", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
    process.env.OPENAI_API_KEY = "stub-openai";
    delete process.env.ATHLETE_REVIEW_DAILY_CAP;
  });
  afterEach(() => { process.env = { ...env }; });

  it("absent cap = 50: the 50th attempt is allowed, the 51st is refused before OpenAI", async () => {
    let b = fakeBackend({ capStart: 49 });
    try {
      const r = await post(validBody());
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(b.state.openaiCalls, 1);
    } finally { b.restore(); }
    b = fakeBackend({ capStart: 50 });
    try {
      const r = await post(validBody());
      assert.equal(r.status, 503);
      assert.match(r.body.error, /today's limit/);
      assert.equal(b.state.openaiCalls, 0);
    } finally { b.restore(); }
  });

  for (const [label, value] of [["zero (disabled)", "0"], ["negative", "-5"], ["non-integer", "2.5"], ["text", "lots"], ["empty", ""]] as const) {
    it(`cap ${label} → 503 before any counter, validation or OpenAI`, async () => {
      process.env.ATHLETE_REVIEW_DAILY_CAP = value;
      const b = fakeBackend();
      try {
        const r = await post(validBody());
        assert.equal(r.status, 503);
        assert.deepEqual([b.state.openaiCalls, b.state.capHits, b.state.perIpHits, b.state.datasetReads], [0, 0, 0, 0]);
      } finally { b.restore(); }
    });
  }

  for (const mode of ["error", "garbage"] as const) {
    it(`counter ${mode} → 503 and no OpenAI call`, async () => {
      const b = fakeBackend({ capMode: mode });
      try {
        const r = await post(validBody());
        assert.equal(r.status, 503);
        assert.equal(b.state.capHits, 1);
        assert.equal(b.state.openaiCalls, 0);
      } finally { b.restore(); }
    });
  }

  it("reserves only AFTER validation: invalid or recalculate requests never touch the cap", async () => {
    const b = fakeBackend();
    try {
      assert.equal((await post({ benchmark: benchmark(), answers: { nope: 1 } })).status, 400);
      assert.equal((await post({ benchmark: { ...benchmark(), dataset_version_id: "x" }, answers: validAnswers() }, "203.0.113.8")).status, 409);
      assert.equal(b.state.capHits, 0);
      assert.equal(b.state.openaiCalls, 0);
    } finally { b.restore(); }
  });

  it("concurrent requests near the cap: exactly the remaining attempts reach OpenAI", async () => {
    process.env.ATHLETE_REVIEW_DAILY_CAP = "5";
    const b = fakeBackend({ capStart: 2, delayMs: () => Math.floor(Math.random() * 15) });
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => post(validBody(), `198.51.100.${i + 1}`)),
      );
      const ok = results.filter((r) => r.status === 200).length;
      const capped = results.filter((r) => r.status === 503).length;
      assert.equal(ok, 3, "5 - 2 already used");
      assert.equal(capped, 5);
      assert.equal(b.state.openaiCalls, 3);
      assert.equal(b.state.capHits, 8);
    } finally { b.restore(); }
  });

  for (const mode of ["http500", "network", "timeout", "abort"] as const) {
    it(`no automatic retry after ${mode}: exactly one OpenAI attempt and one reservation`, async () => {
      const b = fakeBackend({ openai: mode });
      try {
        const r = await post(validBody());
        assert.equal(r.status, 502);
        assert.equal(b.state.openaiCalls, 1);
        assert.equal(b.state.capHits, 1);
      } finally { b.restore(); }
    });
  }

  it("keeps the 3,500 output-token limit and SDK retries off; no manual retry loop", () => {
    const src = readFileSync(new URL("../app/api/athlete-review/route.ts", import.meta.url), "utf8");
    assert.match(src, /const MAX_OUTPUT_TOKENS = 3500;/);
    assert.match(src, /maxRetries: 0/);
    assert.equal(/attempt < 2|isTransientOpenAIError/.test(src), false);
    assert.equal((src.match(/openai\.responses\.create\(/g) ?? []).length, 1);
    assert.ok(src.indexOf("reserveReviewAttempt(") < src.indexOf("openai.responses.create("), "reserve before the call");
    assert.ok(src.indexOf("validateAnswers(") < src.indexOf("reserveReviewAttempt("), "validate before reserving");
  });
});

describe("POST /api/athlete-review: logs carry no personal data", () => {
  const env = { ...process.env };
  let lines: string[] = [];
  const saved = { log: console.log, warn: console.warn, error: console.error };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
    process.env.OPENAI_API_KEY = "stub-openai";
    delete process.env.ATHLETE_REVIEW_DAILY_CAP;
    lines = [];
    const grab = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
    console.log = grab; console.warn = grab; console.error = grab;
  });
  afterEach(() => {
    console.log = saved.log; console.warn = saved.warn; console.error = saved.error;
    process.env = { ...env };
  });

  it("security events, malformed JSON and provider failures log only allow-listed fields", async () => {
    const b = fakeBackend({ openai: "http500" });
    try {
      await post('{"answers": {"injuryNote": "SECRET-KNEE-DETAIL"', "203.0.113.99");
      await post("not json", "203.0.113.98", "text/plain");
      await post({ benchmark: benchmark(), answers: validAnswers(), extra: "SECRET-EXTRA" }, "203.0.113.97");
      await post(validBody(), "203.0.113.96");
    } finally { b.restore(); }
    assert.ok(lines.length >= 4, `captured ${lines.length} lines`);
    const all = lines.join("\n");
    for (const forbidden of [/203\.0\.113\./, /SECRET-KNEE-DETAIL/, /SECRET-EXTRA/, /secret-ish/, /injuryNote/, /text\/plain/]) {
      assert.doesNotMatch(all, forbidden, `leaked ${forbidden}`);
    }
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      for (const k of Object.keys(parsed)) {
        assert.ok(["level", "msg", "route", "event", "code"].includes(k), `unexpected log field ${k}`);
      }
    }
  });

  it("the route has no direct console calls left", () => {
    const src = readFileSync(new URL("../app/api/athlete-review/route.ts", import.meta.url), "utf8");
    assert.equal(/console\.(log|warn|error|info)\(/.test(src), false);
  });
});
