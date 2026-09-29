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
 * language: what the score blends, what a percentile actually measures, and what
 * the comparison group is. No column names, no dataset labels, no version
 * strings.
 *
 * THREE THINGS THIS COPY MUST NOT SAY, each of which it said before:
 *
 *   1. That the benchmark grows or sharpens as athletes are added. It does not.
 *      Scoring runs against a FIXED, frozen reference set, and a new submission
 *      cannot move anyone's percentile. Saying otherwise described the old
 *      live-query behaviour that Group 1 removed.
 *   2. That the comparison group is self-reported, or that it is verified real
 *      athletes. For a legacy mixed set it is neither: it blends seeded and real
 *      entries whose origin cannot be told apart. Claiming either is a false
 *      statement about the data.
 *   3. That a percentile is the share of athletes you are "ahead of". The
 *      percentile is a MIDRANK: anyone you tie with counts as half. So it is the
 *      share you are ahead of plus half the share you match, which is not the
 *      same number and is why a lone athlete scores 50 rather than 0.
 *
 * Wording is kept tight on purpose; the broader copy pass is Group 5.
 */
export function scoreExplanation(result: ScoreResultView): string[] {
  const mixedOrigin = result.datasetKind === "legacy_mixed_provisional";
  const earlySample = result.datasetConfidence === "provisional";

  return [
    "Your Hybrid Score (0–100) is an equal blend of your strength and endurance percentiles — half each. The score itself is not a percentile: a 75 does not mean you beat 75% of anyone.",
    "Strength looks at your bench, squat and deadlift adjusted for your bodyweight. Endurance compares the run you entered.",
    // Midrank, stated as such: ahead of, plus half of those you match.
    `A percentile places you within a fixed comparison group: it counts everyone you beat, plus half of anyone you tie with. Your endurance ${result.endurancePercentile.toFixed(1)}% means that, measured that way, you sit above ${result.endurancePercentile.toFixed(1)}% of that group on endurance.`,
    // The benchmark is fixed. No growth claim, in either branch.
    "Everyone is measured against the same fixed Strendex benchmark, so your score does not move when other athletes are added.",
    // One qualification line. It never calls a mixed set "verified" and never
    // calls it "self-reported" either — both are false about a population that
    // blends real entries with sample data. The athlete's own numbers are
    // unchecked in every case, so that caveat is never dropped.
    mixedOrigin
      ? "That benchmark is an early set we can't individually confirm — part real entries, part sample data — so read it as a rough guide. Your own numbers aren't checked either."
      : earlySample
        ? "That benchmark is still a small, early set, so read it as a rough guide. Your own numbers aren't checked either."
        : "Your own numbers aren't checked — they're shown as you entered them.",
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

  // Visibility first: a private result is never on the leaderboard, whatever
  // its moderation state, so it must not be told it is awaiting review for it.
  if (result.visibility === "private") {
    return "This result is private, so it isn't on the public leaderboard.";
  }
  if (result.visibility !== "public") {
    return "This result isn't on the public leaderboard.";
  }

  if (result.moderationStatus === "pending") {
    return "Saved — top scores get a quick review before they appear on the leaderboard.";
  }

  if (result.moderationStatus === "rejected") {
    return "This result was not approved for the leaderboard.";
  }

  // Approved and public, yet no placement: scored against an older dataset,
  // or placement could not be loaded. Never claim it is unlisted, never guess.
  if (result.moderationStatus === "approved") {
    return "Leaderboard placement isn't available for this result right now.";
  }

  return "This result is not shown on the leaderboard.";
}

/**
 * The short status line after a save. Visibility is checked before moderation,
 * for the same reason as leaderboardExclusion.
 */
export function savedStatusText(result: ScoreResultView, replayed: boolean): string {
  if (result.visibility !== "public") {
    return replayed
      ? "Already saved privately — showing your existing result."
      : "Saved privately — it isn't on the public leaderboard.";
  }
  if (result.moderationStatus === "pending") {
    return "Saved — top scores get a quick review before they appear on the leaderboard.";
  }
  return replayed ? "Already saved — showing your existing result." : "Saved.";
}

/**
 * The single leaderboard line on the results screen. A rank and total appear
 * ONLY when the server returned a placement; otherwise the line says why there
 * is none. It never shows a percentage, so it cannot be mistaken for the
 * benchmark percentiles, which measure against a different population.
 */
export function placementLine(
  result: ScoreResultView,
): { ranked: true; rank: number; total: number; text: string } | { ranked: false; text: string } {
  const standing = leaderboardStanding(result);
  if (standing) {
    const noun = standing.total === 1 ? "public result" : "public results";
    return {
      ranked: true,
      rank: standing.rank,
      total: standing.total,
      text: `Leaderboard placement: #${standing.rank} of ${standing.total.toLocaleString("en-US")} ${noun}`,
    };
  }
  // An unusable placement (e.g. total 0) is treated exactly like none.
  return {
    ranked: false,
    text:
      leaderboardExclusion({ ...result, leaderboard: null }) ??
      "This result is not shown on the leaderboard.",
  };
}
