// Canonical scoring — all weights in kg, endurance in half-marathon-equivalent seconds.

export const SCORE_WEIGHTS = {
  strength: 0.5,
  endurance: 0.5,
} as const;

const ENDURANCE_INDEX_MIN_SEC = 4200; // 1:10:00
const ENDURANCE_INDEX_MAX_SEC = 10800; // 3:00:00
const MIN_ENDURANCE_SAMPLE = 30;

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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

  const bIdx =
    bench !== null ? strengthScoreFromRatio(bRatio, 0.75, 1.25, 1.75) : 0;
  const sIdx =
    squat !== null ? strengthScoreFromRatio(sRatio, 1.0, 1.75, 2.5) : 0;
  const dIdx =
    deadlift !== null ? strengthScoreFromRatio(dRatio, 1.25, 2.25, 3.0) : 0;

  const strengthParts = [bIdx, sIdx, dIdx].filter((x) => x > 0);
  return strengthParts.length > 0
    ? Number(
        (
          strengthParts.reduce((a, b) => a + b, 0) / strengthParts.length
        ).toFixed(1),
      )
    : 0;
}

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

export function canonicalScoreFromPercentiles(
  strengthPercentile: number,
  endurancePercentile: number,
): number {
  const sp = clamp(strengthPercentile, 0, 100);
  const ep = clamp(endurancePercentile, 0, 100);

  const raw = SCORE_WEIGHTS.strength * sp + SCORE_WEIGHTS.endurance * ep;

  return clamp(Math.round(raw), 0, 100);
}

export function getTier(score: number) {
  if (score >= 90) return "WORLD CLASS";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "NOVICE";
}

export function getArchetype(
  strengthPercentile: number,
  endurancePercentile: number,
) {
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
      dataset.enduranceScores.length >= MIN_ENDURANCE_SAMPLE
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
