import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_DATASET_SIZE,
  REVIEW_THRESHOLD,
  SCORE_VERSION,
  ScoringError,
  computeCanonicalScore,
  moderationStatusForScore,
  parseCanonicalBenchmark,
  type ScoringDatasetSnapshot,
} from "../lib/scoring/core";

// bw 90 / bench 110 / squat 150 / deadlift 190 / 5K 25:00
// -> strengthIndex 66.9, enduranceIndex 59.1 (6900 canonical seconds)
const BENCHMARK = parseCanonicalBenchmark({
  unitSystem: "kg",
  bodyweight: 90,
  bench: 110,
  squat: 150,
  deadlift: 190,
  runDistance: "5k",
  runSeconds: 1500,
});

function snapshot(
  strength: number[],
  endurance: number[],
  overrides: Partial<ScoringDatasetSnapshot> = {},
): ScoringDatasetSnapshot {
  return {
    datasetVersionId: "11111111-1111-1111-1111-111111111111",
    label: "test dataset",
    scoreVersion: SCORE_VERSION,
    strengthReference: strength,
    enduranceReference: endurance,
    eligibleSampleSize: Math.min(strength.length, endurance.length),
    datasetHash: "0".repeat(64),
    confidence: "provisional",
    ...overrides,
  };
}

/** `below` members under the athlete's index, `above` members over it. */
function around(index: number, below: number, above: number): number[] {
  return [
    ...Array.from({ length: below }, () => index - 10),
    ...Array.from({ length: above }, () => index + 10),
  ];
}

describe("canonical score", () => {
  it("derives the documented index values", () => {
    const score = computeCanonicalScore(
      BENCHMARK,
      snapshot(around(66.9, 20, 20), around(59.1, 20, 20)),
    );

    assert.equal(score.strengthIndex, 66.9);
    assert.equal(score.enduranceIndex, 59.1);
    assert.equal(score.strengthPercentile, 50);
    assert.equal(score.endurancePercentile, 50);
    assert.equal(score.hybridScore, 50);
    assert.equal(score.tier, "INTERMEDIATE");
    assert.equal(score.moderationStatus, "approved");
  });

  it("carries the dataset identity onto every result", () => {
    const dataset = snapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
      datasetVersionId: "22222222-2222-2222-2222-222222222222",
      confidence: "established",
    });
    const score = computeCanonicalScore(BENCHMARK, dataset);

    assert.equal(score.scoreVersion, SCORE_VERSION);
    assert.equal(score.datasetVersionId, dataset.datasetVersionId);
    assert.equal(score.datasetSampleSize, 40);
    assert.equal(score.datasetConfidence, "established");
  });

  it("is reproducible against the same dataset version", () => {
    const dataset = snapshot(around(66.9, 27, 13), around(59.1, 31, 9));

    const first = computeCanonicalScore(BENCHMARK, dataset);
    const second = computeCanonicalScore(BENCHMARK, dataset);
    const third = computeCanonicalScore(
      parseCanonicalBenchmark({
        unitSystem: "kg",
        bodyweight: 90,
        bench: 110,
        squat: 150,
        deadlift: 190,
        runDistance: "5k",
        runSeconds: 1500,
      }),
      snapshot(around(66.9, 27, 13), around(59.1, 31, 9)),
    );

    assert.deepEqual(first, second);
    assert.deepEqual(first, third);
  });
});

describe("review threshold", () => {
  it("uses one central constant set to 90", () => {
    assert.equal(REVIEW_THRESHOLD, 90);
    assert.equal(moderationStatusForScore(89), "approved");
    assert.equal(moderationStatusForScore(90), "pending");
    assert.equal(moderationStatusForScore(100), "pending");
  });

  it("holds a score of exactly 90 for manual review", () => {
    // strength percentile 100, endurance percentile 80 -> Hybrid Score 90.
    const score = computeCanonicalScore(
      BENCHMARK,
      snapshot(around(66.9, 40, 0), around(59.1, 32, 8)),
    );

    assert.equal(score.strengthPercentile, 100);
    assert.equal(score.endurancePercentile, 80);
    assert.equal(score.hybridScore, 90);
    assert.equal(score.moderationStatus, "pending");
    assert.equal(score.tier, "WORLD CLASS");
  });

  it("approves a score of 89", () => {
    // strength percentile 100, endurance percentile 78 -> Hybrid Score 89.
    const score = computeCanonicalScore(
      BENCHMARK,
      snapshot(around(66.9, 50, 0), around(59.1, 39, 11)),
    );

    assert.equal(score.endurancePercentile, 78);
    assert.equal(score.hybridScore, 89);
    assert.equal(score.moderationStatus, "approved");
  });
});

describe("dataset guards", () => {
  it("raises a typed error below the minimum sample size — no silent fallback", () => {
    const tooSmall = MIN_DATASET_SIZE - 1;

    assert.throws(
      () =>
        computeCanonicalScore(
          BENCHMARK,
          snapshot(around(66.9, tooSmall, 0), around(59.1, tooSmall, 0)),
        ),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "DATASET_INSUFFICIENT");
        return true;
      },
    );
  });

  it("refuses a dataset built for a different score version", () => {
    assert.throws(
      () =>
        computeCanonicalScore(
          BENCHMARK,
          snapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
            scoreVersion: "0.0.1-legacy",
          }),
        ),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "SCORE_VERSION_MISMATCH");
        return true;
      },
    );
  });

  it("refuses when only one axis meets the minimum", () => {
    assert.throws(
      () =>
        computeCanonicalScore(
          BENCHMARK,
          snapshot(around(66.9, 40, 0), around(59.1, 5, 0), {
            eligibleSampleSize: 40,
          }),
        ),
      ScoringError,
    );
  });
});
