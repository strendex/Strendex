// Canonical scoring constants.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// Every number that defines "what a Strendex score means" lives here so there is
// exactly one place to change it and exactly one place to test it.

/**
 * Identifies the scoring algorithm. Any change to a formula, threshold, or
 * conversion in lib/scoring/core MUST bump this. Results are only comparable to
 * other results with the same score version AND the same dataset version.
 */
export const SCORE_VERSION = "2.0.0";

/** Hybrid Score = 50% strength percentile + 50% endurance percentile. */
export const SCORE_WEIGHTS = {
  strength: 0.5,
  endurance: 0.5,
} as const;

/**
 * Single source of truth for the manual-review threshold.
 * Hybrid Score >= this value is persisted as `pending`.
 */
export const REVIEW_THRESHOLD = 90;

/**
 * Minimum eligible sample size before a dataset may be used for percentile
 * scoring. Below this the scorer raises DATASET_INSUFFICIENT — it never silently
 * falls back to a different scoring regime.
 */
export const MIN_DATASET_SIZE = 30;

/** Dataset confidence tiers, ordered from least to most trustworthy. */
export const DATASET_CONFIDENCE_TIERS = [
  "provisional",
  "established",
  "high",
] as const;

export const DATASET_CONFIDENCE_THRESHOLDS = {
  established: 250,
  high: 1000,
} as const;

/**
 * What a reference population is actually made of. This is disclosure, not
 * decoration: a score measured against a legacy_mixed_provisional dataset is
 * measured against rows whose real-vs-simulated origin is unknown, and the
 * product must say so.
 *
 *   observed                  — governed, complete, approved, public v2 results.
 *   legacy_mixed_provisional  — pre-governance rows of unknown origin. The
 *                               transitional bootstrap only; never presented as
 *                               verified.
 */
export const DATASET_KINDS = ["observed", "legacy_mixed_provisional"] as const;

/** Reference index values are percentages of the index scale. */
export const REFERENCE_VALUE_BOUNDS = { min: 0, max: 100 } as const;

/** Lowercase hex SHA-256, exactly 64 characters. Used for hashes and fingerprints. */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Endurance index anchors, in canonical (half-marathon-equivalent) seconds. */
export const ENDURANCE_INDEX_MIN_SEC = 4200; // 1:10:00 -> index 100
export const ENDURANCE_INDEX_MAX_SEC = 10800; // 3:00:00 -> index 0

/** Piecewise strength thresholds (lift / bodyweight), unchanged from v1. */
export const STRENGTH_RATIO_THRESHOLDS = {
  bench: { mid: 0.75, strong: 1.25, elite: 1.75 },
  squat: { mid: 1.0, strong: 1.75, elite: 2.5 },
  deadlift: { mid: 1.25, strong: 2.25, elite: 3.0 },
} as const;

/** Validation boundaries. Kilograms internally, always. */
export const VALIDATION_BOUNDS = {
  bodyweightKg: { min: 36, max: 181 },
  benchKg: { min: 20, max: 318 },
  squatKg: { min: 20, max: 409 },
  deadliftKg: { min: 20, max: 454 },
  /** Canonical half-marathon-equivalent seconds. */
  canonicalEnduranceSeconds: { min: 4200, max: 28800 },
} as const;

/** Plausibility caps on lift-to-bodyweight ratio. */
export const MAX_LIFT_RATIO = {
  bench: 3.2,
  squat: 4.0,
  deadlift: 4.5,
} as const;

export const DISPLAY_NAME = {
  minLength: 2,
  maxLength: 60,
  fallback: "Anonymous Athlete",
} as const;

export const IDEMPOTENCY_KEY = {
  minLength: 8,
  maxLength: 128,
  /** Opaque client-chosen token: url-safe characters only. */
  pattern: /^[A-Za-z0-9._:-]+$/,
} as const;

export const TIERS = [
  "NOVICE",
  "INTERMEDIATE",
  "ADVANCED",
  "ELITE",
  "WORLD CLASS",
] as const;

export const ARCHETYPES = [
  "BASE BUILDER",
  "POWER HYBRID",
  "STRENGTH BEAST",
  "ENDURANCE MACHINE",
  "BALANCED HYBRID",
  "STRENGTH-LEANING HYBRID",
  "ENDURANCE-LEANING HYBRID",
] as const;

export const UNIT_SYSTEMS = ["lb", "kg"] as const;

export const VISIBILITIES = ["private", "unlisted", "public"] as const;

/** New results are private unless the request explicitly asks otherwise. */
export const DEFAULT_VISIBILITY = "private";

export const PROVENANCES = [
  "legacy_unknown",
  "simulated",
  "self_reported",
  "reviewed",
  "verified",
] as const;

export const VERIFICATION_STATUSES = [
  "unverified",
  "in_review",
  "verified",
  "rejected",
] as const;

export const MODERATION_STATUSES = ["approved", "pending", "rejected"] as const;
