import Link from "next/link";
import Image from "next/image";

const steps = [
  { n: "01", t: "Enter your performance metrics", d: "Bodyweight, lifts, and a 5K time." },
  { n: "02", t: "See your hybrid score", d: "One number that represents strength plus engine." },
  { n: "03", t: "Know what it means", d: "Percentile, tier, and a clean athlete profile." },
];

const faqs = [
  { q: "Do I need to sign up?", a: "No — calculate your score instantly without creating an account." },
  { q: "What should I use for the 5K?", a: "Use your actual 5K time or a close equivalent from your latest effort." },
  { q: "What lift numbers should I enter?", a: "Use recent bests for the primary lifts, ideally true one-rep maxes." },
  { q: "Can I compare with others?", a: "Yes — check Rankings to see how your score stacks up." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050607] text-white antialiased">
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-[#050607] via-[#070809] to-[#020203]" />

      <section className="px-5 pt-16 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-400">
                Hybrid score • 5 inputs
              </div>

              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  A cleaner way to benchmark strength and endurance.
                </h1>
                <p className="max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                  Enter a few performance markers, then see your Hybrid Score, percentile, and what your profile means.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/tool"
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition hover:bg-zinc-100"
                >
                  Start the calculator
                </Link>
                <Link href="/rankings" className="text-sm font-semibold text-white/80 transition hover:text-white">
                  View rankings
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="text-sm text-zinc-400">No sign-up</div>
                  <div className="mt-2 text-xl font-semibold text-white">Instant result</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="text-sm text-zinc-400">Mobile friendly</div>
                  <div className="mt-2 text-xl font-semibold text-white">Fast flow</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                  <div className="text-sm text-zinc-400">Clear context</div>
                  <div className="mt-2 text-xl font-semibold text-white">Actionable insight</div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]">
              <div className="rounded-[1.75rem] border border-white/10 bg-[#090a0b] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 overflow-hidden rounded-3xl bg-white/5">
                      <Image src="/logo.png" alt="Strendex" fill className="object-contain p-2" priority />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Preview</div>
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Athlete card</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    72nd percentile
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Hybrid Score</div>
                        <div className="mt-2 text-4xl font-semibold text-white">68</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Tier</div>
                        <div className="mt-2 text-sm font-semibold text-white">Advanced</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Strength</div>
                      <div className="mt-2 text-2xl font-semibold text-white">72</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Endurance</div>
                      <div className="mt-2 text-2xl font-semibold text-white">58</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { k: "BW", v: "195 lb" },
                      { k: "5K", v: "22:30" },
                      { k: "Total", v: "1,065 lb" },
                    ].map((x) => (
                      <div key={x.k} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
                        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{x.k}</div>
                        <div className="mt-2 font-semibold text-white">{x.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">How it works</div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Simple performance insight.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              Add your weight, lifts, and 5K time. The calculator turns it into a single, comparable hybrid score and clear context for training.
            </p>
          </div>

          <div className="grid gap-4">
            {steps.map((step) => (
              <div key={step.n} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold text-white">{step.t}</div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="max-w-2xl">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">FAQ</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">A few quick answers.</h2>
          </div>

          <div className="mt-6 grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-3xl border border-white/10 bg-[#090a0b] p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-base font-semibold text-white">{faq.q}</div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition group-open:rotate-45">
                      +
                    </span>
                  </div>
                </summary>
                <div className="mt-3 text-sm leading-6 text-zinc-400">{faq.a}</div>
              </details>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/tool"
              className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition hover:bg-zinc-100 sm:w-auto"
            >
              Start the calculator
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
