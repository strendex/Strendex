// Shared scoring domain types.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.

import type {
  ARCHETYPES,
  DATASET_CONFIDENCE_TIERS,
  MODERATION_STATUSES,
  PROVENANCES,
  TIERS,
  UNIT_SYSTEMS,
  VERIFICATION_STATUSES,
  VISIBILITIES,
} from "./constants";
import type { RUN_DISTANCE_IDS } from "./units";

export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
export type RunDistance = (typeof RUN_DISTANCE_IDS)[number];
export type Tier = (typeof TIERS)[number];
export type Archetype = (typeof ARCHETYPES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type Provenance = (typeof PROVENANCES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
export type DatasetConfidence = (typeof DATASET_CONFIDENCE_TIERS)[number];

/** Raw benchmark as the athlete entered it, before any conversion. */
export type RawBenchmarkInput = {
  unitSystem: UnitSystem;
  bodyweight: number;
  bench: number;
  squat: number;
  deadlift: number;
  runDistance: RunDistance;
  runSeconds: number;
};

/** Fully converted, validated, leaderboard-eligible benchmark. */
export type CanonicalBenchmark = {
  unitSystem: UnitSystem;
  bodyweightKg: number;
  benchKg: number;
  squatKg: number;
  deadliftKg: number;
  runDistance: RunDistance;
  runSeconds: number;
  /** Half-marathon-equivalent seconds (Riegel). */
  canonicalEnduranceSeconds: number;
};

/** Immutable reference population a score is measured against. */
export type ScoringDatasetSnapshot = {
  datasetVersionId: string;
  label: string;
  scoreVersion: string;
  strengthReference: number[];
  enduranceReference: number[];
  eligibleSampleSize: number;
  datasetHash: string;
  confidence: DatasetConfidence;
};

export type CanonicalScore = {
  scoreVersion: string;
  datasetVersionId: string;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
  hybridScore: number;
  tier: Tier;
  archetype: Archetype;
  moderationStatus: ModerationStatus;
};
