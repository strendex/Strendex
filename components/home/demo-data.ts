/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MARKETING DEMO VALUES — ONE FICTIONAL ATHLETE, NOT A REAL SUBMISSION.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One illustrative athlete, used consistently across the homepage so the page
 * reads as a single worked example.
 *
 * ── Why this module still does not import lib/scoring ──────────────────────
 * The canonical scoring engine is server-side and is the only thing permitted
 * to produce a real Hybrid Score. This module must never import from
 * `lib/scoring`, never call `/api/score`, `/api/submit` or `/api/rank`, and
 * never touch Supabase.
 *
 * ── But the values are no longer invented ──────────────────────────────────
 * Everything derivable is derived by the real engine and pinned by
 * tests/demoData.test.ts, which imports both this file and
 * `lib/scoring/core` and fails if they ever disagree. That test is what makes
 * these constants trustworthy without a runtime dependency.
 *
 * This caught a live drift: the page showed a Hybrid Score of 64 while
 * canonicalScoreFromPercentiles(72, 58) returns 65.
 *
 * The two percentiles are the one pair of numbers the engine cannot derive
 * from the inputs alone — a percentile is a position within a reference
 * population, and the dataset backing Strendex is currently simulated. They
 * are therefore illustrative INPUTS to the example, and every surface that
 * shows them labels the example as fictional.
 */

/** Raw benchmark inputs. Kilograms, matching the engine's internal unit. */
export const DEMO_INPUTS = {
  bodyweightKg: 82,
  strength: [
    { label: "Bench", value: "110", unit: "kg" },
    { label: "Squat", value: "150", unit: "kg" },
    { label: "Deadlift", value: "190", unit: "kg" },
  ],
  endurance: [{ label: "5K", value: "22:10", unit: "" }],
} as const;

export const DEMO = {
  name: "Alex",

  /* Engine-derived from the inputs above — see tests/demoData.test.ts.
     computeStrengthIndex({ bodyweightKg: 82, bench: 110, squat: 150,
     deadlift: 190 }) = 73.2; computeEnduranceIndex(half-equivalent of a
     22:10 5K, 6118s) = 70.9. */
  strengthIndex: 73.2,
  enduranceIndex: 70.9,

  /* Illustrative positions within the simulated reference population. */
  strengthPercentile: 72,
  endurancePercentile: 58,

  /* Engine-derived from the percentiles above.
     canonicalScoreFromPercentiles(72, 58) = 65
     getTier(65)                           = "ADVANCED"
     getArchetype(72, 58)                  = "STRENGTH-LEANING HYBRID" */
  hybridScore: 65,
  tier: "ADVANCED",
  archetype: "STRENGTH-LEANING HYBRID",

  /** Sentence-case archetype, for running text. */
  profile: "Strength-leaning hybrid",

  /**
   * Position on a strength↔endurance axis, 0 = fully endurance-leaning,
   * 100 = fully strength-leaning. Presentation only: a linear mapping of the
   * percentile gap the engine already produces (50 + (72 − 58) / 2), not an
   * engine output of its own.
   */
  lean: 57,
} as const;

/** Which side is holding the profile back, and by how much. */
export const DEMO_LIMITER = {
  side: "Endurance",
  gap: DEMO.strengthPercentile - DEMO.endurancePercentile,
} as const;

/**
 * Ordinal suffix for the illustrative percentile readings. Kept here beside the
 * values it formats so the two homepage sections that render them cannot drift
 * apart again — an earlier version hard-coded "th" and printed "72th".
 */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/** Sections an Athlete Review currently produces, described accurately. */
export const REVIEW_SECTIONS = [
  {
    title: "Where you stand",
    summary: "Your score, your balance, and the percentile context behind both.",
  },
  {
    title: "Your highest-leverage improvement",
    summary:
      "The part of your current profile with the most room to move the score.",
    highlight: true,
  },
  {
    title: "What to keep doing",
    summary: "The parts of your performance already supporting the profile.",
  },
  {
    title: "Estimated score scenarios",
    summary:
      "See how changes to your lifts or run would affect your Hybrid Score.",
  },
] as const;

/**
 * Illustrative standings. Handles are obviously non-identifying placeholders,
 * not real accounts.
 */
export const DEMO_LEADERBOARD = [
  { rank: 12, handle: "Athlete 012", score: 81 },
  { rank: 13, handle: "Athlete 013", score: 79 },
  { rank: 14, handle: "Alex (example)", score: DEMO.hybridScore, isYou: true },
  { rank: 15, handle: "Athlete 015", score: 62 },
] as const;
