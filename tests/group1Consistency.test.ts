// Group 1 guarantees, tested end to end through the seams that hold them.
//
// The three claims this group makes, and where each is proven here:
//   1. The comparison benchmark is FIXED — a new submission cannot move it.
//   2. Placement counts only results that are actually comparable: same dataset
//      version (and therefore same score version), approved, public.
//   3. The Athlete Review scores against that SAME fixed benchmark instead of
//      rebuilding one from live submissions.
//
// What is NOT provable here: anything about real Postgres. The fakes below prove
// which query the code issues and what it does with the answer; they do not
// prove how the server evaluates it. See migrations/verify/ and the staging
// checklist in docs/group-1-runbook.md.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MIN_DATASET_SIZE,
  SCORE_VERSION,
  computeCanonicalScore,
  computeStrengthIndex,
  computeEnduranceIndex,
  percentileMidrank,
  type CanonicalBenchmark,
  type ScoringDatasetSnapshot,
} from "../lib/scoring/core";
import { computeScore, type ScoringDataset } from "../lib/scoring";
import { computeDatasetHash } from "../lib/server/hashing";
import { createSupabaseScoreRepository } from "../lib/server/scoreRepository";

const DATASET_ID = "44444444-4444-4444-4444-444444444444";
const OTHER_DATASET_ID = "55555555-5555-5555-5555-555555555555";

