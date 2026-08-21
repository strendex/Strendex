/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MARKETING DEMO VALUES — NOT REAL DATA, NOT A REAL SCORE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One illustrative athlete, used consistently from the hero to the leaderboard
 * so the page reads as a single worked example.
 *
 * These values are DELIBERATELY NOT computed. This module must never import
 * from `lib/scoring`, never call `/api/score`, `/api/submit` or `/api/rank`,
 * and never touch Supabase. The canonical scoring engine is server-side and is
 * the only thing permitted to produce a real Hybrid Score.
 *
 * The dataset backing Strendex is currently simulated, so no surface built from
 * this file may imply that real athletes or real submissions exist.
 */

export const DEMO = {
  name: "Alex",
  hybridScore: 64,
  strengthPercentile: 72,
  endurancePercentile: 58,
  profile: "Strength-leaning hybrid",
  /** 0 = fully endurance-leaning, 100 = fully strength-leaning. */
  lean: 62,
  plain:
    "Alex’s strength is ahead of his endurance, making endurance the limiting side of the profile.",
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

/** Illustrative inputs shown converging into the score in the hero model. */
export const DEMO_INPUTS = {
  strength: [
    { label: "Bench", value: "110" },
    { label: "Squat", value: "150" },
    { label: "Deadlift", value: "190" },
  ],
  endurance: [{ label: "5K", value: "22:10" }],
} as const;

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
  { rank: 14, handle: "Alex (example)", score: 64, isYou: true },
  { rank: 15, handle: "Athlete 015", score: 62 },
] as const;
