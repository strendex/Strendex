// How a saved result is described to the athlete.
//
// PURE MODULE — no React, no DOM, no environment access.
//
// Every value here is read off the SAVED result the server returned. Nothing is
// recomputed from what the athlete typed, and nothing claims more than the row
// supports: a provisional benchmark is called early, a pending row is not
// called listed, and self-reported numbers are never called verified.
//
// The results screen itself stays consumer-clean: dataset internals, versions,
// ids and moderation machinery live in the score explanation popover — one tap
// away, never occupying permanent screen space, never omitted.

import { clamp } from "@/lib/scoring/core";
import type { ScoreResultView } from "./scoreSubmission";

/**
 * The score explanation shown behind the "?" beside the Hybrid Score.
 *
 * This is ALSO the benchmark disclosure, so it must stay honest in plain
 * language: what the score blends, what a percentile means, and that today's
 * comparison data is early and self-reported. No column names, no dataset
 * labels, no version strings.
 */
export function scoreExplanation(result: ScoreResultView): string[] {
  const provisional =
    result.datasetKind === "legacy_mixed_provisional" ||
    result.datasetConfidence === "provisional";

  return [
    "Your Hybrid Score (0–100) blends relative strength and endurance, half and half.",
    "Strength looks at your bench, squat and deadlift adjusted for your bodyweight. Endurance compares the run you entered.",
    `A percentile is the share of athletes in the current comparison group your result beats — your endurance ${result.endurancePercentile.toFixed(1)}% means you're ahead of ${result.endurancePercentile.toFixed(1)}% of them on endurance.`,
    provisional
      ? "That comparison group is still early and provisional, so placements will shift and sharpen as more athletes are added."
      : "That comparison group keeps growing, so placements sharpen over time.",
    "Results are self-reported unless verified.",
  ];
}

export type LeaderboardStanding = {
  rank: number;
  total: number;
  /** Share of the listed population this result is ahead of. */
  beatPercent: number;
};

/** Placement, straight from the server. Null whenever the row is not listed. */
export function leaderboardStanding(
  result: ScoreResultView,
): LeaderboardStanding | null {
  const board = result.leaderboard;
  if (!board || board.total <= 0) return null;

  return {
    rank: board.rank,
    total: board.total,
    beatPercent: Number(
      clamp(((board.total - board.rank) / board.total) * 100, 0, 100).toFixed(1),
    ),
  };
}

/**
 * One plain-language line for a result that is not on the leaderboard yet.
 * Null when it is listed. Moderation is preserved, just not worn as a badge:
 * a pending row says a review is happening, not "moderationStatus: pending".
 */
export function leaderboardExclusion(result: ScoreResultView): string | null {
  if (result.leaderboard) return null;

  if (result.moderationStatus === "pending") {
    return "Saved — top scores get a quick review before they appear on the leaderboard.";
  }

  if (result.moderationStatus === "rejected") {
    return "This result was not approved for the leaderboard.";
  }

  // Defensive: the calculator always submits publicly, but the SAVED row is
  // the authority — if it ever comes back non-public, say only what is true.
  return "This result is not shown on the leaderboard.";
}
