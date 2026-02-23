"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LeaderboardPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      const { data, error } = await supabase
        .from("scores") // This must match your Supabase table name
        .select("*")
        .order("hq_score", { ascending: false }) // Highest scores first
        .limit(20);

      if (error) console.error("Error fetching scores:", error);
      else setScores(data || []);
      setLoading(false);
    }
    fetchScores();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-6 md:p-10 pt-32">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">GLOBAL RANKINGS</h1>
          <p className="text-emerald-500 font-mono text-[10px] tracking-[0.3em] uppercase">Verified Performance Data</p>
        </div>

        {loading ? (
          <div className="text-slate-600 font-mono text-sm animate-pulse italic">Accessing database...</div>
        ) : (
          <div className="space-y-3">
            {/* Table Header */}
            <div className="grid grid-cols-4 px-6 py-2 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase border-b border-white/5">
              <span>Rank</span>
              <span>Athlete</span>
              <span className="text-center">HQ Score</span>
              <span className="text-right">Date</span>
            </div>

            {/* Score Rows */}
            {scores.map((score, index) => (
              <div 
                key={score.id} 
                className="grid grid-cols-4 items-center px-6 py-5 bg-white/5 border border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group"
              >
                <div className="font-black text-2xl text-slate-700 group-hover:text-emerald-500/50 transition-colors">
                  #{index + 1}
                </div>
                <div className="text-white font-bold tracking-tight uppercase">
                  {score.athlete_name || "Anonymous"}
                </div>
                <div className="text-center font-mono font-black text-emerald-500 text-xl">
                  {score.hq_score?.toFixed(2)}
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono">
                  {new Date(score.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}