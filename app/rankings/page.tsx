"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Row = {
  id?: string;
  created_at?: string;
  athlete_name?: string | null;
  hq_score?: number | string | null; // still using existing column in DB
  rank?: string | null;
  archetype?: string | null;
};

type Player = {
  place: number;
  id: string;
  name: string;
  score: number;
  tier: string;
  archetype: string;
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

const TIER_META: Record<
  string,
  { pill: string; glow?: string; label: string }
> = {
  "WORLD CLASS": {
    label: "WORLD CLASS",
    pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.18)]",
  },
  ELITE: {
    label: "ELITE",
    pill: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    glow: "shadow-[0_0_40px_rgba(56,189,248,0.14)]",
  },
  ADVANCED: {
    label: "ADVANCED",
    pill: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    glow: "shadow-[0_0_40px_rgba(167,139,250,0.12)]",
  },
  INTERMEDIATE: {
    label: "INTERMEDIATE",
    pill: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.10)]",
  },
  NOVICE: {
    label: "NOVICE",
    pill: "border-white/10 bg-white/[0.03] text-zinc-300",
  },
  "—": {
    label: "—",
    pill: "border-white/10 bg-white/[0.03] text-zinc-300",
  },
};

export default function RankingsPage() {
  const [rows, setRows] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // UI controls
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("submissions")
        .select("id,created_at,athlete_name,hq_score,rank,archetype")
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
        score: Number(safeNumber(item.hq_score).toFixed(1)),
        tier: (item.rank ?? "—").toString(),
        archetype: (item.archetype ?? "—").toString(),
      }));

      setRows(formatted);
      setLoading(false);
    }

    fetchRankings();
  }, []);

  const totalCount = rows.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.archetype.toLowerCase().includes(q) ||
        p.tier.toLowerCase().includes(q);

      const matchesTier =
        tierFilter === "ALL" ? true : p.tier === tierFilter;

      return matchesQuery && matchesTier;
    });
  }, [rows, query, tierFilter]);

  const topThree = filtered.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 font-sans antialiased selection:bg-emerald-400/25">
      {/* BACKGROUND */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.18),_transparent_60%)] blur-2xl" />
        <div className="absolute top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_60%)] blur-2xl" />
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
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-zinc-400">
              Sorted by <span className="text-zinc-200 font-semibold">Hybrid Score</span> (0–100).
              Search names, filter tiers, and compare archetypes.
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

        {/* Controls */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Search
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search athlete, tier, or archetype…"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
              />
              <div className="mt-1 text-[11px] text-zinc-500">
                Showing{" "}
                <span className="text-zinc-200 font-semibold">{filtered.length}</span>{" "}
                of{" "}
                <span className="text-zinc-200 font-semibold">{totalCount}</span>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Tier
              </label>
              <div className="relative">
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-11 text-sm text-white outline-none transition hover:bg-white/[0.04] focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
                >
                  <option value="ALL">All tiers</option>
                  <option value="WORLD CLASS">World Class</option>
                  <option value="ELITE">Elite</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="NOVICE">Novice</option>
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-300" fill="none">
                      <path
                        d="M7 10l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Filter by tier label.
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Reset
              </label>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTierFilter("ALL");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
              >
                Clear
              </button>
              <div className="mt-1 text-[11px] text-zinc-500">
                Back to defaults.
              </div>
            </div>
          </div>
        </div>

        {/* Loading / error */}
        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-zinc-400">Loading leaderboard…</div>
          </div>
        ) : err ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-zinc-300 font-semibold">Couldn’t load rankings</div>
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
                const meta = TIER_META[p.tier] ?? TIER_META["—"];
                const isFirst = p.place === 1;

                return (
                  <div
                    key={p.id}
                    className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center ${
                      isFirst ? meta.glow ?? "" : ""
                    }`}
                  >
                    <div aria-hidden className="absolute inset-0">
                      <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.14),_transparent_62%)] blur-2xl" />
                      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.65)_55%,rgba(2,2,3,0.96)_100%)]" />
                    </div>

                    {isFirst && (
                      <div className="absolute right-3 top-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                        Leader
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Rank</div>
                      <div className="mt-1 text-4xl font-semibold text-white">#{p.place}</div>

                      <div className="mt-4 text-xl font-semibold text-white">{p.name}</div>

                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest ${meta.pill}`}
                        >
                          {meta.label}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-400">
                          {p.archetype}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                          Hybrid Score
                        </div>
                        <div className="mt-1 font-mono text-3xl text-emerald-300">
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
              <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Leaderboard
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Showing <span className="text-zinc-200 font-semibold">{filtered.length}</span>{" "}
                    athletes
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500">
                  Sorted by score (highest first)
                </div>
              </div>

              <table className="w-full text-left">
                <thead className="bg-black/40 text-[10px] uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Athlete</th>
                    <th className="px-6 py-4 hidden md:table-cell">Tier</th>
                    <th className="px-6 py-4 hidden md:table-cell">Archetype</th>
                    <th className="px-6 py-4 text-right">Hybrid Score</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filtered.map((p) => {
                    const meta = TIER_META[p.tier] ?? TIER_META["—"];
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.04] transition">
                        <td className="px-6 py-4 font-semibold text-zinc-400">
                          #{p.place}
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-white font-semibold">{p.name}</div>
                          <div className="mt-1 md:hidden flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-widest ${meta.pill}`}
                            >
                              {meta.label}
                            </span>
                            <span className="inline-flex rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-zinc-400">
                              {p.archetype}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 hidden md:table-cell">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest ${meta.pill}`}
                          >
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-6 py-4 hidden md:table-cell text-zinc-400">
                          {p.archetype}
                        </td>

                        <td className="px-6 py-4 text-right font-mono text-emerald-300">
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