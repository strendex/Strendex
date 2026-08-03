// Legacy v1 scoring surface — used by /api/rank, /api/submit, the Athlete
// Review, and the seed script.
//
// DEPRECATED (remove in Group 3): once the calculator is migrated to
// POST /api/score, this module and its callers should be deleted in favour of
// "@/lib/scoring/core". Nothing new should import from here.
//
// The formulas themselves are NOT duplicated: every function below delegates to
// lib/scoring/core/formulas, so v1 and v2 can never drift. The only behaviour
// kept here that core deliberately does not have is `computeScore`'s tolerance
// of partial benchmarks and its small-sample endurance fallback, both of which
// current production depends on.

import { MIN_DATASET_SIZE, SCORE_WEIGHTS } from "./core/constants";
import {
  canonicalScoreFromPercentiles,
  clamp,
  computeEnduranceIndex,
  computeStrengthIndex,
  getArchetype,
  getTier,
  percentileMidrank,
  strengthScoreFromRatio,
} from "./core/formulas";

export {
  SCORE_WEIGHTS,
  clamp,
  percentileMidrank,
  strengthScoreFromRatio,
  computeStrengthIndex,
  computeEnduranceIndex,
  canonicalScoreFromPercentiles,
  getTier,
  getArchetype,
};

export type ScoringInput = {
  bodyweightKg: number;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  enduranceSeconds: number | null;
};

export type ScoringDataset = {
  strengthScores: number[];
  enduranceScores: number[];
};

export type ScoringResult = {
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
  hq: number;
  tier: string;
  archetype: string;
};

/**
 * @deprecated Group 3 — use computeCanonicalScore from "@/lib/scoring/core".
 * Kept byte-for-byte behaviour-compatible with the shipped v1 endpoint,
 * including the below-minimum-sample endurance fallback.
 */
export function computeScore(
  input: ScoringInput,
  dataset: ScoringDataset,
): ScoringResult {
  const strengthIndex = computeStrengthIndex({
    bodyweightKg: input.bodyweightKg,
    benchKg: input.benchKg,
    squatKg: input.squatKg,
    deadliftKg: input.deadliftKg,
  });

  const enduranceIndex = computeEnduranceIndex(input.enduranceSeconds);

  const strengthPercentile = percentileMidrank(
    dataset.strengthScores,
    strengthIndex,
  );

  let endurancePercentile = 0;
  if (input.enduranceSeconds !== null) {
    endurancePercentile =
      dataset.enduranceScores.length >= MIN_DATASET_SIZE
        ? percentileMidrank(dataset.enduranceScores, enduranceIndex)
        : enduranceIndex;
  }

  const hq = canonicalScoreFromPercentiles(
    strengthPercentile,
    endurancePercentile,
  );

  return {
    strengthIndex,
    enduranceIndex,
    strengthPercentile,
    endurancePercentile,
    hq,
    tier: getTier(hq),
    archetype: getArchetype(strengthPercentile, endurancePercentile),
  };
}

/**
 * @deprecated Group 3 — reference populations come from an immutable
 * scoring_dataset_versions row, not from a live query of `submissions`.
 */
export function buildScoringDataset(
  rows: {
    strength_index: number | null;
    endurance_index: number | null;
    endurance_seconds: number | null;
  }[],
): ScoringDataset {
  const strengthScores = rows
    .map((r) => Number(r.strength_index))
    .filter((n) => Number.isFinite(n) && n > 0);

  const enduranceScores = rows
    .filter(
      (r) =>
        r.endurance_seconds !== null &&
        Number.isFinite(Number(r.endurance_index)) &&
        Number(r.endurance_index) > 0,
    )
    .map((r) => Number(r.endurance_index));

  return { strengthScores, enduranceScores };
}
