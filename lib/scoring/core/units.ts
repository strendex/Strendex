// Unit and running-distance conversion.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// Every conversion the browser performs is repeated here, server-side, from the
// athlete's original values. Client-converted values are never trusted.

import { ScoringError } from "./errors";

export const POUNDS_PER_KILOGRAM = 2.2046226218;

export const RUN_DISTANCE_IDS = ["3mi", "5k", "10k", "half", "marathon"] as const;

type RunDistanceId = (typeof RUN_DISTANCE_IDS)[number];

/**
 * Supported calculator distances, in metres, with plausibility windows for the
 * originally entered time. These are coarse sanity guards; the binding limit is
 * the canonical endurance window in VALIDATION_BOUNDS.
 */
export const RUN_DISTANCES: Record<
  RunDistanceId,
  { readonly metres: number; readonly minSeconds: number; readonly maxSeconds: number }
> = {
  "3mi": { metres: 4828.032, minSeconds: 660, maxSeconds: 10800 },
  "5k": { metres: 5000, minSeconds: 700, maxSeconds: 10800 },
  "10k": { metres: 10000, minSeconds: 1500, maxSeconds: 18000 },
  half: { metres: 21097.5, minSeconds: 3300, maxSeconds: 28800 },
  marathon: { metres: 42195, minSeconds: 6900, maxSeconds: 43200 },
} as const;

/** The distance every run time is normalised to. */
export const CANONICAL_RUN_DISTANCE: RunDistanceId = "half";

/**
 * Riegel exponent. Preserved from the v1 calculator (1.06) — centralised here so
 * there is exactly one copy and it is covered by tests.
 */
export const RIEGEL_EXPONENT = 1.06;

export function isRunDistance(value: unknown): value is RunDistanceId {
  return (
    typeof value === "string" &&
    (RUN_DISTANCE_IDS as readonly string[]).includes(value)
  );
}

export function distanceMetres(distance: RunDistanceId): number {
  return RUN_DISTANCES[distance].metres;
}

export function poundsToKilograms(pounds: number): number {
  if (!Number.isFinite(pounds)) {
    throw new ScoringError(
      "INVALID_NUMBER",
      "Weight must be a finite number.",
      "weight",
    );
  }
  return pounds / POUNDS_PER_KILOGRAM;
}

export function kilogramsToPounds(kilograms: number): number {
  if (!Number.isFinite(kilograms)) {
    throw new ScoringError(
      "INVALID_NUMBER",
      "Weight must be a finite number.",
      "weight",
    );
  }
  return kilograms * POUNDS_PER_KILOGRAM;
}

/** Convert a weight in the athlete's chosen unit system to kilograms. */
export function toKilograms(value: number, unitSystem: "lb" | "kg"): number {
  return unitSystem === "lb" ? poundsToKilograms(value) : value;
}

/**
 * Riegel conversion of a run time to the canonical (half marathon) equivalent.
 * T2 = T1 * (D2 / D1) ^ 1.06
 */
export function toCanonicalEnduranceSeconds(
  seconds: number,
  distance: RunDistanceId,
): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new ScoringError(
      "INVALID_NUMBER",
      "Run time must be a positive, finite number of seconds.",
      "runSeconds",
    );
  }
  if (!isRunDistance(distance)) {
    throw new ScoringError(
      "UNSUPPORTED_DISTANCE",
      "Unsupported running distance.",
      "runDistance",
    );
  }

  const ratio =
    distanceMetres(CANONICAL_RUN_DISTANCE) / distanceMetres(distance);

  return Math.round(seconds * Math.pow(ratio, RIEGEL_EXPONENT));
}
