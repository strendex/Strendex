"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Row = {
  athlete_name: string | null;
  hq_score: number | null;
  rank: string | null;
};

export default function LeaderboardPreview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("submissions")
        .select("athlete_name,hq_score,rank")
        .order("hq_score", { ascending: false })
        .limit(5);

      if (!mounted) return;

      if (error || !data) {
        setRows([]);
      } else {
        setRows(data as Row[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Live</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Top HQ Today</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Real submissions from the global database.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/tool"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition"
            >
              Get my HQ →
            </Link>
            <Link
              href="/rankings"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
            >
              Full rankings
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 p-4 md:p-6">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
              Loading leaderboard…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
              No submissions yet — be the first to set the standard.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {rows.map((r, i) => {
                const name = (r.athlete_name || "").trim() || "Anonymous";
                const score =
                  typeof r.hq_score === "number" && Number.isFinite(r.hq_score)
                    ? r.hq_score.toFixed(1)
                    : "—";
                const tier = (r.rank || "").trim() || "—";

                return (
                  <div
                    key={`${name}-${i}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                        #{i + 1}
                      </div>
                      <div className="text-[10px] font-semibold tracking-widest text-zinc-300">
                        {tier}
                      </div>
                    </div>

                    <div className="mt-2 truncate text-base font-semibold text-white">
                      {name}
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                        HQ Score
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-white">
                        {score}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-xs text-zinc-500">
            Tip: higher HQ = better. Rankings update as athletes submit.
          </div>
        </div>
      </div>
    </section>
  );
}