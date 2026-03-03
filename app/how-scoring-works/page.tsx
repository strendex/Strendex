export const metadata = {
    title: "How Scoring Works | STRENDEX",
    description:
      "Understand how STRENDEX Hybrid Score is calculated using strength and endurance percentiles.",
  };
  
  export default function HowScoringWorksPage() {
    return (
      <main className="min-h-screen bg-[#020203] text-zinc-200">
        {/* Background */}
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(223,255,0,0.16),_transparent_60%)] blur-2xl" />
          <div className="absolute top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_60%)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.70)_55%,rgba(2,2,3,0.98)_100%)]" />
        </div>
  
        <section className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            STRENDEX Scoring
          </div>
  
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            How scoring works
          </h1>
  
          <p className="mt-4 text-base text-zinc-400 leading-relaxed">
            This page explains how the <span className="text-zinc-100 font-semibold">Hybrid Score</span>{" "}
            is calculated and what it means. It’s designed to be simple, fair, and comparable across athletes.
          </p>
  
          <div className="mt-10 space-y-10">

  {/* 1 — Formula */}
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <div className="text-sm font-semibold text-white">1) The Hybrid Score (0–100)</div>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      Your Hybrid Score is calculated using one simple formula:
    </p>

    <div className="mt-4 rounded-2xl bg-black/40 p-4 font-mono text-sm text-emerald-300">
      Hybrid Score = 0.5 × Strength Percentile + 0.5 × Endurance Percentile
    </div>

    <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
      The result is rounded to an integer between 0 and 100.
      A score of 75 means you outperform 75% of athletes on average across strength and endurance.
    </p>
  </div>

  {/* 2 — Percentiles explained */}
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <div className="text-sm font-semibold text-white">2) What is a percentile?</div>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      A percentile shows how you compare to other athletes.
      It does NOT measure raw weight lifted or raw time alone.
      It measures your position relative to everyone else.
    </p>

    <div className="mt-4 space-y-3 text-sm text-zinc-400">
      <div>
        If your Strength Percentile is <span className="text-zinc-100 font-semibold">80</span>,
        you are stronger than 80% of athletes in the database.
      </div>
      <div>
        If your Endurance Percentile is <span className="text-zinc-100 font-semibold">40</span>,
        you outperform 40% of athletes in endurance.
      </div>
    </div>

    <div className="mt-4 rounded-2xl bg-black/40 p-4 font-mono text-sm text-emerald-300">
      Example: (80 + 40) ÷ 2 = 60 → Hybrid Score = 60
    </div>
  </div>

  {/* 3 — Early volatility */}
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <div className="text-sm font-semibold text-white">3) Why scores may change over time</div>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      Percentiles are relative to the dataset.
      As more athletes join STRENDEX, percentiles naturally adjust.
    </p>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      Early in the platform’s growth, percentile shifts may be more noticeable.
      As the dataset grows larger, scores stabilize.
    </p>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      This ensures long-term fairness and meaningful comparison.
    </p>
  </div>

  {/* 4 — Why percentiles instead of raw numbers */}
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <div className="text-sm font-semibold text-white">4) Why percentiles instead of raw numbers?</div>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      Raw weight and raw times don’t scale fairly across body types,
      experience levels, or different athletic strengths.
    </p>

    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
      Percentiles normalize performance across the entire athlete pool.
      This makes your score:
    </p>

    <ul className="mt-4 space-y-2 text-sm text-zinc-400 list-disc list-inside">
      <li>Fair across different bodyweights</li>
      <li>Comparable across all athletes</li>
      <li>Balanced between strength and endurance</li>
      <li>Resistant to inflated raw totals</li>
    </ul>

    <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
      The Hybrid Score is not just a total — it’s a position in the global athlete distribution.
    </p>
  </div>

</div>
        </section>
      </main>
    );
  }