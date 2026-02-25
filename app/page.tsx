import Link from "next/link";
import Image from "next/image";
import LeaderboardPreview from "../components/LeaderboardPreview";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 selection:bg-emerald-400/25 font-sans antialiased">
      {/* BACKDROP */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.16),_transparent_60%)] blur-2xl" />
        <div className="absolute top-44 left-1/2 h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_60%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.66)_55%,rgba(2,2,3,0.96)_100%)]" />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#020203]/75 backdrop-blur-xl">
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

          {/* Desktop nav */}
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

          {/* Right actions */}
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

            {/* Mobile menu */}
            <details className="relative md:hidden">
              <summary className="list-none cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06] transition">
                Menu
              </summary>

              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#020203]/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                <div className="p-2">
                  <a
                    href="#how"
                    className="block rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
                  >
                    How it works
                  </a>
                  <a
                    href="#bands"
                    className="block rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
                  >
                    Standards
                  </a>
                  <a
                    href="#cta"
                    className="block rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition"
                  >
                    Start
                  </a>
                  <div className="my-2 h-px bg-white/10" />
                  <Link
                    href="/rankings"
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
                  >
                    Rankings
                  </Link>
                  <Link
                    href="/tool"
                    className="mt-2 block rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-200 transition"
                  >
                    Calculate HQ
                  </Link>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 pt-14 pb-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center">
            {/* Left */}
            <div className="md:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.75)]" />
                Built for lifters who also run.
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                The{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-500">
                  benchmark
                </span>{" "}
                for hybrid athletes.
              </h1>

              <p className="mt-5 max-w-prose text-base leading-relaxed text-zinc-300 md:text-lg">
                Enter your lifts and 5K. Get your <span className="text-white">HQ Score</span>, your{" "}
                <span className="text-white">athlete type</span>, and your{" "}
                <span className="text-white">global rank</span> — instantly.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/tool"
                  className="group inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
                >
                  Get my HQ Score
                  <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </Link>

                <Link
                  href="/rankings"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-semibold text-white hover:bg-white/[0.06] transition sm:w-auto"
                >
                  View Rankings
                </Link>
              </div>

              {/* Value tiles (cleaner, less “dashboard”) */}
              <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { k: "HQ Score", v: "Your hybrid rating" },
                  { k: "Athlete type", v: "Strength vs engine" },
                  { k: "Global rank", v: "Where you place" },
                ].map((item) => (
                  <div key={item.k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">{item.k}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Preview card (more product-like) */}
            <div className="md:col-span-6">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
                <div aria-hidden className="absolute inset-0">
                  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.14),_transparent_65%)] blur-2xl" />
                  <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_65%)] blur-2xl" />
                  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,transparent_0%,rgba(2,2,3,0.45)_55%,rgba(2,2,3,0.88)_100%)]" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
                      </div>
                      <div className="leading-none">
                        <div className="text-sm font-semibold tracking-wide text-white">ATHLETE CARD</div>
                        <div className="text-[11px] text-zinc-500">What you’ll share</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Global rank</div>
                      <div className="mt-1 text-sm font-semibold text-white">Top 18%</div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Athlete</div>
                      <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">Ryan</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-emerald-300">
                          ADVANCED
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-300">
                          STRENGTH-LEANING HYBRID
                        </span>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">HQ Score</div>
                      <div className="mt-1 text-5xl font-semibold tracking-tight text-white">3.6</div>
                      <div className="mt-1 text-xs text-zinc-400">Strength + endurance</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm sm:grid-cols-2">
                    {[
                      { k: "Bodyweight", v: "195 lbs" },
                      { k: "5K time", v: "22:30" },
                      { k: "Bench", v: "275" },
                      { k: "Squat", v: "365" },
                      { k: "Deadlift", v: "425" },
                      { k: "Total", v: "1065" },
                    ].map((x) => (
                      <div key={x.k} className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{x.k}</div>
                        <div className="mt-1 truncate font-semibold text-white">{x.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <span className="truncate">strendex • hybrid benchmark</span>
                    <span className="font-mono">v2.4</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                Generate your real card from your stats — then download it as a PNG.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE LEADERBOARD */}
      <LeaderboardPreview />

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-zinc-400 md:text-base">
            Three steps. No sign-up. Your profile is shareable instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Enter your stats",
              d: "Bodyweight, lifts, and a recent 5K time.",
            },
            {
              n: "02",
              t: "Get your HQ",
              d: "Score, tier, athlete type, and global rank.",
            },
            {
              n: "03",
              t: "Share your card",
              d: "Download your athlete card and compare with friends.",
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

      {/* STANDARDS */}
      <section id="bands" className="mx-auto max-w-7xl px-6 pb-20 pt-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Standards</div>
              <h2 className="mt-2 text-xl font-semibold text-white">HQ Rank Bands</h2>
              <p className="mt-1 text-sm text-zinc-400">A quick read on how HQ Scores are tiered.</p>
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

          <div className="border-t border-white/10 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {[
                {
                  label: "WORLD CLASS",
                  range: "6.0+",
                  meaning: "Elite hybrid outliers",
                  color: "text-emerald-300",
                  bg: "bg-emerald-400/10 border-emerald-400/20",
                },
                {
                  label: "ELITE",
                  range: "4.5–5.9",
                  meaning: "Highly competitive",
                  color: "text-sky-300",
                  bg: "bg-sky-400/10 border-sky-400/20",
                },
                {
                  label: "ADVANCED",
                  range: "3.0–4.4",
                  meaning: "Strong hybrid base",
                  color: "text-violet-300",
                  bg: "bg-violet-400/10 border-violet-400/20",
                },
                {
                  label: "INTERMEDIATE",
                  range: "1.5–2.9",
                  meaning: "Developing",
                  color: "text-amber-300",
                  bg: "bg-amber-400/10 border-amber-400/20",
                },
                {
                  label: "NOVICE",
                  range: "0.0–1.4",
                  meaning: "Starting point",
                  color: "text-zinc-200",
                  bg: "bg-white/[0.03] border-white/10",
                },
              ].map((tier) => (
                <div key={tier.label} className={`rounded-2xl border ${tier.bg} p-4`}>
                  <div className={`text-[11px] font-semibold tracking-widest ${tier.color}`}>{tier.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{tier.range}</div>
                  <div className="mt-1 text-sm text-zinc-400">{tier.meaning}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              HQ combines bodyweight-normalized strength and 5K endurance.
            </div>
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
                Calculate your HQ Score, get your athlete type, and see where you rank globally.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-black hover:bg-emerald-300 transition"
              >
                Get my HQ Score
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