"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Submission = {
  id: string;
  athlete_name: string;
  hq_score: number;
  bodyweight: number | null;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
  endurance_seconds: number | null;
  created_at: string;
  status: "approved" | "pending" | "rejected";
};

export default function AdminReviewPage() {
  const [pending, setPending] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPending() {
    setLoading(true);
    const { data, error } = await supabase
      .from("submissions")
      .select("id, athlete_name, hq_score, bodyweight, bench, squat, deadlift, endurance_seconds, created_at, status")
      .eq("status", "pending")
      .order("hq_score", { ascending: false });

    if (error) {
      console.error(error);
      alert("Failed to load pending submissions.");
    } else {
      setPending((data ?? []) as Submission[]);
    }
    setLoading(false);
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("submissions")
      .update({ status: "approved", verified_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Approve failed.");
    } else {
      await loadPending();
    }
  }

  async function reject(id: string) {
    const note = prompt("Optional reason (leave blank if none):") ?? "";
    const { error } = await supabase
      .from("submissions")
      .update({ status: "rejected", admin_note: note, verified_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Reject failed.");
    } else {
      await loadPending();
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-white">Admin Review</h1>
      <p className="mt-2 text-white/60">Hybrid Score ≥ 90 entries are held for approval.</p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="text-white/60">No pending submissions.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{s.athlete_name}</div>
                    <div className="mt-1 text-sm text-white/60">
                      HQ: <span className="text-white font-semibold">{s.hq_score}</span>
                      {" • "}BW: {s.bodyweight ?? "—"}
                      {" • "}B/S/D: {s.bench ?? "—"} / {s.squat ?? "—"} / {s.deadlift ?? "—"}
                      {" • "}End(sec): {s.endurance_seconds ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-white/40">{new Date(s.created_at).toLocaleString()}</div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => approve(s.id)}
                      className="rounded-xl bg-[#DFFF00] px-3 py-2 text-xs font-semibold text-black"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reject(s.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}