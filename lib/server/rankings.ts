// Server-side data for /rankings.
//
// Reads with the service role, so the page no longer needs public SELECT on
// `submissions`, and returns ONLY the public leaderboard fields (name, score,
// tier, archetype, date, rank). No id, raw input, moderation or idempotency
// data ever reaches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEADERBOARD_PAGE_SIZE,
  rankLeaderboard,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import { SCORE_VERSION } from "@/lib/scoring/core";
import {
  createSupabaseScoreRepository,
  loadLeaderboardPage,
} from "./scoreRepository";

export type RankingsData =
  | { status: "ok"; total: number; entries: LeaderboardEntry[] }
  /** No active dataset, or the leaderboard could not be read safely. */
  | { status: "unavailable" };

export async function loadRankings(
  supabase: SupabaseClient,
  limit: number = LEADERBOARD_PAGE_SIZE,
): Promise<RankingsData> {
  try {
    const dataset = await createSupabaseScoreRepository(supabase).loadActiveDataset(
      SCORE_VERSION,
    );
    if (!dataset) return { status: "unavailable" };

    const page = await loadLeaderboardPage(
      supabase,
      { datasetVersionId: dataset.datasetVersionId, scoreVersion: SCORE_VERSION },
      limit,
    );
    return { status: "ok", total: page.total, entries: rankLeaderboard(page.rows) };
  } catch (error) {
    // Never surface database detail to the page.
    console.error(
      "[/rankings] leaderboard unavailable:",
      error instanceof Error ? error.name : "unknown",
    );
    return { status: "unavailable" };
  }
}
