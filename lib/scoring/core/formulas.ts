// Canonical scoring formulas.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// These are the ONLY implementations of the strength index, endurance index,
// percentile, Hybrid Score, tier, archetype, and competition rank. Both the
// legacy v1 surface (lib/scoring) and the canonical v2 pipeline call into here,
// so the two can never drift.

import {
  DATASET_CONFIDENCE_THRESHOLDS,
  ENDURANCE_INDEX_MAX_SEC,
  ENDURANCE_INDEX_MIN_SEC,
  SCORE_WEIGHTS,
  STRENGTH_RATIO_THRESHOLDS,
} from "./constants";
import type { Archetype, DatasetConfidence, Tier } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Midrank ("average rank") percentile: ties share the midpoint of the ranks
 * they span. Returns 50 for an empty population, matching v1.
 */
export function percentileMidrank(values: number[], v: number): number {
  const clean = values.filter((x) => Number.isFinite(x));
  const N = clean.length;
  if (N <= 0) return 50;

  let less = 0;
  let equal = 0;

  for (const x of clean) {
    if (x < v) less++;
    else if (x === v) equal++;
  }

  const p = ((less + 0.5 * equal) / N) * 100;
  return clamp(Number(p.toFixed(1)), 0, 100);
}

/**
 * Piecewise lift-ratio curve: 0-40 up to `mid`, 40-70 up to `strong`,
 * 70-95 up to `elite`, then a shallow 95-100 tail.
 */
export function strengthScoreFromRatio(
  ratio: number,
  mid: number,
  strong: number,
  elite: number,
) {
  if (ratio <= 0) return 0;
  if (ratio <= mid) return clamp((ratio / mid) * 40, 0, 40);
  if (ratio <= strong) {
    return 40 + clamp(((ratio - mid) / (strong - mid)) * 30, 0, 30);
  }
  if (ratio <= elite) {
    return 70 + clamp(((ratio - strong) / (elite - strong)) * 25, 0, 25);
  }
  return 95 + clamp((ratio - elite) * 10, 0, 5);
}

/**
 * Mean of the entered lifts' piecewise indexes.
 *
 * Nulls are tolerated for the legacy v1 surface only; the canonical pipeline
 * rejects a missing event before reaching here, so a missing lift can never
 * improve a ranked score.
 */
export function computeStrengthIndex(input: {
  bodyweightKg: number;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
}): number {
  const { bodyweightKg: bw, benchKg: bench, squatKg: squat, deadliftKg: deadlift } =
    input;

  const bRatio = bench !== null ? bench / bw : 0;
  const sRatio = squat !== null ? squat / bw : 0;
  const dRatio = deadlift !== null ? deadlift / bw : 0;

  const b = STRENGTH_RATIO_THRESHOLDS.bench;
  const s = STRENGTH_RATIO_THRESHOLDS.squat;
  const d = STRENGTH_RATIO_THRESHOLDS.deadlift;

  const bIdx =
    bench !== null ? strengthScoreFromRatio(bRatio, b.mid, b.strong, b.elite) : 0;
  const sIdx =
    squat !== null ? strengthScoreFromRatio(sRatio, s.mid, s.strong, s.elite) : 0;
  const dIdx =
    deadlift !== null
      ? strengthScoreFromRatio(dRatio, d.mid, d.strong, d.elite)
      : 0;

  const strengthParts = [bIdx, sIdx, dIdx].filter((x) => x > 0);
  return strengthParts.length > 0
    ? Number(
        (
          strengthParts.reduce((a, b2) => a + b2, 0) / strengthParts.length
        ).toFixed(1),
      )
    : 0;
}

/** Linear index over canonical (half-marathon-equivalent) seconds. */
export function computeEnduranceIndex(enduranceSeconds: number | null): number {
  return Number(
    (enduranceSeconds !== null
      ? clamp(
          ((ENDURANCE_INDEX_MAX_SEC - enduranceSeconds) /
            (ENDURANCE_INDEX_MAX_SEC - ENDURANCE_INDEX_MIN_SEC)) *
            100,
          0,
          100,
        )
      : 0
    ).toFixed(1),
  );
}

/** Hybrid Score = 50% strength percentile + 50% endurance percentile. */
export function canonicalScoreFromPercentiles(
  strengthPercentile: number,
  endurancePercentile: number,
): number {
  const sp = clamp(strengthPercentile, 0, 100);
  const ep = clamp(endurancePercentile, 0, 100);

  const raw = SCORE_WEIGHTS.strength * sp + SCORE_WEIGHTS.endurance * ep;

  return clamp(Math.round(raw), 0, 100);
}

export function getTier(score: number): Tier {
  if (score >= 90) return "WORLD CLASS";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "NOVICE";
}

export function getArchetype(
  strengthPercentile: number,
  endurancePercentile: number,
): Archetype {
  if (strengthPercentile < 10 && endurancePercentile < 10) {
    return "BASE BUILDER";
  }

  const diff = strengthPercentile - endurancePercentile;

  if (strengthPercentile >= 75 && endurancePercentile >= 75) {
    return "POWER HYBRID";
  }
  if (diff >= 20) return "STRENGTH BEAST";
  if (diff <= -20) return "ENDURANCE MACHINE";
  if (Math.abs(diff) <= 8) return "BALANCED HYBRID";
  if (diff > 0) return "STRENGTH-LEANING HYBRID";
  return "ENDURANCE-LEANING HYBRID";
}

/**
 * Competition ranking (1, 2, 2, 4): position is one plus the number of strictly
 * better scores, so tied athletes share a place and the next place is skipped.
 */
export function competitionRank(scores: number[], score: number): number {
  let better = 0;
  for (const s of scores) {
    if (Number.isFinite(s) && s > score) better++;
  }
  return better + 1;
}

export function datasetConfidence(sampleSize: number): DatasetConfidence {
  if (sampleSize >= DATASET_CONFIDENCE_THRESHOLDS.high) return "high";
  if (sampleSize >= DATASET_CONFIDENCE_THRESHOLDS.established) {
    return "established";
  }
  return "provisional";
}
