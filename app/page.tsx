"use client";
import Link from "next/link";

export default function HomePage() {
  return (
<div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-4 md:p-10 pt-32">
      {/* 1. HERO SECTION */}
      <section className="h-screen flex flex-col items-center justify-center text-center px-4 relative overflow-hidden border-b border-white/5">
        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]"></div>

        <div className="z-10">
          <div className="inline-block px-3 py-1 border border-emerald-500/30 rounded-full bg-emerald-500/5 mb-6">
            <span className="text-[10px] text-emerald-500 font-bold tracking-[0.3em] uppercase">System Status: Operational</span>
          </div>
          <h1 className="text-7xl md:text-9xl font-black ...">
  STRENDEX <span className="text-emerald-500 italic">HQ</span>
</h1>
<p className="...">Quantifying the ultimate...</p>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed uppercase tracking-[0.15em] font-light">
            Quantifying the ultimate hybrid athlete <br /> through proprietary data analysis.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <Link href="/score" className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-all hover:scale-105 active:scale-95 tracking-widest text-xs">
              LAUNCH CALCULATOR
            </Link>
            <button onClick={() => document.getElementById('about')?.scrollIntoView({behavior: 'smooth'})} className="px-10 py-4 bg-transparent border border-white/10 hover:bg-white/5 text-white font-black rounded-lg transition-all tracking-widest text-xs">
              VIEW STANDARDS
            </button>
          </div>
        </div>

        {/* HUD Decoration */}
        <div className="absolute bottom-8 left-8 hidden md:block text-[10px] font-mono text-slate-600 space-y-1">
          <p>LAT: 34.0522° N</p>
          <p>LONG: 118.2437° W</p>
          <p>STRENDEX_CORE_v2.0.4</p>
        </div>
      </section>

      {/* 2. THE THREE PILLARS SECTION */}
      <section id="about" className="max-w-7xl mx-auto py-32 px-6">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { title: "POWER", desc: "Absolute strength metrics across the 'Big Three' lifts, normalized to bodyweight." },
            { title: "PACE", desc: "Cardiovascular efficiency measured via the 5,000m standard." },
            { title: "RATIO", desc: "The Strendex proprietary algorithm balancing force production with aerobic capacity." }
          ].map((item, i) => (
            <div key={i} className="group p-8 bg-slate-900/20 border border-white/5 rounded-2xl hover:border-emerald-500/50 transition-colors">
              <div className="text-emerald-500 font-black text-4xl mb-4 opacity-20 group-hover:opacity-100 transition-opacity">0{i+1}</div>
              <h3 className="text-white font-bold text-xl mb-3 tracking-tight">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. PERFORMANCE TIERS (The "Realism" Part) */}
      <section className="bg-white/5 py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">THE HIERARCHY</h2>
            <p className="text-slate-500 uppercase tracking-widest text-xs">Where do you rank in the global dataset?</p>
          </div>
          
          <div className="space-y-4">
            {[
              { rank: "WORLD CLASS", score: "6.0+", req: "Top 0.1% of Hybrid Athletes" },
              { rank: "ELITE", score: "4.5+", req: "Exceptional Strength & Engine" },
              { rank: "ADVANCED", score: "3.0+", req: "Proven Competitive Standard" },
              { rank: "NOVICE", score: "< 1.5", req: "The Baseline for Growth" }
            ].map((tier, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-black/40 border border-white/5 rounded-xl">
                <div>
                  <h4 className="text-white font-bold tracking-tight">{tier.rank}</h4>
                  <p className="text-[10px] text-slate-500 uppercase mt-1">{tier.req}</p>
                </div>
                <div className="text-emerald-500 font-mono font-bold">{tier.score}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. THE MISSION CONTROL CALL-TO-ACTION */}
      <section className="py-32 text-center px-6">
        <div className="max-w-3xl mx-auto bg-gradient-to-b from-emerald-600/20 to-transparent p-12 rounded-[3rem] border border-emerald-500/20">
          <h2 className="text-4xl font-black text-white mb-6">READY TO BENCHMARK?</h2>
          <p className="text-slate-400 mb-10 leading-relaxed">
            Stop guessing. Start measuring. Enter your stats into the HQ database and see your radar profile instantly.
          </p>
          <Link href="/score" className="inline-block px-12 py-5 bg-white text-black font-black rounded-full hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110">
            ACCESS TERMINAL
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-black px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-white font-black tracking-tighter">STRENDEX HQ</div>
          <div className="flex gap-8 text-[10px] text-slate-600 tracking-[0.2em] uppercase">
            <a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Database API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}