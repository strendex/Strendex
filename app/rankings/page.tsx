// /rankings — the public leaderboard, rendered on the server.
//
// Group 3: the leaderboard is read with the service role through
// lib/server/rankings.ts instead of a browser query with the public key. It
// lists ONLY approved, public results scored against the active frozen dataset
// with the current score version — the same rule calculator placement uses
// (lib/leaderboard.ts). Legacy rows and the reference dataset are never listed.

import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { loadRankings, type RankingsData } from "@/lib/server/rankings";
import RankingsView from "./RankingsView";

// Read at request time: never at build, and never a stale cached board.
export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  let data: RankingsData;
  try {
    data = await loadRankings(getSupabaseAdmin());
  } catch {
    // Missing server configuration — same honest state as a failed read.
    data = { status: "unavailable" };
  }
  return <RankingsView data={data} />;
}
