import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 selection:bg-emerald-400/25 font-sans antialiased">
      {/* BACKDROP */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.18),_transparent_60%)] blur-2xl" />
        <div className="absolute top-32 left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_60%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.65)_55%,rgba(2,2,3,0.95)_100%)]" />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#020203]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
            </div>
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-wide text-white">STRENDEX</div>
              <div className="text-[11px] text-zinc-500">Hybrid performance benchmark</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#how" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#bands" className="hover:text-white transition-colors">
              Standards
            </a>
            <a href="#cta" className="hover:text-white transition-colors">
              Start
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/rankings"
              className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06] transition md:inline-flex"
            >
              Rankings
            </Link>
            <Link
              href="/tool"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition"
            >
              Calculate HQ
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 pt-16 md:pt-24 pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center">
            {/* Left */}
            <div className="md:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.75)]" />
                New: One-click profile + log to HQ
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Measure your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-500">
                  hybrid performance
                </span>
                .
              </h1>

              <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
                Enter bodyweight, lifts, and a 5K. Get an <span className="text-white">HQ Score</span>, an{" "}
                <span className="text-white">archetype</span>, and your <span className="text-white">global percentile</span>.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/tool"
                  className="group inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
                >
                  Calculate HQ Score
                  <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </Link>

                <Link
                  href="/rankings"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-semibold text-white hover:bg-white/[0.06] transition sm:w-auto"
                >
                  View Rankings
                </Link>
              </div>

              {/* Value tiles */}
              <div className="mt-9 grid grid-cols-3 gap-3">
                {[
                  { k: "HQ Score", v: "Strength + 5K" },
                  { k: "Archetype", v: "Training focus" },
                  { k: "Global Rank", v: "Percentile" },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">{item.k}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Premium preview card */}
            <div className="md:col-span-6">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
                <div aria-hidden className="absolute inset-0">
                  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.20),_transparent_65%)] blur-2xl" />
                  <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_65%)] blur-2xl" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
                      </div>
                      <div className="leading-none">
                        <div className="text-sm font-semibold tracking-wide text-white">ATHLETE CARD</div>
                        <div className="text-[11px] text-zinc-500">Preview</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Global Rank</div>
                      <div className="mt-1 text-sm font-semibold text-white">Top 18%</div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Athlete</div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">Ryan</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-emerald-300">
                          ADVANCED
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-300">
                          STRENGTH-LEANING HYBRID
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">HQ Score</div>
                      <div className="mt-1 text-5xl font-semibold tracking-tight text-white">3.6</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                    {[
                      { k: "BW", v: "195 lbs" },
                      { k: "5K", v: "22:30" },
                      { k: "Bench", v: "275" },
                      { k: "Squat", v: "365" },
                      { k: "Deadlift", v: "425" },
                      { k: "Total", v: "1065" },
                    ].map((x) => (
                      <div key={x.k}>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{x.k}</div>
                        <div className="mt-1 font-semibold text-white">{x.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>strendex • hybrid benchmark</span>
                    <span className="font-mono">v2.4</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                This is a preview. Your real profile is generated from your inputs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-white md:text-3xl">How it works</h2>
            <p className="mt-2 text-sm text-zinc-400 md:text-base">
              Simple inputs. Clean output. Built for hybrid athletes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Enter your metrics",
              d: "Bodyweight, bench, squat, deadlift, and a 5K time.",
            },
            {
              n: "02",
              t: "Calculate HQ",
              d: "Get your score, tier, archetype, and percentile.",
            },
            {
              n: "03",
              t: "Compete + share",
              d: "Log to HQ and download a shareable athlete card.",
            },
          ].map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold text-white">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STANDARDS TEASER */}
      <section id="bands" className="mx-auto max-w-7xl px-6 pb-18 pt-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Standards</div>
              <h2 className="mt-2 text-xl font-semibold text-white">HQ Rank Bands</h2>
              <p className="mt-1 text-sm text-zinc-400">
                A quick read on how HQ Scores are tiered.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition"
              >
                Calculate
              </Link>
              <Link
                href="/rankings"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
              >
                Rankings
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/30 text-[10px] uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Tier</th>
                  <th className="px-6 py-4 font-semibold">HQ Score</th>
                  <th className="px-6 py-4 font-semibold text-right">Meaning</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {[
                  { label: "WORLD CLASS", range: "6.0+", meaning: "Top-end hybrid outliers", color: "text-emerald-300" },
                  { label: "ELITE", range: "4.5 – 5.9", meaning: "Highly competitive", color: "text-sky-300" },
                  { label: "ADVANCED", range: "3.0 – 4.4", meaning: "Strong hybrid base", color: "text-violet-300" },
                  { label: "INTERMEDIATE", range: "1.5 – 2.9", meaning: "Solid starting point", color: "text-amber-300" },
                  { label: "NOVICE", range: "0.0 – 1.4", meaning: "Build the foundation", color: "text-zinc-300" },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-white/[0.03] transition">
                    <td className={`px-6 py-4 font-semibold ${row.color}`}>{row.label}</td>
                    <td className="px-6 py-4 text-zinc-300">{row.range}</td>
                    <td className="px-6 py-4 text-right text-zinc-400">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-6 pb-24 pt-16">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 md:p-14">
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold text-white md:text-4xl">Run your scan.</h2>
              <p className="mt-3 text-zinc-400">
                Calculate your HQ Score, get your archetype, and see where you rank globally.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-black hover:bg-emerald-300 transition"
              >
                Calculate HQ Score
              </Link>
              <Link
                href="/rankings"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/30 px-8 py-4 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
              >
                View Rankings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-widest text-zinc-600">© 2026 Strendex Systems</p>
          <div className="flex gap-8 text-xs uppercase tracking-widest text-zinc-500">
            <Link href="/tool" className="hover:text-white transition-colors">
              Calculate
            </Link>
            <Link href="/rankings" className="hover:text-white transition-colors">
              Rankings
            </Link>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}