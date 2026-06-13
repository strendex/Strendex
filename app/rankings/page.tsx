"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Row = {
  id?: string;
  created_at?: string;
  athlete_name?: string | null;
  hq_score?: number | string | null;
  rank?: string | null;
  archetype?: string | null;
  status?: "approved" | "pending" | "rejected" | string | null;
};

type Player = {
  place: number;
  id: string;
  name: string;
  score: number;
  tier: string;
  archetype: string;
  created_at?: string;
};

function safeName(v: any) {
  if (typeof v === "string") {
    const s = v.trim().replace(/\s+/g, " ");
    return s.length >= 2 ? s : "Anonymous Athlete";
  }
  return "Anonymous Athlete";
}

function safeNumber(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Neutral outline chip + lime dot — matches the athlete card we shipped.
const TIER_PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-semibold tracking-widest text-zinc-300";
const ARCHETYPE_PILL =
  "inline-flex items-center rounded-full border border-white/10 bg-black/30 text-[10px] font-semibold tracking-widest text-zinc-400";

export default function RankingsPage() {
  const [rows, setRows] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // UI control
  const [sortBy, setSortBy] = useState<"SCORE_DESC" | "NEWEST" | "NAME_ASC">(
    "SCORE_DESC",
  );

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("submissions")
        .select("id,created_at,athlete_name,hq_score,rank,archetype,status")
        .eq("status", "approved") // ONLY show verified rows
        .not("hq_score", "is", null)
        .order("hq_score", { ascending: false })
        .limit(200);

      if (error) {
        console.error(error);
        setErr(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const list = (data as Row[] | null) ?? [];

      const formatted: Player[] = list.map((item: Row, index: number) => ({
        place: index + 1,
        id: String(item.id ?? `${index}`),
        name: safeName(item.athlete_name),
        score: Math.round(safeNumber(item.hq_score)),
        tier: (item.rank ?? "—").toString(),
        archetype: (item.archetype ?? "—").toString(),
        created_at: item.created_at,
      }));

      setRows(formatted);
      setLoading(false);
    }

    fetchRankings();
  }, []);

  const filtered = useMemo(() => {
    const out = [...rows];

    // Sort
    out.sort((a, b) => {
      if (sortBy === "NEWEST") {
        const am = (a as any).created_at
          ? Date.parse((a as any).created_at)
          : 0;
        const bm = (b as any).created_at
          ? Date.parse((b as any).created_at)
          : 0;
        return bm - am;
      }
      if (sortBy === "NAME_ASC") return a.name.localeCompare(b.name);
      // SCORE_DESC default
      return b.score - a.score;
    });

    // Recompute places AFTER sorting (so rank column matches what they see)
    return out.map((p, i) => ({ ...p, place: i + 1 }));
  }, [rows, sortBy]);

  const topThree = filtered.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 font-sans antialiased selection:bg-[#DFFF00]/20">
      {/* BACKGROUND */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(223,255,0,0.10),_transparent_60%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.70)_55%,rgba(2,2,3,0.98)_100%)]" />
      </div>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              Rankings
            </div>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-white">
              Global leaderboard
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Rankings include simulated data during early access.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tool"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black hover:bg-zinc-200 transition"
            >
              Calculate Hybrid Score →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
            >
              Home
            </Link>
          </div>
        </div>

        {/* Loading / error */}
        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-zinc-400">Loading leaderboard…</div>
          </div>
        ) : err ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-zinc-300 font-semibold">
              Couldn’t load rankings
            </div>
            <div className="mt-2 text-sm text-zinc-400">{err}</div>
            <div className="mt-4">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition"
              >
                Calculate Hybrid Score →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {topThree.map((p) => {
                const isFirst = p.place === 1;

                return (
                  <div
                    key={p.id}
                    className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center ${
                      isFirst
                        ? "shadow-[0_0_40px_rgba(223,255,0,0.12)]"
                        : ""
                    }`}
                  >
                    <div aria-hidden className="absolute inset-0">
                      <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(223,255,0,0.10),_transparent_62%)] blur-2xl" />
                      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.65)_55%,rgba(2,2,3,0.96)_100%)]" />
                    </div>

                    {isFirst && (
                      <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
                        Leader
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                        Rank
                      </div>
                      <div className="mt-1 text-4xl font-semibold text-white">
                        #{p.place}
                      </div>

                      <div className="mt-4 text-xl font-semibold text-white">
                        {p.name}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        <span className={`${TIER_PILL} px-3 py-1`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
                          {p.tier}
                        </span>
                        <span className={`${ARCHETYPE_PILL} px-3 py-1`}>
                          {p.archetype}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                          Hybrid Score
                        </div>
                        <div className="mt-1 font-mono text-3xl text-[#DFFF00]">
                          {p.score}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="flex flex-col items-start gap-3 border-b border-white/10 bg-black/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Leaderboard
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Showing{" "}
                    <span className="text-zinc-200 font-semibold">
                      {filtered.length}
                    </span>{" "}
                    athletes
                  </div>
                </div>

                <div className="w-full sm:w-44">
                  <label
                    htmlFor="sort"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500"
                  >
                    Sort
                  </label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition hover:bg-white/[0.04] focus:border-[#DFFF00]/50 focus:ring-2 focus:ring-[#DFFF00]/10"
                  >
                    <option value="SCORE_DESC">Highest score</option>
                    <option value="NEWEST">Newest</option>
                    <option value="NAME_ASC">Name A–Z</option>
                  </select>
                </div>
              </div>

              {/* MOBILE list — visible only below md */}
              <div className="md:hidden divide-y divide-white/10">
                {filtered.map((p) => {
                  const isTop3 = p.place <= 3;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.03] transition"
                    >
                      {/* Rank */}
                      <div className="shrink-0 w-9 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            isTop3 ? "text-white" : "text-zinc-500"
                          }`}
                        >
                          #{p.place}
                        </span>
                      </div>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {p.name}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className={`${TIER_PILL} px-2 py-0.5`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
                            {p.tier}
                          </span>
                          <span className={`${ARCHETYPE_PILL} px-2 py-0.5`}>
                            {p.archetype}
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">
                          Score
                        </div>
                        <div className="text-lg font-semibold text-[#DFFF00]">
                          {p.score}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP table — hidden below md */}
              <table className="hidden md:table w-full text-left">
                <thead className="bg-black/40 text-[10px] uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Athlete</th>
                    <th className="px-6 py-4">Tier</th>
                    <th className="px-6 py-4">Archetype</th>
                    <th className="px-6 py-4 text-right">Hybrid Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((p) => {
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-white/[0.04] transition"
                      >
                        <td className="px-6 py-4 font-semibold text-zinc-400">
                          #{p.place}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          {p.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`${TIER_PILL} px-3 py-1`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
                            {p.tier}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {p.archetype}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-[#DFFF00]">
                          {p.score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-white/10 bg-black/30 px-6 py-4 text-center text-xs text-zinc-600 tracking-widest uppercase">
                Rankings update automatically from the Strendex database
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
