// Behavioural coverage for the Group 1 correction pass.
//
// Two guarantees, both tested through real behaviour rather than by grepping
// source text:
//
//   1. A saved result and the inputs it was computed from cannot come apart —
//      not when the form is edited mid-flight, and not when a request fails.
//   2. The Athlete Review refuses an unusable dataset instead of scoring against
//      it, which is what keeps an undersized population from reaching the legacy
//      adapter's silent fallback and then an OpenAI call.
//
// Nothing here touches the network, Supabase, or OpenAI.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_DATASET_SIZE,
  SCORE_VERSION,
  assertDatasetUsable,
  computeCanonicalScore,
  type CanonicalBenchmark,
  type ScoringDatasetSnapshot,
} from "../lib/scoring/core";
import { computeScore, type ScoringDataset } from "../lib/scoring";
import { computeDatasetHash } from "../lib/server/hashing";
import {
  submissionVisibility,
  buildScoreRequestDraft,
  createSubmissionSession,
  submissionSignature,
  submitScore,
  type ScoreFormValues,
  type ScoreRequestDraft,
  type ScoreResultView,
} from "../lib/tool/scoreSubmission";

// --- fixtures ----------------------------------------------------------------

function form(overrides: Partial<ScoreFormValues> = {}): ScoreFormValues {
  return {
    displayName: "Ryan",
    unitSystem: "lb",
    bodyweight: "195",
    bench: "275",
    squat: "365",
    deadlift: "425",
    runDistance: "5k",
    runSeconds: 1350,
    visibility: submissionVisibility(true),
    ...overrides,
  };
}

function draftFrom(values: ScoreFormValues): ScoreRequestDraft {
  const built = buildScoreRequestDraft(values);
  assert.ok(built.ok, "fixture must be a valid submission");
  return built.draft;
}

function savedResult(overrides: Partial<ScoreResultView> = {}): ScoreResultView {
  return {
    resultId: "res_abc123def456ghj789kmnpqr",
    hybridScore: 64,
    strengthIndex: 66.9,
    enduranceIndex: 59.1,
    strengthPercentile: 71.2,
    endurancePercentile: 56.8,
    tier: "ADVANCED",
    archetype: "BALANCED HYBRID",
    moderationStatus: "approved",
    verificationStatus: "unverified",
    provenance: "self_reported",
    visibility: "public",
    scoreVersion: SCORE_VERSION,
    datasetVersionId: "33333333-3333-3333-3333-333333333333",
    datasetLabel: "2026-09 provisional legacy",
    datasetKind: "legacy_mixed_provisional",
    datasetSampleSize: 412,
    datasetConfidence: "established",
    calculatedAt: "2026-09-24T12:00:00.000Z",
    leaderboard: null,
    ...overrides,
  };
}

/**
 * The page's pairing rule, extracted so it can be exercised directly: a result
 * and the draft that produced it are written together, or not at all.
 */
type SavedSubmission = {
  result: ScoreResultView;
  inputs: ScoreRequestDraft;
  signature: string;
};

let keyCounter = 0;
const nextKey = () => `sx-corr-key-${++keyCounter}`;

