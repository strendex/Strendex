// Group 2 — Athlete Review compatibility with the widened run-time window.
//
// Pure functions only: benchmark validation and deterministic scenarios. No
// route handler, Supabase or OpenAI call is made anywhere in this file.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateBenchmark } from "../lib/athleteReview/benchmarkValidation";
import { computeScenarios } from "../lib/athleteReview/scenarios";
import type { GoalOption } from "../lib/athleteReview/types";
import { computeScore, type ScoringInput } from "../lib/scoring";
import {
  RUN_DISTANCES,
  RUN_DISTANCE_IDS,
  SUBMISSION_CANONICAL_ENDURANCE_SECONDS,
  VALIDATION_BOUNDS,
  computeEnduranceIndex,
  toCanonicalEnduranceSeconds,
} from "../lib/scoring/core";

const { min: SUB_MIN, max: SUB_MAX } = SUBMISSION_CANONICAL_ENDURANCE_SECONDS;

/**
 * What the review sends: kg values, canonical seconds, and — whenever there is
 * an endurance time — the run as entered, which must convert to those seconds.
 */
function snapshot(enduranceSeconds: number | null, run?: readonly [string, number]) {
  return {
    bodyweight_kg: 90,
    bench_kg: 110,
    squat_kg: 150,
    deadlift_kg: 190,
    endurance_seconds: enduranceSeconds,
    ...(run ? { run_distance: run[0], run_seconds: run[1] } : {}),
    unit_system: "kg",
    // Group 3: every review names the benchmark its saved result used.
    dataset_version_id: "8bd76e2f-4cfb-47f0-8407-e5b812a6709d",
    score_version: "2.0.0",
  };
}

describe("review benchmark validation", () => {
  it("accepts a fast runner the calculator now scores", () => {
    // 5K in 11:40 -> 3220 s canonical, previously a 400 from this route.
    const r = validateBenchmark(snapshot(toCanonicalEnduranceSeconds(700, "5k"), ["5k", 700]));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.benchmark.enduranceSeconds, 3220);
  });

  it("accepts both ends of every distance's window, as the calculator converts them", () => {
    for (const d of RUN_DISTANCE_IDS) {
      for (const t of [RUN_DISTANCES[d].minSeconds, RUN_DISTANCES[d].maxSeconds]) {
        const r = validateBenchmark(snapshot(toCanonicalEnduranceSeconds(t, d), [d, t]));
        assert.equal(r.ok, true, `${d} ${t}s`);
      }
    }
  });

  it("accepts the exact submission bounds and rejects one second outside", () => {
    // The bounds are exactly the fastest 3 mi and the slowest half.
    assert.equal(toCanonicalEnduranceSeconds(660, "3mi"), SUB_MIN);
    assert.equal(toCanonicalEnduranceSeconds(28800, "half"), SUB_MAX);
    assert.equal(validateBenchmark(snapshot(SUB_MIN, ["3mi", 660])).ok, true);
    assert.equal(validateBenchmark(snapshot(SUB_MAX, ["half", 28800])).ok, true);
    for (const bad of [SUB_MIN - 1, SUB_MAX + 1, 0, -1, Number.NaN, "fast"]) {
      const r = validateBenchmark(snapshot(bad as number, ["5k", 1330]));
      assert.equal(r.ok, false, String(bad));
      if (!r.ok) assert.equal(r.error, "Endurance time looks out of range.");
    }
  });

  it("uses the submission bounds, not the unchanged dataset eligibility bound", () => {
    assert.deepEqual(SUBMISSION_CANONICAL_ENDURANCE_SECONDS, { min: 3151, max: 28800 });
    assert.deepEqual(VALIDATION_BOUNDS.canonicalEnduranceSeconds, { min: 4200, max: 28800 });
  });

  it("still allows a review with no endurance time", () => {
    assert.equal(validateBenchmark(snapshot(null)).ok, true);
  });
});

// --- scenarios ---------------------------------------------------------------

const REFERENCE = Array.from({ length: 50 }, (_, i) => i * 2 + 0.5);
const DATASET = { strengthScores: REFERENCE, enduranceScores: REFERENCE };
const GOALS: GoalOption[] = ["raise_score", "balance", "strength", "endurance", "race_prep"];

function input(enduranceSeconds: number | null, lifts = true): ScoringInput {
  return {
    bodyweightKg: 90,
    benchKg: lifts ? 110 : null,
    squatKg: lifts ? 150 : null,
    deadliftKg: lifts ? 190 : null,
    enduranceSeconds,
  };
}

function scenariosFor(seconds: number, lifts = true, goal: GoalOption = "raise_score") {
  const i = input(seconds, lifts);
  const current = computeScore(i, DATASET);
  return { current, scenarios: computeScenarios({ input: i, dataset: DATASET, current, primaryGoal: goal }) };
}

