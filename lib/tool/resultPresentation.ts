// How a saved result is described to the athlete.
//
// PURE MODULE — no React, no DOM, no environment access.
//
// Every value here is read off the SAVED result the server returned. Nothing is
// recomputed from what the athlete typed, and nothing claims more than the row
// supports: a provisional dataset is called provisional, a pending row is not
// called published, and an unverified row is never called verified.

import { REVIEW_THRESHOLD, clamp } from "@/lib/scoring/core";
import type { Visibility } from "@/lib/scoring/core";
import type { ScoreResultView } from "./scoreSubmission";

export type VisibilityOption = {
  value: Visibility;
  label: string;
  /** One line, shown next to the choice. */
  summary: string;
  /** The full consequence, shown under the selected choice. */
  detail: string;
};

/**
 * Private first, and private is the default. Each description states what
 * actually happens today — "unlisted" deliberately does not promise link
 * sharing, because no result link exists yet.
 */
export const VISIBILITY_OPTIONS: readonly VisibilityOption[] = [
  {
    value: "private",
    label: "Private",
    summary: "Only you, on this page",
    detail:
      "Your result is saved so it can be shown here, and nowhere else. It never appears on the leaderboard and no one else can load it.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    summary: "Off the leaderboard, hidden for now",
    detail:
      "Kept off the leaderboard, and hidden exactly like private: there is no result link to share yet, so today nobody else can see it either. It marks the result as one you would be willing to share by link if that is ever built.",
  },
  {
    value: "public",
    label: "Public",
    summary: "Listed on the public leaderboard",
    detail: `Your display name, Hybrid Score and placement appear on the public leaderboard. Scores of ${REVIEW_THRESHOLD} and above are held for a person to review first.`,
  },
] as const;

export function visibilityOption(value: Visibility): VisibilityOption {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === value) ??
    VISIBILITY_OPTIONS[0]
  );
}

export type DatasetDisclosure = {
  headline: string;
  body: string;
  /** True when the athlete must be told the benchmark is not settled. */
  provisional: boolean;
};

/**
 * What the percentiles were measured against.
 *
 * A `legacy_mixed_provisional` dataset is built from pre-governance rows whose
 * origin cannot be established — it mixes simulated athletes with early
 * self-entered numbers — and the product has to say so next to the score.
 */
export function datasetDisclosure(result: ScoreResultView): DatasetDisclosure {
  const population = `“${result.datasetLabel}” · ${result.datasetSampleSize.toLocaleString()} entries`;

  if (result.datasetKind === "legacy_mixed_provisional") {
    return {
      provisional: true,
      headline: "Provisional benchmark — legacy mixed data",
      body: `Measured against ${population}: a transitional reference set of entries that predate result governance. It mixes simulated athletes with early self-entered numbers and cannot be told apart, so treat this placement as provisional rather than verified.`,
    };
  }

  if (result.datasetConfidence === "provisional") {
    return {
      provisional: true,
      headline: "Early benchmark — small reference sample",
      body: `Measured against ${population}. The sample is still small, so percentiles will move as it grows.`,
    };
  }

  return {
    provisional: false,
    headline: "Measured against the Strendex reference set",
    body: `${population} · ${result.datasetConfidence} confidence.`,
  };
}

export type StatusNotice = { label: string; body: string };

/**
 * Where the row's numbers came from, as stored. Never inferred from the score:
 * a result is `self_reported` until a real verification process says otherwise.
 */
export function provenanceLabel(result: ScoreResultView): string {
  switch (result.provenance) {
    case "verified":
      return "Verified";
    case "reviewed":
      return "Reviewed";
    case "self_reported":
      return "Self-reported";
    case "simulated":
      return "Simulated";
    default:
      return "Unknown origin (legacy)";
  }
}

/** The stored moderation value, in words rather than as a raw column value. */
export function moderationLabel(result: ScoreResultView): string {
  switch (result.moderationStatus) {
    case "pending":
      return "Held for review";
    case "rejected":
      return "Not approved";
    default:
      return "Approved";
  }
}

/** Moderation state of the saved row. Null when nothing needs saying. */
export function moderationNotice(result: ScoreResultView): StatusNotice | null {
  if (result.moderationStatus === "pending") {
    return {
      label: "Held for review",
      body: `Scores of ${REVIEW_THRESHOLD} and above are checked by a person before they can be listed.`,
    };
  }

  if (result.moderationStatus === "rejected") {
    return {
      label: "Not approved",
      body: "This result was not approved for the leaderboard.",
    };
  }

  return null;
}

/**
 * Verification state. `approved` moderation has never meant "verified", and the
 * two are separate columns precisely so they stop being conflated.
 */
export function verificationNotice(result: ScoreResultView): StatusNotice {
  switch (result.verificationStatus) {
    case "verified":
      return { label: "Verified", body: "Confirmed by a review process." };
    case "in_review":
      return { label: "In review", body: "Verification is in progress." };
    case "rejected":
      return { label: "Verification rejected", body: "This result was not confirmed." };
    default:
      return {
        label: "Unverified",
        body: "Self-entered numbers. Nothing here has been verified.",
      };
  }
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
 * Why a result is not on the leaderboard, in the order the reasons apply.
 * Null when it is listed.
 */
export function leaderboardExclusion(result: ScoreResultView): string | null {
  if (result.leaderboard) return null;

  if (result.visibility !== "public") {
    return `Kept off the leaderboard because this result is ${result.visibility}. Choose “Public” before scoring to be listed.`;
  }

  if (result.moderationStatus === "pending") {
    return `Not listed yet: scores of ${REVIEW_THRESHOLD} and above are reviewed by a person first.`;
  }

  if (result.moderationStatus === "rejected") {
    return "Not listed: this result was not approved.";
  }

  return "Not listed on the leaderboard.";
}
