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
  plain: "Alex's strength currently sits ahead of his endurance.",
} as const;

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
    summary: "The single change most likely to move your score.",
    highlight: true,
  },
  {
    title: "What to keep doing",
    summary: "The parts of your training already carrying the profile.",
  },
  {
    title: "Estimated score scenarios",
    summary: "Projections calculated from your own numbers.",
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
