// Canonical benchmark validation.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
//
// Rules:
//  - a leaderboard-eligible benchmark needs bodyweight, bench, squat, deadlift,
//    and a supported run distance + time. A missing event is an error, never a
//    zero, so it can never improve a score;
//  - NaN, Infinity, non-numbers, negatives, and out-of-range values are rejected
//    with a typed error rather than silently clamped;
//  - all conversions are recomputed here from the ORIGINAL values. Anything the
//    client already converted or calculated is ignored.

import {
  DISPLAY_NAME,
  IDEMPOTENCY_KEY,
  MAX_LIFT_RATIO,
  UNIT_SYSTEMS,
  VALIDATION_BOUNDS,
  VISIBILITIES,
} from "./constants";
import { ScoringError } from "./errors";
import {
  RUN_DISTANCES,
  isRunDistance,
  toCanonicalEnduranceSeconds,
  toKilograms,
} from "./units";
import type {
  CanonicalBenchmark,
  RunDistance,
  UnitSystem,
  Visibility,
} from "./types";

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOnlyAllowedKeys(
  obj: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(obj).every((key) => allowedKeys.includes(key));
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ScoringError(
      "INVALID_NUMBER",
      `${field} must be a finite number.`,
      field,
    );
  }
  if (value <= 0) {
    throw new ScoringError(
      "OUT_OF_RANGE",
      `${field} must be greater than zero.`,
      field,
    );
  }
  return value;
}

function requirePresent(value: unknown, field: string): unknown {
  if (value === null || value === undefined) {
    throw new ScoringError(
      "MISSING_EVENT",
      `${field} is required for a ranked benchmark.`,
      field,
    );
  }
  return value;
}

function requireWithin(
  value: number,
  bounds: { min: number; max: number },
  field: string,
): number {
  if (value < bounds.min || value > bounds.max) {
    throw new ScoringError(
      "OUT_OF_RANGE",
      `${field} is outside the supported range.`,
      field,
    );
  }
  return value;
}

export function parseUnitSystem(value: unknown): UnitSystem {
  if (
    typeof value !== "string" ||
    !(UNIT_SYSTEMS as readonly string[]).includes(value)
  ) {
    throw new ScoringError(
      "UNSUPPORTED_UNIT_SYSTEM",
      "Unit system must be 'lb' or 'kg'.",
      "unit_system",
    );
  }
  return value as UnitSystem;
}

export function parseRunDistance(value: unknown): RunDistance {
  if (!isRunDistance(value)) {
    throw new ScoringError(
      "UNSUPPORTED_DISTANCE",
      "Run distance must be one of 3mi, 5k, 10k, half, marathon.",
      "run_distance",
    );
  }
  return value;
}

/** Absent visibility means private — never public by accident. */
export function parseVisibility(
  value: unknown,
  fallback: Visibility,
): Visibility {
  if (value === null || value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !(VISIBILITIES as readonly string[]).includes(value)
  ) {
    throw new ScoringError(
      "INVALID_VISIBILITY",
      "Visibility must be 'private', 'unlisted', or 'public'.",
      "visibility",
    );
  }
  return value as Visibility;
}

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new ScoringError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency key must be a string.",
      "idempotency_key",
    );
  }
  const key = value.trim();
  if (
    key.length < IDEMPOTENCY_KEY.minLength ||
    key.length > IDEMPOTENCY_KEY.maxLength ||
    !IDEMPOTENCY_KEY.pattern.test(key)
  ) {
    throw new ScoringError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency key must be 8-128 url-safe characters.",
      "idempotency_key",
    );
  }
  return key;
}