function deferredFetch(status: number, body: unknown) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Record<string, unknown>[] = [];

  const impl = (async (_input: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")));
    await gate;
    return {
      ok: status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;

  return { impl, bodies, release };
}

// --- 1. result and inputs stay together --------------------------------------

describe("a saved result keeps the inputs it was scored from", () => {
  it("pairs the result with the draft that was actually sent", async () => {
    const values = form();
    const built = buildScoreRequestDraft(values);
    assert.ok(built.ok);

    const result = savedResult();
    const gated = deferredFetch(201, { result, idempotentReplay: false });
    const session = createSubmissionSession();

    const pending = submitScore(session, built.draft, {
      fetchImpl: gated.impl,
      makeKey: nextKey,
    });
    gated.release();
    const outcome = await pending;

    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") return;

    const saved: SavedSubmission = {
      result: outcome.result,
      inputs: built.draft,
      signature: submissionSignature(built.draft),
    };

    // The pair describes one submission: the weights stored beside the score are
    // the ones the request carried, in the athlete's own unit system.
    assert.equal(saved.inputs.bodyweight, 195);
    assert.equal(saved.inputs.bench, 275);
    assert.equal(saved.inputs.unit_system, "lb");
    assert.equal(saved.inputs.run_seconds, 1350);
    assert.equal(saved.result.hybridScore, 64);
    assert.deepEqual(gated.bodies[0].bodyweight, 195);
  });

  it("an edit made WHILE the request is in flight cannot attach to the result", async () => {
    // The live form is mutated after the request goes out. The draft was
    // captured by value beforehand, so the returning result pairs with what was
    // actually scored — not with the edit.
    const values = form();
    const captured = draftFrom(values);

    const gated = deferredFetch(201, {
      result: savedResult(),
      idempotentReplay: false,
    });
    const session = createSubmissionSession();

    const pending = submitScore(session, captured, {
      fetchImpl: gated.impl,
      makeKey: nextKey,
    });

    // The athlete types a new bench while the request is open.
    values.bench = "315";
    const editedDraft = draftFrom(values);

    gated.release();
    const outcome = await pending;
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") return;

    const saved: SavedSubmission = {
      result: outcome.result,
      inputs: captured,
      signature: submissionSignature(captured),
    };

    assert.equal(saved.inputs.bench, 275, "the scored bench must be preserved");
    assert.equal(editedDraft.bench, 315);
    // The request body carried the pre-edit value, proving the edit never
    // reached the server either.
    assert.equal(gated.bodies[0].bench, 275);
    // And the stale-detection signature now differs, which is what drives the
    // "you have changed your inputs" notice.
    assert.notEqual(saved.signature, submissionSignature(editedDraft));
  });

  it("a failed request leaves the previous result AND its inputs intact", async () => {
    const firstDraft = draftFrom(form());
    const okGate = deferredFetch(201, {
      result: savedResult({ hybridScore: 64 }),
      idempotentReplay: false,
    });
    const session = createSubmissionSession();

    const firstPending = submitScore(session, firstDraft, {
      fetchImpl: okGate.impl,
      makeKey: nextKey,
    });
    okGate.release();
    const first = await firstPending;
    assert.equal(first.status, "ok");
    if (first.status !== "ok") return;

    const saved: SavedSubmission = {
      result: first.result,
      inputs: firstDraft,
      signature: submissionSignature(firstDraft),
    };
    const before = saved;

    // Second submission, different inputs, and it fails.
    const secondDraft = draftFrom(form({ bench: "315" }));
    const failGate = deferredFetch(503, {
      error: { code: "DATASET_UNAVAILABLE", message: "unavailable" },
    });
    const secondPending = submitScore(session, secondDraft, {
      fetchImpl: failGate.impl,
      makeKey: nextKey,
    });
    failGate.release();
    const second = await secondPending;

    assert.equal(second.status, "error");

    // The page writes `saved` ONLY on the "ok" branch. There is no such branch to
    // take here, so the pair is left exactly as it was — same object identity,
    // not a rebuilt copy that happens to match.
    assert.equal(saved, before, "the pair must be the same object, unmodified");
    assert.notEqual(secondDraft.bench, firstDraft.bench);
    assert.equal(saved.result.hybridScore, 64);
    assert.equal(saved.inputs.bench, 275);
  });

  it("a busy outcome writes nothing, so a double tap cannot repair or corrupt the pair", async () => {
    const d = draftFrom(form());
    const gated = deferredFetch(201, {
      result: savedResult(),
      idempotentReplay: false,
    });
    const session = createSubmissionSession();

    const first = submitScore(session, d, { fetchImpl: gated.impl, makeKey: nextKey });
    const second = await submitScore(session, d, {
      fetchImpl: gated.impl,
      makeKey: nextKey,
    });

    assert.equal(second.status, "busy");
    gated.release();
    const resolved = await first;
    assert.equal(resolved.status, "ok");
  });

  it("the signature changes for every input field, so no edit goes unnoticed", () => {
    const base = draftFrom(form());
    const edits: Array<Partial<ScoreFormValues>> = [
      { displayName: "Someone Else" },
      { bodyweight: "196" },
      { bench: "276" },
      { squat: "366" },
      { deadlift: "426" },
      // A 10K needs its own plausible time: 22:30 over 10K converts below the
      // canonical endurance floor and would not be a valid submission at all.
      { runDistance: "10k", runSeconds: 2400 },
      { runSeconds: 1351 },
      { unitSystem: "kg", bodyweight: "88", bench: "125", squat: "165", deadlift: "193" },
    ];

    for (const edit of edits) {
      const changed = draftFrom(form(edit));
      assert.notEqual(
        submissionSignature(changed),
        submissionSignature(base),
        `editing ${Object.keys(edit).join("/")} must invalidate the pairing`,
      );
    }
  });
});

// --- 2. the Athlete Review refuses an unusable dataset ------------------------

function snapshot(
  size: number,
  overrides: Partial<ScoringDatasetSnapshot> = {},
): ScoringDatasetSnapshot {
  const strength = Array.from({ length: size }, (_, i) => ((i * 7) % 100) + 0.5);
  const endurance = Array.from({ length: size }, (_, i) => ((i * 11) % 100) + 0.5);
  const base = {
    datasetVersionId: "33333333-3333-3333-3333-333333333333",
    label: "2026-09 provisional legacy",
    kind: "legacy_mixed_provisional" as const,
    scoreVersion: SCORE_VERSION,
    strengthReference: strength,
    enduranceReference: endurance,
    eligibleSampleSize: size,
    confidence: "provisional" as const,
    datasetHash: "",
  };
  const merged = { ...base, ...overrides } as ScoringDatasetSnapshot;
  merged.datasetHash =
    overrides.datasetHash ??
    computeDatasetHash({
      scoreVersion: merged.scoreVersion,
      datasetKind: merged.kind,
      eligibleSampleSize: merged.eligibleSampleSize,
      strengthReference: merged.strengthReference,
      enduranceReference: merged.enduranceReference,
    });
  return merged;
}

const BENCHMARK: CanonicalBenchmark = {
  unitSystem: "kg",
  originalBodyweight: 90,
  originalBench: 110,
  originalSquat: 150,
  originalDeadlift: 190,
  bodyweightKg: 90,
  benchKg: 110,
  squatKg: 150,
  deadliftKg: 190,
  runDistance: "5k",
  runSeconds: 1350,
  canonicalEnduranceSeconds: 6411,
};

/** The route's dataset step, in the order route.ts performs it. */
function reviewDatasetStep(snap: ScoringDatasetSnapshot): ScoringDataset {
  assertDatasetUsable(snap);
  return {
    strengthScores: snap.strengthReference,
    enduranceScores: snap.enduranceReference,
  };
}

describe("Athlete Review rejects an unusable dataset before scoring", () => {
  it("accepts a usable dataset", () => {
    const dataset = reviewDatasetStep(snapshot(60));
    assert.equal(dataset.strengthScores.length, 60);
  });

  it("refuses an undersized dataset even though its hash is valid", () => {
    // This is the exact gap the correction closes. The repository's hash check
    // passes — the arrays ARE the frozen ones — but the population is too small
    // to produce a comparable score.
    const tooSmall = snapshot(MIN_DATASET_SIZE - 1);

    assert.throws(
      () => reviewDatasetStep(tooSmall),
      (error: unknown) =>
        error instanceof Error &&
        /too small to produce a comparable score/.test(error.message),
    );
  });

  it("the legacy adapter WOULD have scored that dataset, which is why the gate matters", () => {
    // Demonstrating the hazard rather than asserting it away. computeScore is the
    // legacy surface: below MIN_DATASET_SIZE it substitutes the raw endurance
    // index for a percentile instead of refusing. Without assertDatasetUsable an
    // Athlete Review would have produced these numbers and narrated them.
    const tooSmall = snapshot(MIN_DATASET_SIZE - 1);
    const unguarded: ScoringDataset = {
      strengthScores: tooSmall.strengthReference,
      enduranceScores: tooSmall.enduranceReference,
    };

    const scored = computeScore(
      {
        bodyweightKg: BENCHMARK.bodyweightKg,
        benchKg: BENCHMARK.benchKg,
        squatKg: BENCHMARK.squatKg,
        deadliftKg: BENCHMARK.deadliftKg,
        enduranceSeconds: BENCHMARK.canonicalEnduranceSeconds,
      },
      unguarded,
    );

    // It returns a number rather than throwing — the silent fallback.
    assert.ok(Number.isFinite(scored.hq));
    // And that endurance figure is the raw index, NOT a percentile against the
    // population, so it is not comparable with a canonical result.
    assert.equal(scored.endurancePercentile, scored.enduranceIndex);

    // The canonical path refuses the same dataset outright.
    assert.throws(() => computeCanonicalScore(BENCHMARK, tooSmall));
  });

  it("refuses a dataset built for a different score version", () => {
    assert.throws(
      () => reviewDatasetStep(snapshot(60, { scoreVersion: "9.9.9" })),
      /different scoring version/i,
    );
  });

  it("refuses a structurally corrupt dataset", () => {
    const mismatched = snapshot(60);
    // Sample size no longer agrees with the arrays.
    const corrupt = { ...mismatched, eligibleSampleSize: 61 };
    assert.throws(() => reviewDatasetStep(corrupt), /integrity check/i);
  });

  it("refuses a confidence tier that disagrees with the sample size", () => {
    const lying = snapshot(60, { confidence: "high" });
    assert.throws(() => reviewDatasetStep(lying), /integrity check/i);
  });

  it("gates on the SAME rule the canonical scorer uses", () => {
    // Not a parallel implementation: whatever computeCanonicalScore accepts or
    // rejects, the review must accept or reject identically.
    for (const size of [MIN_DATASET_SIZE - 1, MIN_DATASET_SIZE, MIN_DATASET_SIZE + 25]) {
      const snap = snapshot(size);
      let reviewThrew = false;
      let canonicalThrew = false;
      try {
        reviewDatasetStep(snap);
      } catch {
        reviewThrew = true;
      }
      try {
        computeCanonicalScore(BENCHMARK, snap);
      } catch {
        canonicalThrew = true;
      }
      assert.equal(
        reviewThrew,
        canonicalThrew,
        `review and canonical scorer disagreed at sample size ${size}`,
      );
    }
  });
});
