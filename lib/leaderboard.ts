// The public leaderboard's rules — ONE definition, shared by /rankings and the
// calculator's placement (POST /api/score).
//
// PURE MODULE — no database, HTTP, environment, or React dependencies, so the
// rankings view can import the display sort and tests can cover every rule.
//
// A result is ranked only when it is:
//   * approved (pending and rejected results never receive a placement);
//   * public (private and unlisted results never do);
//   * scored against the ACTIVE frozen dataset version; and
//   * scored with the CURRENT score version.
// Legacy rows have no dataset version, so they can never match. The frozen
// reference dataset used for percentiles is a separate population and is never
// listed here.

import { competitionRank } from "@/lib/scoring/core/formulas";

/** The comparable population: both IDs must match. */
export type LeaderboardScope = {
  datasetVersionId: string;
  scoreVersion: string;
};

/** How many ranked results /rankings renders. Counts always cover them all. */
export const LEADERBOARD_PAGE_SIZE = 200;

/** Whether a saved result belongs on the leaderboard for this scope. */
export function isLeaderboardEligible(
  result: {
    moderationStatus: string;
    visibility: string;
    datasetVersionId: string | null;
    scoreVersion: string | null;
  },
  scope: LeaderboardScope,
): boolean {
  return (
    result.moderationStatus === "approved" &&
    result.visibility === "public" &&
    result.datasetVersionId === scope.datasetVersionId &&
    result.scoreVersion === scope.scoreVersion
  );
}

/** A leaderboard row as the server reads it. `id` never leaves the server. */
export type LeaderboardSourceRow = {
  id: string;
  name: string;
  score: number;
  tier: string;
  archetype: string;
  createdAt: string;
};

/** What the page receives: public display fields plus the score rank. */
export type LeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
  tier: string;
  archetype: string;
  createdAt: string;
};

function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/**
 * Deterministic leaderboard order: Hybrid Score descending, then the earlier
 * result first, then row id. Ties keep their shared rank; this only fixes the
 * order they are listed in.
 */
export function compareLeaderboardRows(
  a: LeaderboardSourceRow,
  b: LeaderboardSourceRow,
): number {
  if (b.score !== a.score) return b.score - a.score;
  const byTime = timeOf(a.createdAt) - timeOf(b.createdAt);
  // NaN only when both timestamps are unreadable: fall through to the id.
  if (byTime !== 0 && !Number.isNaN(byTime)) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Order rows and assign competition ranks (1, 2, 2, 4): a result's rank is one
 * more than the number of results scoring strictly higher — exactly the rule
 * competitionRank applies to calculator placement.
 *
 * Correct for the first N rows of the full ordered population too: every
 * result that outscores one of them is itself among them.
 */
export function rankLeaderboard(rows: LeaderboardSourceRow[]): LeaderboardEntry[] {
  const ordered = [...rows].sort(compareLeaderboardRows);
  let rank = 0;
  return ordered.map((row, i) => {
    if (i === 0 || row.score !== ordered[i - 1].score) rank = i + 1;
    return {
      rank,
      name: row.name,
      score: row.score,
      tier: row.tier,
      archetype: row.archetype,
      createdAt: row.createdAt,
    };
  });
}

/**
 * Calculator placement from two database counts: one more than the number of
 * eligible results scoring strictly higher, out of all eligible results.
 * Identical to competitionRank over the full population (tests pin this), but
 * never needs the population's scores — so no API row limit can truncate it.
 */
export function placementFromCounts(
  strictlyHigher: number,
  total: number,
): { rank: number; total: number } {
  return { rank: strictlyHigher + 1, total };
}

/** The same rule over an in-memory list of scores. Used to cross-check. */
export function placementFor(
  scores: number[],
  score: number,
): { rank: number; total: number } {
  return { rank: competitionRank(scores, score), total: scores.length };
}

export type LeaderboardSort = "SCORE_DESC" | "NEWEST" | "NAME_ASC";

/**
 * Re-order for display. The rank is the score rank and never changes with the
 * sort: sorting by name does not make the first name "#1".
 */
export function sortLeaderboard(
  entries: LeaderboardEntry[],
  sort: LeaderboardSort,
): LeaderboardEntry[] {
  const out = [...entries];
  if (sort === "NEWEST") {
    out.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt) || a.rank - b.rank);
  } else if (sort === "NAME_ASC") {
    out.sort((a, b) => a.name.localeCompare(b.name) || a.rank - b.rank);
  }
  // SCORE_DESC: already in leaderboard order.
  return out;
}

/**
 * The count line. Rows are RESULTS — one athlete may appear more than once —
 * and the total always covers the whole eligible population, not just the
 * rows rendered.
 */
export function leaderboardCountText(shown: number, total: number): string {
  const n = (x: number) => x.toLocaleString("en-US");
  const noun = total === 1 ? "result" : "results";
  return shown < total
    ? `Showing the top ${n(shown)} of ${n(total)} ranked ${noun}`
    : `${n(total)} ranked ${noun}`;
}
