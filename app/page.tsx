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
            {/* Uses /public/logo.png */}
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <Image
                src="/logo.png"
                alt="Strendex"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-wide text-white">
                STRENDEX
              </div>
              <div className="text-[11px] text-zinc-500">Performance Platform</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#capabilities" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security
            </a>
            <a href="#cta" className="hover:text-white transition-colors">
              Start
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* leaderboard is /rankings */}
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
              Launch Tooling
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 pt-20 md:pt-28 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            {/* status */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.75)]" />
              Strendex Protocol v2.4 Active
              <span className="ml-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-400">
                LIVE
              </span>
            </div>

            <h1 className="mt-7 text-5xl font-semibold tracking-tight text-white md:text-7xl">
              The standard for{" "}
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-zinc-500">
                performance data.
              </span>
            </h1>

            <p className="mt-6 text-base leading-relaxed text-zinc-400 md:text-lg">
              Track output. Diagnose trends. Compete globally. Built where{" "}
              <span className="text-white">raw strength</span> meets{" "}
              <span className="text-white">precision data</span>.
            </p>

            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/tool"
                className="group inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
              >
                Open Interface
                <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>

              <Link
                href="/rankings"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-semibold text-white hover:bg-white/[0.06] transition sm:w-auto"
              >
                View Rankings
              </Link>
            </div>

            {/* quick stats */}
            <div className="mt-10 grid grid-cols-3 gap-3 rounded-3xl border border-white/5 bg-white/[0.02] p-4 text-left md:p-5">
              {[
                { k: "Latency", v: "Sub-ms" },
                { k: "Uptime", v: "99.9%" },
                { k: "Sync", v: "Real-time" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">
                    {item.k}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {item.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES (BENTO) */}
      <section id="capabilities" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Built for elite execution.
            </h2>
            <p className="mt-2 text-sm text-zinc-400 md:text-base">
              A minimal, high-end interface that moves fast and stays accurate under
              pressure.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            System Health: Optimal
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[320px]">
          {/* Large card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:col-span-2 md:row-span-2">
            <div aria-hidden className="absolute inset-0">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.22),_transparent_65%)] blur-2xl" />
              <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_65%)] blur-2xl" />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/30">
                    <svg
                      className="h-6 w-6 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M13 2L3 14h7l-1 8 12-14h-7l-1-6Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-zinc-400">
                    Real-time Aggregation
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
                  Capture everything. Miss nothing.
                </h3>
                <p className="mt-3 max-w-xl text-zinc-400">
                  Every metric is logged, validated, and rendered instantly—so your
                  next decision is grounded in signal, not noise.
                </p>
              </div>

              {/* terminal-style preview */}
              <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    Secure Stream
                  </div>
                </div>

                <div className="mt-4 space-y-2 font-mono text-[11px] text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">ingest</span>
                    <span className="text-emerald-300">ok</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">validate</span>
                    <span className="text-emerald-300">ok</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">render</span>
                    <span className="text-emerald-300">ok</span>
                  </div>
                  <div className="mt-3 h-px w-full bg-white/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">latency</span>
                    <span className="text-white">&lt; 1 ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Security */}
          <div
            id="security"
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:bg-white/[0.05] transition"
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/30">
              <svg
                className="h-6 w-6 text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">Security</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Encrypted transport, hardened sessions, and strict access boundaries
              across all packets.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Shielded by default
            </div>
          </div>

          {/* Card: Uptime */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:bg-white/[0.05] transition">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/30">
              <svg
                className="h-6 w-6 text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8v4l3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">High Uptime</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Global redundancy and graceful degradation for consistent availability.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              99.9% target
            </div>
          </div>

          {/* Wide Card: Rankings */}
          <div className="md:col-span-3 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/30">
                    <svg
                      className="h-6 w-6 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7 20V10M12 20V4M17 20v-8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-zinc-400">
                    Rankings
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-semibold text-white">
                  Compete with the best.
                </h3>
                <p className="mt-2 text-zinc-400">
                  Your standing updates live as your metrics improve—built to reward consistency,
                  not hype.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/rankings"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition"
                >
                  Open Rankings →
                </Link>
                <Link
                  href="/tool"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
                >
                  Improve My Metrics
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-6 pb-24 pt-4">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 md:p-14">
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Start tracking today.
              </h2>
              <p className="mt-3 text-zinc-400">
                Open the interface, log your output, and let the system do the rest.
                Clean data. Clear ranking. Better results.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tool"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-black hover:bg-emerald-300 transition"
              >
                Launch Tooling
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
          <p className="text-xs uppercase tracking-widest text-zinc-600">
            © 2026 Strendex Systems
          </p>
          <div className="flex gap-8 text-xs uppercase tracking-widest text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">
              Documentation
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}