import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const chips = [
    { label: "No sign-up" },
    { label: "Mobile-first" },
    { label: "Shareable card" },
    { label: "Rankings" },
  ];

  const miniLinks = [
    { label: "How it works", href: "#how" },
    { label: "Rank bands", href: "#bands" },
    { label: "Card", href: "#card" },
    { label: "FAQ", href: "#faq" },
  ];

  const steps = [
    { n: "01", t: "Enter stats", d: "Bodyweight, bench, squat, deadlift, 5K." },
    { n: "02", t: "Get HQ", d: "Tier, athlete type, strength/endurance indexes." },
    { n: "03", t: "Share", d: "Download a premium PNG built for socials." },
  ];

  const outputs = [
    { k: "HQ Score", v: "Your hybrid benchmark" },
    { k: "Tier", v: "Novice → World Class" },
    { k: "Athlete Type", v: "Strength / Engine profile" },
    { k: "Top %", v: "Percentile vs dataset" },
  ];

  const tiers = [
    {
      label: "WORLD CLASS",
      range: "90+",
      sub: "Hybrid outliers",
      color: "text-emerald-300",
      bg: "bg-emerald-400/10 border-emerald-400/20",
      glow: "shadow-[0_0_0_1px_rgba(34,197,94,0.10),0_0_30px_rgba(34,197,94,0.14)]",
    },
    {
      label: "ELITE",
      range: "75-89",
      sub: "Highly competitive",
      color: "text-sky-300",
      bg: "bg-sky-400/10 border-sky-400/20",
      glow: "shadow-[0_0_0_1px_rgba(59,130,246,0.10),0_0_30px_rgba(59,130,246,0.12)]",
    },
    {
      label: "ADVANCED",
      range: "60-74",
      sub: "Strong base",
      color: "text-violet-300",
      bg: "bg-violet-400/10 border-violet-400/20",
      glow: "shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_0_30px_rgba(139,92,246,0.12)]",
    },
    {
      label: "INTERMEDIATE",
      range: "40-59",
      sub: "Developing",
      color: "text-amber-300",
      bg: "bg-amber-400/10 border-amber-400/20",
      glow: "shadow-[0_0_0_1px_rgba(245,158,11,0.10),0_0_30px_rgba(245,158,11,0.10)]",
    },
    {
      label: "NOVICE",
      range: "0-39",
      sub: "Starting point",
      color: "text-zinc-200",
      bg: "bg-white/[0.03] border-white/10",
      glow: "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
    },
  ];

  const faqs = [
    { q: "Do I need to sign up?", a: "No. Run the scan and get the card instantly." },
    { q: "What should I input?", a: "Use true 1RMs (or honest recent bests) + a real 5K time." },
    { q: "Is this for beginners?", a: "Yes. The tier gives a baseline; the athlete type shows your imbalance." },
    { q: "Can I compare with friends?", a: "That’s the point — share the card and climb the rankings." },
  ];

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 selection:bg-emerald-400/25 font-sans antialiased">
      {/* BACKDROP */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[760px] w-[1280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.16),_transparent_62%)] blur-3xl" />
        <div className="absolute top-40 left-1/2 h-[780px] w-[1320px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.11),_transparent_62%)] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.70)_55%,rgba(2,2,3,0.98)_100%)]" />
      </div>

      {/* HERO */}
      <section className="relative px-5 pt-10 pb-8 sm:px-6 sm:pt-14 md:pt-16 md:pb-12">
        <div className="mx-auto max-w-7xl">
          

          <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center">
            {/* Left */}
            <div className="md:col-span-7">
              

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
                The{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-500">
                  hybrid
                </span>{" "}
                standard.
              </h1>

              <p className="mt-4 max-w-prose text-base leading-relaxed text-zinc-300 sm:text-lg">
                A premium scan of your strength + engine — output as a tier, athlete type, percentile, and a card
                that looks made for Instagram.
              </p>

              <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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

              <div className="mt-5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[12px] text-zinc-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    {c.label}
                  </span>
                ))}
              </div>

              {/* Output tiles */}
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {outputs.map((o) => (
                  <div
                    key={o.k}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">{o.k}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{o.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Premium card preview (cleaner, less words) */}
            <div className="md:col-span-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div aria-hidden className="absolute inset-0">
                  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.16),_transparent_65%)] blur-2xl" />
                  <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_65%)] blur-2xl" />
                  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,transparent_0%,rgba(2,2,3,0.45)_55%,rgba(2,2,3,0.90)_100%)]" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
                      </div>
                      <div className="leading-none">
                        <div className="text-sm font-semibold tracking-wide text-white">Athlete Card</div>
                        <div className="text-[11px] text-zinc-500">Preview</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Top</div>
                      <div className="mt-1 text-sm font-semibold text-white">Top %</div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Athlete</div>
                      <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">Athlete</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-emerald-300">
                          ADVANCED
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-300">
                          STRENGTH-LEANING
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">HQ</div>
                      <div className="mt-1 text-5xl font-semibold tracking-tight text-white">68</div>
                      <div className="mt-2 flex flex-col gap-2">
                        {/* micro bars */}
                        <div className="w-40 max-w-[52vw]">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                            <span>Strength</span>
                            <span className="text-zinc-400">72</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-white/10">
                            <div className="h-2 w-[72%] rounded-full bg-emerald-400/70 shadow-[0_0_18px_rgba(34,197,94,0.35)]" />
                          </div>
                        </div>
                        <div className="w-40 max-w-[52vw]">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                            <span>Engine</span>
                            <span className="text-zinc-400">58</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-white/10">
                            <div className="h-2 w-[58%] rounded-full bg-sky-400/60 shadow-[0_0_18px_rgba(59,130,246,0.28)]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                    {[
                      { k: "BW", v: "195" },
                      { k: "5K", v: "22:30" },
                      { k: "Total", v: "1065" },
                    ].map((x) => (
                      <div key={x.k} className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{x.k}</div>
                        <div className="mt-1 truncate font-semibold text-white">{x.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="truncate">strendex • hybrid benchmark</span>
                    <span className="font-mono">v2.4</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Built to look clean on stories — export as PNG.
              </div>
            </div>
          </div>

          {/* subtle scroll cue */}
          <div className="mt-10 flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-zinc-400">
              <span className="h-1 w-10 rounded-full bg-white/10" />
              Scroll for tiers + how it works
              <span className="h-1 w-10 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-zinc-400 md:text-base">
            A fast scan designed for comparing and sharing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold text-white">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Promise</div>
              <div className="mt-2 text-sm font-semibold text-white">Done in under a minute.</div>
              <div className="mt-1 text-sm text-zinc-400">No fluff — just your benchmark.</div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-black hover:bg-zinc-200 transition"
              >
                Start scan <span className="ml-2">→</span>
              </Link>
              <Link
                href="/rankings"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
              >
                See rankings
              </Link>
            </div>
          </div>
        </div>
      </section>

      

      {/* STANDARDS */}
      <section id="bands" className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 sm:pb-20">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Standards</div>
              <h2 className="mt-2 text-xl font-semibold text-white">HQ Rank Bands</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Simple tiers so the score actually means something.
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

          <div className="border-t border-white/10 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {tiers.map((t) => (
                <div key={t.label} className={`rounded-2xl border ${t.bg} ${t.glow} p-4`}>
                  <div className={`text-[11px] font-semibold tracking-widest ${t.color}`}>{t.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{t.range}</div>
                  <div className="mt-1 text-sm text-zinc-400">{t.sub}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500">
            HQ is computed from strength + 5K performance and ranked against the global dataset.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-7xl px-5 pb-6 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="max-w-2xl">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">FAQ</div>
            <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">Common questions</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-sm font-semibold text-white">{item.q}</div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-400">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-5 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10 md:p-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold text-white md:text-4xl">Run your scan.</h2>
              <p className="mt-3 text-zinc-400">
                HQ score, tier, athlete type, percentile, share card — under a minute.
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

      {/* FOOTER (keep single footer only) */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-widest text-zinc-600">© 2026 Strendex Systems</p>
          <div className="flex gap-8 text-xs uppercase tracking-widest text-zinc-500">
            <Link href="/tool" className="hover:text-white transition-colors">
              Calculate
            </Link>
            <Link href="/rankings" className="hover:text-white transition-colors">
              Rankings
            </Link>
            <Link href="#how" className="hover:text-white transition-colors">
              How
            </Link>
            <Link href="#faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}