// Fast runners newly accepted by Group 2, the index-cap edge, and a spread of
// previously accepted times up to the ceiling.
const SECONDS = [
  SUB_MIN, 3220, 3309, 3600, 4000, 4199, 4200, 4201, 4203,
  4204, 4250, 4400, 5000, 6411, 10800, 20000, SUB_MAX,
];

describe("scenarios never project a slower or unchanged run as an improvement", () => {
  it("every endurance change is a real, bounded time reduction (both paths)", () => {
    for (const s of SECONDS) {
      for (const lifts of [true, false]) {
        for (const goal of GOALS) {
          const { scenarios } = scenariosFor(s, lifts, goal);
          for (const sc of scenarios) {
            const delta = sc.changes.enduranceSecondsDelta;
            if (!sc.available || delta === null) continue;
            const label = `${sc.id} at ${s}s`;
            assert.ok(delta < 0, `${label}: delta ${delta} must be negative`);
            const projected = s + delta;
            assert.ok(projected >= SUB_MIN && projected <= SUB_MAX, `${label}: ${projected}s out of bounds`);
            assert.doesNotMatch(sc.description, /about 0:00\b/, label);
          }
        }
      }
    }
  });

  it("both endurance paths are locked, not projected, once the index is at 100", () => {
    for (const s of SECONDS.filter((x) => computeEnduranceIndex(x) >= 100)) {
      const { scenarios } = scenariosFor(s);
      for (const id of ["endurance_push", "balanced"] as const) {
        const sc = scenarios.find((x) => x.id === id)!;
        assert.equal(sc.available, false, `${id} at ${s}s`);
        assert.equal(sc.projected, null, `${id} at ${s}s`);
        assert.equal(sc.changes.enduranceSecondsDelta, null, `${id} at ${s}s`);
        assert.match(sc.description, /maximum endurance index/);
      }
    }
  });

  it("invents no endurance score gain at the cap", () => {
    for (const s of [SUB_MIN, 3220, 4000, 4200, 4203]) {
      for (const goal of GOALS) {
        const { current, scenarios } = scenariosFor(s, true, goal);
        assert.equal(current.enduranceIndex, 100);
        for (const sc of scenarios.filter((x) => x.available && x.projected)) {
          assert.equal(
            sc.projected!.endurancePercentile,
            current.endurancePercentile,
            `${sc.id} at ${s}s must not raise the endurance percentile`,
          );
        }
        // The strength push is still offered, and becomes the primary.
        const primary = scenarios.find((x) => x.isPrimary);
        assert.equal(primary?.id, "strength_push", `goal ${goal} at ${s}s`);
      }
    }
  });

  it("an endurance-only fast runner is offered nothing it cannot gain", () => {
    const { scenarios } = scenariosFor(3220, false, "endurance");
    assert.ok(scenarios.every((sc) => !sc.available && sc.projected === null));
  });
});

describe("previously accepted athletes keep their exact scenarios", () => {
  // From the PRE-Group-2 computeScenarios. Row: lifts, seconds,
  // endurance-push delta, endurance-push Hybrid Score, balanced delta,
  // balanced Hybrid Score (null when balanced needs lifts).
  const GOLDEN: ReadonlyArray<
    readonly [boolean, number, number, number, number | null, number | null]
  > = [
    [true, 4204, -4, 84, -4, 85],
    [true, 4250, -50, 84, -50, 85],
    [true, 4400, -176, 84, -88, 84],
    [true, 4700, -188, 82, -94, 82],
    [true, 5000, -200, 80, -100, 80],
    [true, 6411, -256, 69, -128, 69],
    [true, 8000, -320, 58, -160, 58],
    [true, 10800, -432, 38, -216, 37],
    [true, 15000, -480, 34, -300, 35],
    [true, 28800, -480, 34, -576, 35],
    [false, 4204, -4, 50, null, null],
    [false, 4250, -50, 50, null, null],
    [false, 4400, -176, 50, null, null],
    [false, 4700, -188, 48, null, null],
    [false, 5000, -200, 46, null, null],
    [false, 6411, -256, 35, null, null],
    [false, 8000, -320, 24, null, null],
    [false, 10800, -432, 4, null, null],
    [false, 15000, -480, 0, null, null],
    [false, 28800, -480, 0, null, null],
  ];

  it("matches the pre-change projections from 4204 s up", () => {
    for (const [lifts, s, pushDelta, pushHq, balDelta, balHq] of GOLDEN) {
      const { scenarios } = scenariosFor(s, lifts, "strength");
      const push = scenarios.find((x) => x.id === "endurance_push")!;
      const bal = scenarios.find((x) => x.id === "balanced")!;
      const label = `${lifts ? "lifts" : "no lifts"} ${s}s`;
      assert.equal(push.available, true, label);
      assert.equal(push.changes.enduranceSecondsDelta, pushDelta, label);
      assert.equal(push.projected?.hq, pushHq, label);
      assert.equal(bal.available, balDelta !== null, label);
      assert.equal(bal.changes.enduranceSecondsDelta, balDelta, label);
      assert.equal(bal.projected?.hq ?? null, balHq, label);
    }
  });
});
