import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const steps = [
    { n: "01", t: "Enter 5 numbers", d: "Bodyweight, 3 lifts, and a 5K time." },
    { n: "02", t: "Get your result", d: "Hybrid Score, Top %, tier, archetype, split." },
    { n: "03", t: "Share & compare", d: "Export your card and check rankings." },
  ];

  const faqs = [
    { q: "Do I need to sign up?", a: "No — run the calculator and get your result instantly." },
    {
      q: "What endurance test do I use?",
      a: "Use a real 5K time. If you only know another distance, estimate a realistic 5K equivalent first.",
    },
    {
      q: "What should I input for lifts?",
      a: "Use honest recent bests (ideally true 1RMs). It’s a benchmark, not perfect science.",
    },
    { q: "Can I compare with friends?", a: "Yes — share your card and use Rankings to see where you land." },
  ];

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-100 selection:bg-emerald-400/25 font-sans antialiased">
      {/* BACKDROP — clean, premium */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#020203]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:radial-gradient(rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute -top-64 left-1/2 h-[680px] w-[1080px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.10),_transparent_60%)] blur-3xl" />
        <div className="absolute top-48 left-1/2 h-[680px] w-[1080px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_60%)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_70%_at_50%_0%,rgba(2,2,3,0)_0%,rgba(2,2,3,0.78)_55%,rgba(2,2,3,1)_100%)]" />
      </div>

      {/* HERO */}
      <section className="px-5 pt-12 pb-10 sm:px-6 sm:pt-16 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            {/* Left */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                Hybrid benchmark • instant
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
  The hybrid benchmark for real athletes.
</h1>

<p className="mt-3 text-sm text-zinc-400 sm:text-base">
  Calculate your Hybrid Score in under a minute.
</p>

              {/* CTA — make it the obvious next step */}
              <div className="mt-7">
                <Link
                  href="/tool"
                  className="group inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-8 py-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/[0.10] transition sm:w-auto"
                >
                  Start the calculator
                  <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </Link>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="text-xs text-zinc-400">
                    No sign-up • takes ~30–60 seconds • mobile-first
                  </div>

                  <Link
                    href="/rankings"
                    className="text-xs font-semibold text-white/80 hover:text-white transition sm:ml-auto"
                  >
                    Or view Rankings →
                  </Link>
                </div>
              </div>

              {/* tiny scroll cue (subtle, not clutter) */}
              
            </div>

            {/* Right: preview (kept premium) */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div aria-hidden className="absolute inset-0">
                  <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.12),_transparent_65%)] blur-3xl" />
                  <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_65%)] blur-3xl" />
                  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,transparent_0%,rgba(2,2,3,0.40)_60%,rgba(2,2,3,0.92)_100%)]" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
                      </div>
                      <div className="leading-none">
                        <div className="text-sm font-semibold tracking-wide text-white">Athlete Card</div>
                        <div className="text-[11px] text-zinc-500">Preview</div>
                      </div>
                    </div>

                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
  Better than 72%
</div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Athlete</div>
                        <div className="mt-1 truncate text-xl font-semibold text-white">Anonymous</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-200">
                            ADVANCED
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-200">
                            STRENGTH-LEANING
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Hybrid Score</div>
                        <div className="mt-1 text-5xl font-semibold tracking-tight text-white">68</div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Strength</div>
                        <div className="mt-1 text-lg font-semibold text-white">72</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Engine</div>
                        <div className="mt-1 text-lg font-semibold text-white">58</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {[
                        { k: "BW", v: "195 lb" },
                        { k: "5K", v: "22:30" },
                        { k: "Total", v: "1065 lb" },
                      ].map((x) => (
                        <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{x.k}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 mb-8 flex justify-center">
  <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-zinc-400">
    <span className="h-1 w-10 rounded-full bg-white/10" />
    Scroll for how it works
    <span className="h-1 w-10 rounded-full bg-white/10" />
  </div>
</div>
        </div>
      </section>

      {/* HOW IT WORKS — short */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">How it works</div>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Fast, simple, shareable.</h2>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            Designed so someone new understands it instantly.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">{s.n}</div>
              <div className="mt-3 text-xl font-semibold text-white">{s.t}</div>
              <div className="mt-2 text-sm leading-relaxed text-zinc-400">{s.d}</div>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Ready to calculate?</div>
              <div className="mt-1 text-sm text-zinc-400">Open the calculator and get your Hybrid Score.</div>
            </div>
            <Link
              href="/tool"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-black hover:bg-zinc-200 transition"
            >
              Open calculator <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="max-w-2xl">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">FAQ</div>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Quick answers</h2>
          </div>

          <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/30">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none select-none">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-white">{f.q}</div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition group-open:rotate-45">
                      +
                    </span>
                  </div>
                </summary>
                <div className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</div>
              </details>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/tool"
              className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-semibold text-black hover:bg-zinc-200 transition sm:w-auto"
            >
              Start the calculator
            </Link>
          </div>
        </div>
      </section>

      

      {/* RootLayout already renders Footer */}
    </main>
  );
}