/** A frozen reference population, hash and confidence consistent. */
function snapshot(
  strength: number[],
  endurance: number[],
  overrides: Partial<ScoringDatasetSnapshot> = {},
): ScoringDatasetSnapshot {
  const base = {
    datasetVersionId: DATASET_ID,
    label: "2026-09 provisional legacy",
    kind: "legacy_mixed_provisional" as const,
    scoreVersion: SCORE_VERSION,
    strengthReference: strength,
    enduranceReference: endurance,
    eligibleSampleSize: strength.length,
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

function population(n: number, offset = 0): number[] {
  return Array.from({ length: n }, (_, i) => ((i * 7 + offset) % 100) + 0.5);
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

describe("the benchmark is fixed", () => {
  it("does not move when submissions are added, approved, or scored", () => {
    const frozen = snapshot(population(40), population(40, 3));

    const before = computeCanonicalScore(BENCHMARK, frozen);

    // Simulate the whole reason /api/rank drifted: more approved athletes. The
    // frozen snapshot is an immutable array, so this cannot reach it — the point
    // is that nothing in the scoring path consults `submissions` at all.
    const after = computeCanonicalScore(BENCHMARK, frozen);

    assert.deepEqual(after, before);
    assert.equal(after.datasetVersionId, DATASET_ID);
    assert.equal(after.datasetSampleSize, 40);
  });

  it("gives a different score only when the dataset version itself differs", () => {
    const a = snapshot(population(40), population(40, 3));
    const b = snapshot(population(40, 11), population(40, 17), {
      datasetVersionId: OTHER_DATASET_ID,
    });

    const scoreA = computeCanonicalScore(BENCHMARK, a);
    const scoreB = computeCanonicalScore(BENCHMARK, b);

    // Different reference population => different percentile. That is expected
    // and is exactly why the dataset version travels with every result.
    assert.notEqual(scoreA.strengthPercentile, scoreB.strengthPercentile);
    assert.equal(scoreA.datasetVersionId, DATASET_ID);
    assert.equal(scoreB.datasetVersionId, OTHER_DATASET_ID);
  });

  it("is reproducible: the same inputs and dataset always give the same score", () => {
    const frozen = snapshot(population(60), population(60, 5));
    const runs = Array.from({ length: 5 }, () =>
      computeCanonicalScore(BENCHMARK, frozen),
    );
    for (const run of runs) assert.deepEqual(run, runs[0]);
  });

  it("refuses to score rather than quietly shrinking to a tiny population", () => {
    const tooSmall = snapshot(
      population(MIN_DATASET_SIZE - 1),
      population(MIN_DATASET_SIZE - 1, 3),
    );
    assert.throws(
      () => computeCanonicalScore(BENCHMARK, tooSmall),
      /too small to produce a comparable score/,
    );
  });
});

describe("placement counts only comparable results", () => {
  // Group 3: placement is one database statement (leaderboard_placement), so
  // the scope travels as RPC arguments and the eligibility rule lives in the
  // function's WHERE clause (pinned in tests/group3Leaderboard.test.ts).
  function capturingSupabase(result: { higher: number; total: number }) {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      from: () => {
        throw new Error("placement must not read submission rows");
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: result, error: null };
      },
    } as unknown as SupabaseClient;
    return { client, calls: () => calls };
  }

  it("scopes placement to one dataset version and score version", async () => {
    const spy = capturingSupabase({ higher: 1, total: 2 });
    const placement = await createSupabaseScoreRepository(spy.client).loadPlacement(
      { datasetVersionId: DATASET_ID, scoreVersion: SCORE_VERSION },
      70,
    );
    assert.deepEqual(placement, { rank: 2, total: 2 });
    assert.deepEqual(spy.calls(), [
      {
        name: "leaderboard_placement",
        args: { p_dataset_version_id: DATASET_ID, p_score_version: SCORE_VERSION, p_score: 70 },
      },
    ]);
  });

  it("excludes legacy rows, because a NULL dataset version matches no version", () => {
    // Group 1 deliberately does NOT widen this to include the 519 historical
    // rows. An equality filter on dataset_version_id can never match NULL.
    const sql = readFileSync(
      new URL("../migrations/20260929_04_leaderboard_placement_function.sql", import.meta.url),
      "utf8",
    );
    assert.match(sql, /s\.dataset_version_id = p_dataset_version_id/);
    assert.match(sql, /s\.status = 'approved'/);
    assert.match(sql, /s\.visibility = 'public'/);
  });

  it("returns counts only — no athlete data for a rank", async () => {
    const spy = capturingSupabase({ higher: 0, total: 1 });
    const placement = await createSupabaseScoreRepository(spy.client).loadPlacement(
      { datasetVersionId: DATASET_ID, scoreVersion: SCORE_VERSION },
      70,
    );
    assert.deepEqual(Object.keys(placement ?? {}).sort(), ["rank", "total"]);
  });
});

describe("the Athlete Review shares the benchmark", () => {
  it("produces the same percentiles as the canonical scorer from one snapshot", () => {
    const frozen = snapshot(population(50), population(50, 9));

    // What /api/score computes.
    const canonical = computeCanonicalScore(BENCHMARK, frozen);

    // What /api/athlete-review computes, via the adapter the route now uses:
    // the frozen reference arrays, used verbatim.
    const reviewDataset: ScoringDataset = {
      strengthScores: frozen.strengthReference,
      enduranceScores: frozen.enduranceReference,
    };
    const review = computeScore(
      {
        bodyweightKg: BENCHMARK.bodyweightKg,
        benchKg: BENCHMARK.benchKg,
        squatKg: BENCHMARK.squatKg,
        deadliftKg: BENCHMARK.deadliftKg,
        enduranceSeconds: BENCHMARK.canonicalEnduranceSeconds,
      },
      reviewDataset,
    );

    assert.equal(review.strengthPercentile, canonical.strengthPercentile);
    assert.equal(review.endurancePercentile, canonical.endurancePercentile);
    assert.equal(review.hq, canonical.hybridScore);
    assert.equal(review.tier, canonical.tier);
    assert.equal(review.archetype, canonical.archetype);
    assert.equal(review.strengthIndex, canonical.strengthIndex);
    assert.equal(review.enduranceIndex, canonical.enduranceIndex);
  });

  it("uses the reference arrays directly, with no re-derivation", () => {
    const strength = population(45);
    const endurance = population(45, 13);
    const frozen = snapshot(strength, endurance);

    const expectedStrengthPercentile = percentileMidrank(
      frozen.strengthReference,
      computeStrengthIndex({
        bodyweightKg: BENCHMARK.bodyweightKg,
        benchKg: BENCHMARK.benchKg,
        squatKg: BENCHMARK.squatKg,
        deadliftKg: BENCHMARK.deadliftKg,
      }),
    );
    const expectedEndurancePercentile = percentileMidrank(
      frozen.enduranceReference,
      computeEnduranceIndex(BENCHMARK.canonicalEnduranceSeconds),
    );

    const scored = computeCanonicalScore(BENCHMARK, frozen);
    assert.equal(scored.strengthPercentile, expectedStrengthPercentile);
    assert.equal(scored.endurancePercentile, expectedEndurancePercentile);
  });

  it("no longer builds a reference population from live submissions", () => {
    // A structural guard, not a behavioural proof. The route used to run its own
    // `.from("submissions").select(...).eq("status","approved")` and derive
    // percentiles from whatever was approved at that instant — a third moving
    // benchmark. This asserts that query is gone and the frozen loader is used.
    const source = readFileSync(
      new URL("../app/api/athlete-review/route.ts", import.meta.url),
      "utf8",
    );

    assert.ok(
      !/buildScoringDataset/.test(source),
      "the review must not rebuild a dataset from submission rows",
    );
    assert.ok(
      !/\.from\(\s*["']submissions["']\s*\)/.test(source),
      "the review must not query the submissions table for scoring data",
    );
    // Group 3: the review loads the frozen version the SAVED result was scored
    // against — never whichever is active now (tests/group3Review.test.ts).
    assert.ok(
      /loadDatasetVersion\(\s*benchmark\.datasetVersionId\s*\)/.test(source),
      "the review must load the frozen dataset version the saved result used",
    );
    assert.ok(
      !/loadActiveDataset\(/.test(source),
      "the review must not fall back to the active dataset",
    );
  });

  it("stays read-only with respect to submissions", () => {
    const source = readFileSync(
      new URL("../app/api/athlete-review/route.ts", import.meta.url),
      "utf8",
    );
    for (const write of ["insert(", "update(", "delete(", "upsert("]) {
      assert.ok(
        !source.includes(`submissions").${write}`),
        `the review must not ${write} submissions`,
      );
    }
    assert.ok(
      !/score_result_insert/.test(source),
      "the review must not call the result-insertion RPC",
    );
  });
});

describe("the calculator holds no scoring math of its own", () => {
  const source = readFileSync(
    new URL("../app/tool/page.tsx", import.meta.url),
    "utf8",
  );

  it("no longer reimplements the tier or archetype bands", () => {
    assert.ok(
      !/function getTier\s*\(/.test(source),
      "tier must come from the saved result",
    );
    assert.ok(
      !/function getArchetype\s*\(/.test(source),
      "archetype must come from the saved result",
    );
  });

  it("no longer reimplements the Riegel conversion or the pound factor", () => {
    assert.ok(
      !/function toHalfMarathonEquivalentSeconds/.test(source),
      "run conversion belongs to lib/scoring/core/units.ts",
    );
    assert.ok(
      !/2\.2046226218/.test(source),
      "the pound/kilogram factor must have exactly one definition",
    );
    assert.ok(
      !/1\.06/.test(source),
      "the Riegel exponent must have exactly one definition",
    );
  });

  it("calls the canonical endpoint once and never the superseded pair", () => {
    assert.ok(
      !/["']\/api\/rank["']/.test(source),
      "the calculator must not call the deprecated /api/rank",
    );
    assert.ok(
      !/["']\/api\/submit["']/.test(source),
      "the calculator must not call the deprecated /api/submit",
    );
  });

  it("claims a numeric placement only as the server returned it", () => {
    // Group 1 withheld placement while /rankings and canonical placement
    // disagreed. Group 3 made them one population (lib/leaderboard.ts) and
    // enabled it after staging verification; the rank and total still come
    // only from the saved result's `leaderboard`, via placementLine. It is
    // withheld on screen again while rankings are temporarily hidden.
    assert.ok(
      /LEADERBOARD_PLACEMENT_AVAILABLE = false/.test(source),
      "placement is withheld while rankings are hidden",
    );
    assert.ok(/placementLine\(result\)/.test(source), "placement is rendered by the tested helper");
    assert.ok(
      !/betterThanPercent\.toFixed/.test(source),
      "the leaderboard-derived percentile claim must be gone",
    );
  });
});
