"use client";
import { useState } from "react";
import Link from "next/link";
import StrendexChart from "./StrendexChart";
import { supabase } from "../../lib/supabaseClient";

export default function ScorePage() {
  const [weight, setWeight] = useState(0);
  const [bench, setBench] = useState(0);
  const [squat, setSquat] = useState(0);
  const [deadlift, setDeadlift] = useState(0);
  const [fiveK, setFiveK] = useState(0); 
  const [isSaving, setIsSaving] = useState(false);

  // 1. CALCULATIONS
  const totalLift = bench + squat + deadlift;
  const strengthRatio = weight > 0 ? totalLift / weight : 0;
  const enduranceFactor = fiveK > 0 ? (100 / fiveK) / 5 : 0;
  const hqScore = Number((strengthRatio + enduranceFactor).toFixed(1));

  // 2. NORMALIZATION FOR THE GRAPH (Scale of 0-100)
  // These "Max" numbers represent a "100%" score for the graph visual only
  const chartData = [
    { subject: 'Bench', value: Math.min(100, (bench / (weight * 1.5)) * 100) || 0 },
    { subject: 'Squat', value: Math.min(100, (squat / (weight * 2)) * 100) || 0 },
    { subject: 'Deadlift', value: Math.min(100, (deadlift / (weight * 2.5)) * 100) || 0 },
    { subject: '5K Pace', value: fiveK > 0 ? Math.max(0, 100 - (fiveK * 2)) : 0 },
  ];

  // 3. RANKING LOGIC
  const getRank = (score: number) => {
    if (score >= 6) return "WORLD CLASS";
    if (score >= 4.5) return "ELITE";
    if (score >= 3) return "ADVANCED";
    if (score >= 1.5) return "INTERMEDIATE";
    return "NOVICE";
  };

  const currentRank = getRank(hqScore);

  async function saveSubmission() {
    if (hqScore === 0) return alert("Enter some stats first!");
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .insert([{ bodyweight: weight, fivek_seconds: fiveK * 60, squat, bench, deadlift }]);

      if (error) alert(`Error: ${error.message}`);
      else alert("Score Logged to HQ Database.");
    } catch (err) {
      alert("System error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-4 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/10 pb-8">
          <div>
          <Link href="/" className="hover:opacity-80 transition-opacity">
  <h1 className="text-3xl font-black tracking-tighter text-white">
    STRENDEX <span className="text-emerald-500">HQ v2</span>
  </h1>
</Link>            <p className="text-slate-500 text-sm uppercase tracking-widest mt-1">Human Performance Database</p>
          </div>
          <div className="mt-6 md:mt-0 text-right">
            <div className="text-7xl font-black text-white leading-none">{hqScore}</div>
            <div className="text-emerald-500 font-bold text-xs tracking-[0.4em] uppercase">{currentRank}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1: INPUTS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                VITAL STATS
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Body Weight (lbs)</label>
                  <input type="number" onChange={(e) => setWeight(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 p-3 rounded-lg focus:border-emerald-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">5K Time (Minutes)</label>
                  <input type="number" onChange={(e) => setFiveK(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 p-3 rounded-lg focus:border-emerald-500 outline-none transition-all" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl">
              <h3 className="text-white font-bold mb-4">STRENGTH METRICS</h3>
              <div className="space-y-4">
                {['Bench', 'Squat', 'Deadlift'].map((lift) => (
                  <div key={lift}>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block text-left">{lift} (lbs)</label>
                    <input 
                      type="number" 
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if(lift === 'Bench') setBench(val);
                        if(lift === 'Squat') setSquat(val);
                        if(lift === 'Deadlift') setDeadlift(val);
                      }} 
                      className="w-full bg-black/50 border border-white/10 p-3 rounded-lg focus:border-emerald-500 outline-none transition-all" 
                    />
                  </div>
                ))}
              </div>
              <button 
                onClick={saveSubmission}
                disabled={isSaving}
                className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-lg tracking-widest text-xs transition-all disabled:opacity-50"
              >
                {isSaving ? "TRANSMITTING..." : "LOG DATA TO CLOUD"}
              </button>
            </div>
          </div>

          {/* COLUMN 2 & 3: VISUALS & STANDARDS */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900/20 border border-white/5 rounded-3xl p-8 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute top-4 left-6 text-[10px] text-slate-600 font-mono tracking-tighter">RADAR_PROFILE_SCAN: ACTIVE</div>
               <StrendexChart data={chartData} />
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4">Rank</th>
                    <th className="p-4">Score Range</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {[
                    { label: "WORLD CLASS", range: "6.0+", color: "text-emerald-400" },
                    { label: "ELITE", range: "4.5 - 5.9", color: "text-blue-400" },
                    { label: "ADVANCED", range: "3.0 - 4.4", color: "text-purple-400" },
                    { label: "INTERMEDIATE", range: "1.5 - 2.9", color: "text-amber-400" },
                    { label: "NOVICE", range: "0.0 - 1.4", color: "text-slate-500" },
                  ].map((row) => (
                    <tr key={row.label} className={currentRank === row.label ? "bg-emerald-500/10" : ""}>
                      <td className={`p-4 font-bold ${row.color}`}>{row.label}</td>
                      <td className="p-4">{row.range}</td>
                      <td className="p-4 text-[10px]">
                        {currentRank === row.label ? "● CURRENT_USER" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}