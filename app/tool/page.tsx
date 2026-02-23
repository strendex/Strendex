"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import StrendexChart from "./StrendexChart";
import { supabase } from "../../lib/supabaseClient";

type Rank = "WORLD CLASS" | "ELITE" | "ADVANCED" | "INTERMEDIATE" | "NOVICE";

export default function ToolPage() {
  // Store inputs as strings so empty fields don't snap to 0
  const [weight, setWeight] = useState<string>("");
  const [bench, setBench] = useState<string>("");
  const [squat, setSquat] = useState<string>("");
  const [deadlift, setDeadlift] = useState<string>("");
  const [fiveK, setFiveK] = useState<string>(""); // minutes (UI)
  const [isSaving, setIsSaving] = useState(false);

  const w = Number(weight) || 0;
  const b = Number(bench) || 0;
  const s = Number(squat) || 0;
  const d = Number(deadlift) || 0;
  const fiveKMin = Number(fiveK) || 0;

  // CALCULATIONS
  const totalLift = b + s + d;
  const strengthRatio = w > 0 ? totalLift / w : 0;
  const enduranceFactor = fiveKMin > 0 ? (100 / fiveKMin) / 5 : 0;
  const hqScore = Number((strengthRatio + enduranceFactor).toFixed(1));

  const getRank = (score: number): Rank => {
    if (score >= 6) return "WORLD CLASS";
    if (score >= 4.5) return "ELITE";
    if (score >= 3) return "ADVANCED";
    if (score >= 1.5) return "INTERMEDIATE";
    return "NOVICE";
  };

  const currentRank = getRank(hqScore);

  // Graph normalization (0–100)
  const chartData = useMemo(() => {
    return [
      { subject: "Bench", value: Math.min(100, w > 0 ? (b / (w * 1.5)) * 100 : 0) || 0 },
      { subject: "Squat", value: Math.min(100, w > 0 ? (s / (w * 2)) * 100 : 0) || 0 },
      { subject: "Deadlift", value: Math.min(100, w > 0 ? (d / (w * 2.5)) * 100 : 0) || 0 },
      { subject: "5K Pace", value: fiveKMin > 0 ? Math.max(0, 100 - fiveKMin * 2) : 0 },
    ];
  }, [w, b, s, d, fiveKMin]);

  const canSave =
    w > 0 && (b > 0 || s > 0 || d > 0 || fiveKMin > 0) && hqScore > 0 && !isSaving;

  async function saveSubmission() {
    if (!canSave) {
      alert("Enter your stats first (bodyweight + at least one metric).");
      return;
    }

    setIsSaving(true);
    try {
      // Store 5k as seconds (your DB expects fivek_seconds)
      const fivek_seconds = fiveKMin > 0 ? Math.round(fiveKMin * 60) : null;

      const { error } = await supabase.from("submissions").insert([
        {
          bodyweight: w,
          fivek_seconds,
          squat: s || null,
          bench: b || null,
          deadlift: d || null,
        },
      ]);

      if (error) alert(`Error: ${error.message}`);
      else alert("Score logged to STRENDEX HQ.");
    } catch {
      alert("System error.");
    } finally {
      setIsSaving(false);
    }
  }

  const rankMeta: Record<Rank, { label: string; pill: string; glow: string }> = {
    "WORLD CLASS": {
      label: "WORLD CLASS",
      pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      glow: "shadow-[0_0_40px_rgba(34,197,94,0.20)]",
    },
    ELITE: {
      label: "ELITE",
      pill: "border-sky-400/20 bg-sky-400/10 text-sky-300",
      glow: "shadow-[0_0_40px_rgba(56,189,248,0.15)]",
    },
    ADVANCED: {
      label: "ADVANCED",
      pill: "border-violet-400/20 bg-violet-400/10 text-violet-300",
      glow: "shadow-[0_0_40px_rgba(167,139,250,0.14)]",
    },
    INTERMEDIATE: {
      label: "INTERMEDIATE",
      pill: "border-amber-400/20 bg-amber-400/10 text-amber-300",
      glow: "shadow-[0_0_40px_rgba(251,191,36,0.12)]",
    },
    NOVICE: {
      label: "NOVICE",
      pill: "border-white/10 bg-white/[0.03] text-zinc-300",
      glow: "",
    },
  };

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 selection:bg-emerald-400/25 font-sans antialiased">
      {/* BACKDROP */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[540px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.16),_transparent_60%)] blur-2xl" />
        <div className="absolute top-36 left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.09),_transparent_60%)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_0%,transparent_0%,rgba(2,2,3,0.70)_55%,rgba(2,2,3,0.96)_100%)]" />
      </div>

      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#020203]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
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
              <div className="text-sm font-semibold tracking-wide text-white">STRENDEX</div>
              <div className="text-[11px] text-zinc-500">HQ Tooling</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <Link href="/rankings" className="hover:text-white transition-colors">
              Rankings
            </Link>
            <a href="#standards" className="hover:text-white transition-colors">
              Standards
            </a>
            <a href="#profile" className="hover:text-white transition-colors">
              Profile
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/rankings"
              className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06] transition md:inline-flex"
            >
              View Rankings
            </Link>
            <button
              onClick={saveSubmission}
              disabled={!canSave}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition disabled:opacity-40 disabled:hover:bg-white"
            >
              {isSaving ? "Transmitting…" : "Log to HQ"}
            </button>
          </div>
        </div>
      </header>

      {/* PAGE */}
      <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        {/* HEADER / SCORE */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.65)]" />
              Protocol v2.4 — Score Engine Active
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Strendex HQ Scoring Tool
            </h1>
            <p className="mt-2 text-sm text-zinc-400 md:text-base">
              Input your strength + endurance metrics to generate your HQ Score and performance
              profile.
            </p>
          </div>

          <div className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 ${rankMeta[currentRank].glow}`}>
            <div className="flex items-center justify-between gap-10">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-zinc-500">HQ Score</div>
                <div className="mt-1 text-6xl font-semibold tracking-tight text-white">
                  {Number.isFinite(hqScore) ? hqScore : 0}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-widest ${rankMeta[currentRank].pill}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {rankMeta[currentRank].label}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Updates live as you type
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GRID */}
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: INPUTS */}
          <div className="lg:col-span-4 space-y-6">
            {/* Vital stats */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white tracking-wide">Vital Stats</h2>
                <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  Input
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Body Weight (lbs)"
                  placeholder="e.g., 195"
                  value={weight}
                  onChange={setWeight}
                />
                <Field
                  label="5K Time (minutes)"
                  placeholder="e.g., 22.5"
                  value={fiveK}
                  onChange={setFiveK}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Strength:Weight</span>
                  <span className="text-white font-semibold">
                    {w > 0 ? strengthRatio.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Endurance Factor</span>
                  <span className="text-white font-semibold">
                    {fiveKMin > 0 ? enduranceFactor.toFixed(2) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Strength metrics */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white tracking-wide">Strength Metrics</h2>
                <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  lbs
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <Field label="Bench" placeholder="e.g., 275" value={bench} onChange={setBench} />
                <Field label="Squat" placeholder="e.g., 365" value={squat} onChange={setSquat} />
                <Field
                  label="Deadlift"
                  placeholder="e.g., 425"
                  value={deadlift}
                  onChange={setDeadlift}
                />
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Total Lift
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{totalLift || 0} lbs</div>
                </div>

                <button
                  onClick={saveSubmission}
                  disabled={!canSave}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-xs font-semibold tracking-widest text-black hover:bg-emerald-300 transition disabled:opacity-40 disabled:hover:bg-emerald-400"
                >
                  {isSaving ? "TRANSMITTING…" : "LOG TO CLOUD"}
                </button>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                Logging stores your metrics to the global database (table: <span className="text-zinc-400">submissions</span>).
              </p>
            </div>
          </div>

          {/* RIGHT: PROFILE + STANDARDS */}
          <div className="lg:col-span-8 space-y-6">
            {/* Profile Card */}
            <div
              id="profile"
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
            >
              <div aria-hidden className="absolute inset-0">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.18),_transparent_65%)] blur-2xl" />
              </div>

              <div className="relative z-10 flex items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    Radar Profile
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Performance Signature
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Normalized to show your profile across strength and 5K pace.
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PROFILE_SCAN: ACTIVE
                </div>
              </div>

              <div className="relative z-10 mt-6 grid place-items-center rounded-2xl border border-white/10 bg-black/30 p-4 md:p-6">
                <StrendexChart data={chartData} />
              </div>
            </div>

            {/* Standards Table */}
            <div
              id="standards"
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    Standards
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-white">HQ Rank Bands</h3>
                </div>
                <Link
                  href="/rankings"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06] transition"
                >
                  Open Rankings →
                </Link>
              </div>

              <div className="border-t border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/30 text-[10px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Rank</th>
                      <th className="px-6 py-4 font-semibold">Score Range</th>
                      <th className="px-6 py-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {[
                      { label: "WORLD CLASS", range: "6.0+", color: "text-emerald-300" },
                      { label: "ELITE", range: "4.5 – 5.9", color: "text-sky-300" },
                      { label: "ADVANCED", range: "3.0 – 4.4", color: "text-violet-300" },
                      { label: "INTERMEDIATE", range: "1.5 – 2.9", color: "text-amber-300" },
                      { label: "NOVICE", range: "0.0 – 1.4", color: "text-zinc-300" },
                    ].map((row) => {
                      const active = currentRank === (row.label as Rank);
                      return (
                        <tr
                          key={row.label}
                          className={active ? "bg-emerald-400/10" : "hover:bg-white/[0.03] transition"}
                        >
                          <td className={`px-6 py-4 font-semibold ${row.color}`}>{row.label}</td>
                          <td className="px-6 py-4 text-zinc-300">{row.range}</td>
                          <td className="px-6 py-4 text-right">
                            {active ? (
                              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                CURRENT_USER
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Helper note */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    Tip
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    For best results: use true 1RMs and your most recent 5K time.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/rankings"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06] transition"
                  >
                    Rankings
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06] transition"
                  >
                    Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-widest text-zinc-600">© 2026 Strendex Systems</p>
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

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
      />
    </div>
  );
}