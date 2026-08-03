import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_DATASET_SIZE,
  REVIEW_THRESHOLD,
  SCORE_VERSION,
  ScoringError,
  assertDatasetIntegrity,
  computeCanonicalScore,
  moderationStatusForScore,
  parseCanonicalBenchmark,
  type ScoringDatasetSnapshot,
  type ScoringErrorCode,
} from "../lib/scoring/core";
import { around, makeSnapshot } from "./helpers/dataset";

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

function expectDatasetError(
  dataset: ScoringDatasetSnapshot,
  code: ScoringErrorCode,
) {
  assert.throws(
    () => computeCanonicalScore(BENCHMARK, dataset),
    (err: unknown) => {
      assert.ok(err instanceof ScoringError, "expected a ScoringError");
      assert.equal(err.code, code);
      return true;
    },
  );
}

describe("canonical score", () => {
  it("derives the documented index values", () => {
    const score = computeCanonicalScore(
      BENCHMARK,
      makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20)),
    );

    assert.equal(score.strengthIndex, 66.9);
    assert.equal(score.enduranceIndex, 59.1);
    assert.equal(score.strengthPercentile, 50);
    assert.equal(score.endurancePercentile, 50);
    assert.equal(score.hybridScore, 50);
    assert.equal(score.tier, "INTERMEDIATE");
    assert.equal(score.moderationStatus, "approved");
  });

  it("carries the dataset identity and disclosure onto every result", () => {
    const dataset = makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
      datasetVersionId: "22222222-2222-2222-2222-222222222222",
      label: "2026-08 provisional legacy",
      kind: "legacy_mixed_provisional",
    });
    const score = computeCanonicalScore(BENCHMARK, dataset);

    assert.equal(score.scoreVersion, SCORE_VERSION);
    assert.equal(score.datasetVersionId, dataset.datasetVersionId);
    assert.equal(score.datasetLabel, "2026-08 provisional legacy");
    assert.equal(score.datasetKind, "legacy_mixed_provisional");
    assert.equal(score.datasetSampleSize, 40);
    assert.equal(score.datasetConfidence, "provisional");
  });

  it("is reproducible against the same dataset version", () => {
    const dataset = makeSnapshot(around(66.9, 27, 13), around(59.1, 31, 9));

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
      makeSnapshot(around(66.9, 27, 13), around(59.1, 31, 9)),
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
      makeSnapshot(around(66.9, 40, 0), around(59.1, 32, 8)),
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
      makeSnapshot(around(66.9, 50, 0), around(59.1, 39, 11)),
    );

    assert.equal(score.endurancePercentile, 78);
    assert.equal(score.hybridScore, 89);
    assert.equal(score.moderationStatus, "approved");
  });
});

describe("dataset guards", () => {
  it("raises a typed error below the minimum sample size — no silent fallback", () => {
    const tooSmall = MIN_DATASET_SIZE - 1;
    expectDatasetError(
      makeSnapshot(around(66.9, tooSmall, 0), around(59.1, tooSmall, 0)),
      "DATASET_INSUFFICIENT",
    );
  });

  it("refuses a dataset built for a different score version", () => {
    expectDatasetError(
      makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
        scoreVersion: "0.0.1-legacy",
      }),
      "SCORE_VERSION_MISMATCH",
    );
  });
});

describe("dataset integrity", () => {
  const HEALTHY = makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20));

  it("accepts a well-formed dataset", () => {
    assert.doesNotThrow(() => assertDatasetIntegrity(HEALTHY));
  });

  it("rejects mismatched reference array lengths", () => {
    expectDatasetError(
      makeSnapshot(around(66.9, 40, 0), around(59.1, 35, 0), {
        eligibleSampleSize: 40,
      }),
      "DATASET_CORRUPT",
    );
  });

  it("rejects a sample size that disagrees with the arrays", () => {
    expectDatasetError(
      makeSnapshot(around(66.9, 40, 0), around(59.1, 40, 0), {
        eligibleSampleSize: 39,
      }),
      "DATASET_CORRUPT",
    );
  });

  it("rejects non-finite and out-of-range reference values", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, 100.1]) {
      const strength = around(66.9, 39, 0);
      strength.push(bad);
      expectDatasetError(
        makeSnapshot(strength, around(59.1, 40, 0)),
        "DATASET_CORRUPT",
      );
    }
  });

  it("never silently filters an invalid reference value", () => {
    const strength = around(66.9, 39, 0);
    strength.push(Number.NaN);

    // A filtering implementation would drop the NaN and score happily against
    // the surviving 39 members. Refusing outright is the only safe answer.
    expectDatasetError(
      makeSnapshot(strength, around(59.1, 40, 0)),
      "DATASET_CORRUPT",
    );
  });

  it("rejects a confidence tier that disagrees with the sample size", () => {
    expectDatasetError(
      makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
        confidence: "high",
      }),
      "DATASET_CORRUPT",
    );
  });

  it("rejects an unknown dataset kind", () => {
    expectDatasetError(
      makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
        kind: "totally_made_up" as ScoringDatasetSnapshot["kind"],
      }),
      "DATASET_CORRUPT",
    );
  });

  it("rejects a malformed dataset hash", () => {
    for (const bad of ["", "not-a-hash", "A".repeat(64), "0".repeat(63)]) {
      expectDatasetError(
        makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
          datasetHash: bad,
        }),
        "DATASET_CORRUPT",
      );
    }
  });

  it("accepts a well-formed but wrong hash — value checking belongs at load time", () => {
    // assertDatasetIntegrity validates FORMAT; the repository recomputes VALUE.
    assert.doesNotThrow(() =>
      assertDatasetIntegrity(
        makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
          datasetHash: "0".repeat(64),
        }),
      ),
    );
  });
});
