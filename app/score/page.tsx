"use client";
import { useState } from "react";
import StrendexChart from "./StrendexChart";

export default function ScorePage() {
  const [weight, setWeight] = useState(0);
  const [bench, setBench] = useState(0);
  const [squat, setSquat] = useState(0);
  const [deadlift, setDeadlift] = useState(0);
  const [fiveK, setFiveK] = useState(0);

  // Strendex Logic
  const totalLift = bench + squat + deadlift;
  const strengthRatio = weight > 0 ? totalLift / weight : 0;
  const enduranceFactor = fiveK > 0 ? (100 / fiveK) / 5 : 0;
  
  // The HQ Score (0 - 7.0 range)
  const numericScore = Number((strengthRatio + enduranceFactor).toFixed(1));

  const chartData = [
    { subject: 'Bench', value: bench },
    { subject: 'Squat', value: squat },
    { subject: 'Deadlift', value: deadlift },
    { subject: '5K Pace', value: fiveK > 0 ? Math.max(0, 40 - fiveK) : 0 },
  ];

  const categories = [
    { range: "0.0 - 2.0", label: "Novice", color: "text-slate-500" },
    { range: "2.1 - 3.5", label: "Intermediate", color: "text-blue-400" },
    { range: "3.6 - 5.0", label: "Advanced", color: "text-purple-400" },
    { range: "5.1 - 6.5", label: "Elite", color: "text-emerald-400" },
    { range: "6.6+", label: "World Class", color: "text-amber-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 p-8 pb-20">
      <div className="max-w-5xl mx-auto">
        
        {/* Top Header Section */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-2xl font-bold tracking-[0.2em] text-white">STRENDEX <span className="text-emerald-500 font-black">HQ</span></h1>
          <div className="text-right">
            <span className="text-8xl font-black text-white tracking-tighter">{numericScore}</span>
            <p className="text-xs text-emerald-500 font-bold uppercase tracking-[0.3em] mt-[-10px]">Current Rating</p>
          </div>
        </div>

        {/* Main Section: Inputs and Graph */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-900/30 border border-white/5 p-8 rounded-3xl backdrop-blur-md">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Biometrics & Performance</h3>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-slate-400">Body Weight</label>
                <input type="number" placeholder="lbs" onChange={(e) => setWeight(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-slate-400">5K Time</label>
                <input type="number" placeholder="min" onChange={(e) => setFiveK(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
            </div>
            
            <div className="space-y-4">
              <label className="text-[10px] uppercase text-slate-400">The Big Three (Lifts)</label>
              <input type="number" placeholder="Bench Press" onChange={(e) => setBench(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" />
              <input type="number" placeholder="Squat" onChange={(e) => setSquat(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" />
              <input type="number" placeholder="Deadlift" onChange={(e) => setDeadlift(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" />
            </div>
          </div>

          <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-8 flex items-center justify-center min-h-[400px]">
            <StrendexChart data={chartData} />
          </div>
        </div>

        {/* Comparison Section */}
        <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8 text-center">Strendex Classification Standards</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map((cat) => {
              const isActive = numericScore >= parseFloat(cat.range.split(' ')[0]) && (cat.range.includes('+') ? true : numericScore <= parseFloat(cat.range.split(' ')[2]));
              return (
                <div key={cat.label} className={`p-4 rounded-2xl border ${isActive ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/5 border-transparent'} transition-all duration-500`}>
                  <p className={`text-[10px] uppercase font-bold mb-1 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{cat.range}</p>
                  <p className={`text-lg font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{cat.label}</p>
                  {isActive && <div className="mt-2 h-1 w-full bg-emerald-500 rounded-full animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}