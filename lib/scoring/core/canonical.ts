// Canonical score calculation.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// Given a validated benchmark and an immutable dataset snapshot, this is a
// deterministic function: the same inputs and the same dataset version always
// produce the same score.

import {
  DATASET_KINDS,
  MIN_DATASET_SIZE,
  REFERENCE_VALUE_BOUNDS,
  REVIEW_THRESHOLD,
  SCORE_VERSION,
} from "./constants";
import { ScoringError } from "./errors";
import {
  canonicalScoreFromPercentiles,
  computeEnduranceIndex,
  computeStrengthIndex,
  datasetConfidence,
  getArchetype,
  getTier,
  percentileMidrank,
} from "./formulas";
import { isSha256Hex } from "./hashing";
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

function corrupt(detail: string): never {
  // `detail` names the structural problem only — it never contains data.
  throw new ScoringError(
    "DATASET_CORRUPT",
    `The active scoring dataset failed its integrity check (${detail}).`,
    "dataset",
  );
}

/**
 * Structural integrity of a reference population.
 *
 * Nothing here repairs, filters, or clamps: a dataset is either exactly what it
 * claims to be or it is unusable. Silently dropping a malformed reference value
 * would change every percentile computed against it without anyone noticing.
 *
 * Hash FORMAT is checked here; hash VALUE is recomputed at load time in
 * lib/server/scoreRepository.ts, which is where SHA-256 lives.
 */
export function assertDatasetIntegrity(dataset: ScoringDatasetSnapshot): void {
  if (!(DATASET_KINDS as readonly string[]).includes(dataset.kind)) {
    corrupt("unknown dataset kind");
  }

  if (!isSha256Hex(dataset.datasetHash)) {
    corrupt("malformed dataset hash");
  }

  const { strengthReference: strength, enduranceReference: endurance } = dataset;

  if (!Array.isArray(strength) || !Array.isArray(endurance)) {
    corrupt("missing reference arrays");
  }

  if (strength.length !== endurance.length) {
    corrupt("reference array lengths differ");
  }

  if (
    !Number.isInteger(dataset.eligibleSampleSize) ||
    dataset.eligibleSampleSize !== strength.length
  ) {
    corrupt("sample size does not match reference arrays");
  }

  for (const value of [...strength, ...endurance]) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < REFERENCE_VALUE_BOUNDS.min ||
      value > REFERENCE_VALUE_BOUNDS.max
    ) {
      corrupt("reference value outside 0-100");
    }
  }

  if (dataset.confidence !== datasetConfidence(dataset.eligibleSampleSize)) {
    corrupt("confidence does not match sample size");
  }
}

/**
 * A dataset must match the current scoring version, be structurally sound, and
 * be big enough before it can be used. There is no hidden fallback regime — each
 * failure is an explicit typed error.
 */
export function assertDatasetUsable(dataset: ScoringDatasetSnapshot): void {
  if (dataset.scoreVersion !== SCORE_VERSION) {
    throw new ScoringError(
      "SCORE_VERSION_MISMATCH",
      "The active dataset was built for a different scoring version.",
      "dataset",
    );
  }

  assertDatasetIntegrity(dataset);

  if (dataset.eligibleSampleSize < MIN_DATASET_SIZE) {
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
    datasetLabel: dataset.label,
    datasetKind: dataset.kind,
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
