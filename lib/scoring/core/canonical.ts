// Canonical score calculation.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// Given a validated benchmark and an immutable dataset snapshot, this is a
// deterministic function: the same inputs and the same dataset version always
// produce the same score.

import { MIN_DATASET_SIZE, REVIEW_THRESHOLD, SCORE_VERSION } from "./constants";
import { ScoringError } from "./errors";
import {
  canonicalScoreFromPercentiles,
  computeEnduranceIndex,
  computeStrengthIndex,
  getArchetype,
  getTier,
  percentileMidrank,
} from "./formulas";
import type {
  CanonicalBenchmark,
  CanonicalScore,
  ModerationStatus,
  ScoringDatasetSnapshot,
} from "./types";

/** Server-owned moderation rule. Hybrid Score >= 90 needs a human. */
export function moderationStatusForScore(hybridScore: number): ModerationStatus {
  return hybridScore >= REVIEW_THRESHOLD ? "pending" : "approved";
}

/**
 * A dataset must be big enough on BOTH axes before it can be used. There is no
 * hidden fallback regime — an undersized dataset is an explicit typed error.
 */
export function assertDatasetUsable(dataset: ScoringDatasetSnapshot): void {
  if (dataset.scoreVersion !== SCORE_VERSION) {
    throw new ScoringError(
      "SCORE_VERSION_MISMATCH",
      "The active dataset was built for a different scoring version.",
      "dataset",
    );
  }

  const strength = dataset.strengthReference.filter((n) => Number.isFinite(n));
  const endurance = dataset.enduranceReference.filter((n) => Number.isFinite(n));

  if (
    strength.length < MIN_DATASET_SIZE ||
    endurance.length < MIN_DATASET_SIZE ||
    dataset.eligibleSampleSize < MIN_DATASET_SIZE
  ) {
    throw new ScoringError(
      "DATASET_INSUFFICIENT",
      "The scoring dataset is too small to produce a comparable score.",
      "dataset",
    );
  }
}

export function computeCanonicalScore(
  benchmark: CanonicalBenchmark,
  dataset: ScoringDatasetSnapshot,
): CanonicalScore {
  assertDatasetUsable(dataset);

  const strengthIndex = computeStrengthIndex({
    bodyweightKg: benchmark.bodyweightKg,
    benchKg: benchmark.benchKg,
    squatKg: benchmark.squatKg,
    deadliftKg: benchmark.deadliftKg,
  });

  const enduranceIndex = computeEnduranceIndex(
    benchmark.canonicalEnduranceSeconds,
  );

  const strengthPercentile = percentileMidrank(
    dataset.strengthReference,
    strengthIndex,
  );
  const endurancePercentile = percentileMidrank(
    dataset.enduranceReference,
    enduranceIndex,
  );

  const hybridScore = canonicalScoreFromPercentiles(
    strengthPercentile,
    endurancePercentile,
  );

  return {
    scoreVersion: SCORE_VERSION,
    datasetVersionId: dataset.datasetVersionId,
    datasetSampleSize: dataset.eligibleSampleSize,
    datasetConfidence: dataset.confidence,
    strengthIndex,
    enduranceIndex,
    strengthPercentile,
    endurancePercentile,
    hybridScore,
    tier: getTier(hybridScore),
    archetype: getArchetype(strengthPercentile, endurancePercentile),
    moderationStatus: moderationStatusForScore(hybridScore),
  };
}