/** Trimmed, length-capped display name. Profanity filtering is a caller concern. */
export function parseDisplayName(value: unknown): string {
  if (value === null || value === undefined) return DISPLAY_NAME.fallback;
  if (typeof value !== "string") {
    throw new ScoringError(
      "INVALID_DISPLAY_NAME",
      "Display name must be a string.",
      "display_name",
    );
  }
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return DISPLAY_NAME.fallback;
  if (cleaned.length < DISPLAY_NAME.minLength) {
    throw new ScoringError(
      "INVALID_DISPLAY_NAME",
      "Display name must be at least 2 characters.",
      "display_name",
    );
  }
  return cleaned.slice(0, DISPLAY_NAME.maxLength);
}

function checkRatio(
  liftKg: number,
  bodyweightKg: number,
  max: number,
  field: string,
): void {
  if (liftKg / bodyweightKg > max) {
    throw new ScoringError(
      "IMPLAUSIBLE_RATIO",
      `${field}-to-bodyweight ratio looks unrealistic.`,
      field,
    );
  }
}

/**
 * Validate a complete benchmark and produce the canonical, server-converted
 * form. Throws ScoringError on the first problem found.
 */
export function parseCanonicalBenchmark(input: {
  unitSystem: unknown;
  bodyweight: unknown;
  bench: unknown;
  squat: unknown;
  deadlift: unknown;
  runDistance: unknown;
  runSeconds: unknown;
}): CanonicalBenchmark {
  const unitSystem = parseUnitSystem(input.unitSystem);

  const bodyweight = requireFiniteNumber(
    requirePresent(input.bodyweight, "bodyweight"),
    "bodyweight",
  );
  const bench = requireFiniteNumber(
    requirePresent(input.bench, "bench"),
    "bench",
  );
  const squat = requireFiniteNumber(
    requirePresent(input.squat, "squat"),
    "squat",
  );
  const deadlift = requireFiniteNumber(
    requirePresent(input.deadlift, "deadlift"),
    "deadlift",
  );

  const runDistance = parseRunDistance(
    requirePresent(input.runDistance, "run_distance"),
  );
  const runSeconds = requireFiniteNumber(
    requirePresent(input.runSeconds, "run_seconds"),
    "run_seconds",
  );

  if (!Number.isInteger(runSeconds)) {
    throw new ScoringError(
      "INVALID_NUMBER",
      "Run time must be a whole number of seconds.",
      "run_seconds",
    );
  }

  const distanceWindow = RUN_DISTANCES[runDistance];
  requireWithin(
    runSeconds,
    { min: distanceWindow.minSeconds, max: distanceWindow.maxSeconds },
    "run_seconds",
  );

  // Server-side conversion. The client's converted values are never used.
  const bodyweightKg = requireWithin(
    toKilograms(bodyweight, unitSystem),
    VALIDATION_BOUNDS.bodyweightKg,
    "bodyweight",
  );
  const benchKg = requireWithin(
    toKilograms(bench, unitSystem),
    VALIDATION_BOUNDS.benchKg,
    "bench",
  );
  const squatKg = requireWithin(
    toKilograms(squat, unitSystem),
    VALIDATION_BOUNDS.squatKg,
    "squat",
  );
  const deadliftKg = requireWithin(
    toKilograms(deadlift, unitSystem),
    VALIDATION_BOUNDS.deadliftKg,
    "deadlift",
  );

  checkRatio(benchKg, bodyweightKg, MAX_LIFT_RATIO.bench, "bench");
  checkRatio(squatKg, bodyweightKg, MAX_LIFT_RATIO.squat, "squat");
  checkRatio(deadliftKg, bodyweightKg, MAX_LIFT_RATIO.deadlift, "deadlift");

  const canonicalEnduranceSeconds = requireWithin(
    toCanonicalEnduranceSeconds(runSeconds, runDistance),
    VALIDATION_BOUNDS.canonicalEnduranceSeconds,
    "run_seconds",
  );

  return {
    unitSystem,
    bodyweightKg,
    benchKg,
    squatKg,
    deadliftKg,
    runDistance,
    runSeconds,
    canonicalEnduranceSeconds,
  };
}
