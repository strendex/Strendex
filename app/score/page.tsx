'use client';
import React, { useState } from 'react';

export default function ScorePage() {
  const [stats, setStats] = useState({ weight: '', squat: '', bench: '', deadlift: '', run: '' });
  const [score, setScore] = useState<number | null>(null);

  const calculate = () => {
    const w = parseFloat(stats.weight) || 0;
    const s = parseFloat(stats.squat) || 0;
    const b = parseFloat(stats.bench) || 0;
    const d = parseFloat(stats.deadlift) || 0;
    const r = parseFloat(stats.run) || 20;
    if (w > 0) {
      const result = ((s + b + d) / w) * (20 / r);
      setScore(Number(result.toFixed(2)));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Navigation */}
      <nav className="border-b border-white/5 p-6 sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black italic tracking-tighter text-blue-500">
            STRENDEX<span className="text-white not-italic">.LAB</span>
          </h1>
          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-bold border border-zinc-800 px-4 py-2 rounded-full">
            System Active
          </div>
        </div>
      </nav>

      {/* SECTION 1: THE TOOL */}
      <main className="max-w-6xl mx-auto p-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start mb-32">
          
          <div className="space-y-8">
            <div>
              <h2 className="text-5xl font-extrabold tracking-tight mb-4">
                The <span className="text-blue-500 italic">Hybrid</span> <br/>Quotient.
              </h2>
              <p className="text-zinc-400 text-lg">Quantifying the intersection of raw strength and aerobic power.</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-[#0a0a0a] px-2 text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Bodyweight (LBS)</label>
                <input type="number" placeholder="000" className="w-full bg-transparent border border-zinc-800 p-4 rounded-xl text-xl outline-none focus:border-blue-500 transition-all text-white" onChange={(e) => setStats({...stats, weight: e.target.value})} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {['squat', 'bench', 'deadlift'].map((lift) => (
                  <div key={lift} className="relative">
                    <label className="absolute -top-2 left-3 bg-[#0a0a0a] px-2 text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{lift}</label>
                    <input type="number" placeholder="0" className="w-full bg-transparent border border-zinc-800 p-4 rounded-xl text-lg outline-none focus:border-blue-500 transition-all text-white" onChange={(e) => setStats({...stats, [lift]: e.target.value})} />
                  </div>
                ))}
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-3 bg-[#0a0a0a] px-2 text-[10px] text-zinc-500 uppercase font-bold tracking-widest">5K Run Time (Min)</label>
                <input type="number" placeholder="20.0" className="w-full bg-transparent border border-zinc-800 p-4 rounded-xl text-xl outline-none focus:border-blue-500 transition-all text-white" onChange={(e) => setStats({...stats, run: e.target.value})} />
              </div>

              <button onClick={calculate} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95">
                Run Analysis
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] p-12 flex flex-col items-center justify-center min-h-[500px] text-center shadow-2xl">
            {score ? (
              <div>
                <p className="text-blue-500 font-bold tracking-[0.3em] text-xs uppercase mb-4">Analysis Complete</p>
                <div className="text-[10rem] font-black italic leading-none mb-6 text-white">{score}</div>
                <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full mb-6"></div>
                <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold">Category: Tactical Hybrid</p>
              </div>
            ) : (
              <p className="text-zinc-700 font-bold uppercase tracking-widest">Input Metrics to Begin</p>
            )}
          </div>
        </div>

        {/* SECTION 2: THE RANKINGS */}
        <section className="py-24 border-t border-white/5">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Performance <span className="text-blue-500 text-italic">Tiers</span></h3>
            <p className="text-zinc-500">Where do you stand among the world's most versatile athletes?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { tier: 'Elite', score: '6.0+', desc: 'Professional level hybrid capacity', color: 'text-blue-500' },
              { tier: 'Advanced', score: '4.5 - 5.9', desc: 'Superior strength-to-weight ratio', color: 'text-white' },
              { tier: 'Intermediate', score: '3.0 - 4.4', desc: 'Well-rounded fitness enthusiast', color: 'text-zinc-400' },
              { tier: 'Novice', score: '< 3.0', desc: 'Foundation building phase', color: 'text-zinc-600' },
            ].map((item) => (
              <div key={item.tier} className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-2xl">
                <h4 className={`text-xl font-black italic mb-1 ${item.color}`}>{item.tier}</h4>
                <div className="text-2xl font-bold mb-4 text-white">{item.score}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: THE FORMULA */}
        <section className="py-24 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h3 className="text-4xl font-bold">Science behind the <span className="italic text-blue-500">Quotient</span></h3>
            <p className="text-zinc-400 leading-relaxed">
              Strendex doesn't just reward raw strength. It calculates your Strength-to-Weight Ratio and multiplies it by your Aerobic Velocity.
            </p>
            <div className="space-y-4 text-sm font-mono text-zinc-500 bg-black/40 p-6 rounded-xl border border-zinc-800">
              <div className="flex justify-between border-b border-zinc-800 pb-2"><span>Strength:</span> <span>(S + B + D) / BW</span></div>
              <div className="flex justify-between border-b border-zinc-800 pb-2"><span>Endurance:</span> <span>20 / 5K_Time</span></div>
              <div className="flex justify-between text-blue-500 pt-2 font-bold uppercase"><span>Final:</span> <span>Strength * Endurance</span></div>
            </div>
          </div>
          <div className="bg-zinc-900/40 aspect-square rounded-[3rem] border border-zinc-800 flex items-center justify-center">
             <div className="text-center">
                <div className="text-6xl mb-4">⚡️</div>
                <div className="text-sm font-bold tracking-widest text-zinc-500 uppercase">Balanced Power</div>
             </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 text-center text-zinc-600 text-[10px] uppercase tracking-[0.5em]">
        © 2026 Strendex Performance Lab.
      </footer>
    </div>
  );
}