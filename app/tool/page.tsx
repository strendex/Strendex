"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import StrendexChart from "./StrendexChart";
import { supabase } from "../../lib/supabaseClient";
import { toPng } from "html-to-image";

type Rank = "WORLD CLASS" | "ELITE" | "ADVANCED" | "INTERMEDIATE" | "NOVICE";
type Archetype =
  | "BALANCED HYBRID"
  | "STRENGTH BEAST"
  | "ENGINE MACHINE"
  | "POWER HYBRID"
  | "ENDURANCE-LEANING HYBRID"
  | "STRENGTH-LEANING HYBRID"
  | "BASE BUILDER";

const ARCHETYPE_COPY: Record<
  Archetype,
  { tagline: string; description: string; focus: string }
> = {
  "STRENGTH BEAST": {
    tagline: "Strength-dominant — endurance is the limiter.",
    description:
      "Your strength output is significantly higher than your endurance capacity. You’ll score well off the big lifts, but your 5K is the main thing holding your HQ back.",
    focus:
      "Add 2–3 aerobic sessions/week (easy Zone 2) + 1 short interval day. Keep lifting heavy, but avoid maxing too often.",
  },
  "ENGINE MACHINE": {
    tagline: "Endurance-dominant — strength is the limiter.",
    description:
      "Your endurance is strong relative to your strength totals. Your 5K boosts your HQ, but adding strength will raise your overall hybrid score quickly.",
    focus:
      "Maintain running 2–3 days/week, then push progressive overload on bench/squat/deadlift (2–4 hard sets each, 2–3x/week).",
  },
  "BALANCED HYBRID": {
    tagline: "Well-rounded — strength and endurance are aligned.",
    description:
      "You’re relatively balanced: both strength and endurance contribute similarly to your HQ score. This is the classic hybrid profile.",
    focus:
      "Progress both slowly: 1–2 strength PR attempts/month and 1 structured run workout/week. Avoid huge spikes in total volume.",
  },
  "POWER HYBRID": {
    tagline: "High-high — strong and fast together.",
    description:
      "You’re strong and you’ve got a solid engine. This is the kind of profile that pushes into elite hybrid territory when trained consistently.",
    focus:
      "Keep strength volume efficient (quality over quantity) and add running quality (tempo + intervals). Prioritize recovery and sleep.",
  },
  "ENDURANCE-LEANING HYBRID": {
    tagline: "Endurance-leaning — still decently strong.",
    description:
      "Your endurance is ahead, but you’ve got more strength than the average runner. A focused strength block can raise your HQ a lot.",
    focus:
      "Keep 2 quality runs/week and add 2–3 strength sessions focused on squat/hinge/press progressions.",
  },
  "STRENGTH-LEANING HYBRID": {
    tagline: "Strength-leaning — still decent endurance.",
    description:
      "Your strength is ahead, but your endurance is not far behind. Building your aerobic base will make you much more ‘complete’ as a hybrid athlete.",
    focus:
      "Maintain lifting intensity, add 2–3 Zone 2 sessions/week, and retest your 5K after 4–6 weeks.",
  },
  "BASE BUILDER": {
    tagline: "Early stage — build the foundation.",
    description:
      "You haven’t filled enough stats yet (or they’re very low), so we treat you as a base builder. The goal is consistent training and clean technique.",
    focus:
      "Start simple: 3 days lifting + 2 days easy running each week. Retest your numbers after 6–8 weeks.",
  },
};

export default function ToolPage() {
  // Inputs (strings so empty fields stay empty)
  const [displayName, setDisplayName] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [fiveK, setFiveK] = useState<string>(""); // minutes (UI)
  const [bench, setBench] = useState<string>("");
  const [squat, setSquat] = useState<string>("");
  const [deadlift, setDeadlift] = useState<string>("");

  // Flow
  const [showResults, setShowResults] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Saving / scan moment
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<"CALIBRATING" | "SCANNING" | "COMPILING">(
    "CALIBRATING"
  );
  const [statusText, setStatusText] = useState<string>("");
  const [siteLabel, setSiteLabel] = useState<string>("strendex");

    // Results data
    const [topPercent, setTopPercent] = useState<number | null>(null);
    const [globalRank, setGlobalRank] = useState<number | null>(null);
    const [totalAthletes, setTotalAthletes] = useState<number | null>(null);
  
    // NEW: percentiles + new HQ (0–100) coming from /api/rank
    const [hqScore, setHqScore] = useState<number>(0);
    const [strengthPercentile, setStrengthPercentile] = useState<number | null>(null);
    const [endurancePercentile, setEndurancePercentile] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  function format5KFromMinutes(min: number) {
    if (!Number.isFinite(min) || min <= 0) return "—";
    const totalSeconds = Math.round(min * 60);
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  function ArchetypeIcon({
    archetype,
    className = "h-4 w-4",
  }: {
    archetype: Archetype;
    className?: string;
  }) {
    switch (archetype) {
      case "STRENGTH BEAST":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 10v4M7 9v6M17 9v6M19.5 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        );
      case "ENGINE MACHINE":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13 2L3 14h7l-1 8 12-14h-7l-1-6Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "BALANCED HYBRID":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M6 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M7.5 7l-3 6h6l-3-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M16.5 7l-3 6h6l-3-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M9 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        );
      case "POWER HYBRID":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 10l3-4 4 5 4-5 3 4v7H5v-7Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M7 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        );
      case "ENDURANCE-LEANING HYBRID":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 14c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4 2-4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        );
      case "STRENGTH-LEANING HYBRID":
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 10v4M9 9v6M15 9v6M17 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        );
      case "BASE BUILDER":
      default:
        return (
          <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        );
    }
  }

  // Parsed numbers
  const w = Number(weight) || 0;
  const fiveKMin = Number(fiveK) || 0;
  const b = Number(bench) || 0;
  const s = Number(squat) || 0;
  const d = Number(deadlift) || 0;

  // Calculations
  const totalLift = b + s + d;
  const strengthRatio = w > 0 ? totalLift / w : 0;

  // Indexes (0–100)
  const benchIndex = Math.min(100, w > 0 ? (b / (w * 1.5)) * 100 : 0) || 0;
  const squatIndex = Math.min(100, w > 0 ? (s / (w * 2.0)) * 100 : 0) || 0;
  const deadIndex = Math.min(100, w > 0 ? (d / (w * 2.5)) * 100 : 0) || 0;
  const strengthIndex = Number(((benchIndex + squatIndex + deadIndex) / 3).toFixed(1));
  const enduranceIndex = Number((fiveKMin > 0 ? Math.max(0, 100 - fiveKMin * 2) : 0).toFixed(1));
  const balancePosition = Math.max(
    0,
    Math.min(
      100,
      50 + (strengthIndex - enduranceIndex)
    )
  );

  const getRank = (score: number): Rank => {
    if (score >= 90) return "WORLD CLASS";
    if (score >= 75) return "ELITE";
    if (score >= 60) return "ADVANCED";
    if (score >= 40) return "INTERMEDIATE";
    return "NOVICE";
  };

  const getArchetype = (str: number, end: number): Archetype => {
    if (str < 10 && end < 10) return "BASE BUILDER";
    const diff = str - end;

    if (str >= 70 && end >= 70) return "POWER HYBRID";
    if (diff >= 25) return "STRENGTH BEAST";
    if (diff <= -25) return "ENGINE MACHINE";

    if (Math.abs(diff) <= 10) return "BALANCED HYBRID";
    if (diff > 10) return "STRENGTH-LEANING HYBRID";
    return "ENDURANCE-LEANING HYBRID";
  };

  const currentRank = getRank(hqScore);
  const currentArchetype = getArchetype(strengthIndex, enduranceIndex);
  const archetypeInfo = ARCHETYPE_COPY[currentArchetype];
  // Next Tier Projection
  const tierThresholds = {
    "WORLD CLASS": 90,
    "ELITE": 75,
    "ADVANCED": 60,
    "INTERMEDIATE": 40,
  };

let nextTier: Rank | null = null;
let nextTierScore = 0;

if (hqScore < 1.5) {
  nextTier = "INTERMEDIATE";
  nextTierScore = tierThresholds["INTERMEDIATE"];
} else if (hqScore < 3) {
  nextTier = "ADVANCED";
  nextTierScore = tierThresholds["ADVANCED"];
} else if (hqScore < 4.5) {
  nextTier = "ELITE";
  nextTierScore = tierThresholds["ELITE"];
} else if (hqScore < 90) {
  nextTier = "WORLD CLASS";
  nextTierScore = tierThresholds["WORLD CLASS"];
}

const hqGap = nextTier ? Number((nextTierScore - hqScore).toFixed(2)) : 0;

  const chartData = useMemo(() => {
    return [
      { subject: "Bench", value: Math.min(100, w > 0 ? (b / (w * 1.5)) * 100 : 0) || 0 },
      { subject: "Squat", value: Math.min(100, w > 0 ? (s / (w * 2)) * 100 : 0) || 0 },
      { subject: "Deadlift", value: Math.min(100, w > 0 ? (d / (w * 2.5)) * 100 : 0) || 0 },
      { subject: "5K Pace", value: fiveKMin > 0 ? Math.max(0, 100 - fiveKMin * 2) : 0 },
    ];
  }, [w, b, s, d, fiveKMin]);

  const canGenerate =
  w > 0 && (b > 0 || s > 0 || d > 0 || fiveKMin > 0) && !isSaving && !isScanning;
  async function computeScore() {
    const fivek_seconds = fiveKMin > 0 ? Math.round(fiveKMin * 60) : null;

    const res = await fetch("/api/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyweight: w,
        fivek_seconds,
        bench: b || null,
        squat: s || null,
        deadlift: d || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data);
      throw new Error(data?.error ?? "Scoring failed");
    }

    // These come from the NEW API route
    setHqScore(typeof data.hq === "number" ? data.hq : 0);
    setStrengthPercentile(typeof data.strengthPercentile === "number" ? data.strengthPercentile : null);
    setEndurancePercentile(typeof data.endurancePercentile === "number" ? data.endurancePercentile : null);

    setTopPercent(typeof data.topPercent === "number" ? data.topPercent : null);
    setGlobalRank(typeof data.rank === "number" ? data.rank : null);
    setTotalAthletes(typeof data.total === "number" ? data.total : null);

    return {
      hq: data.hq,
      strengthPercentile: data.strengthPercentile,
      endurancePercentile: data.endurancePercentile,
      topPercent: data.topPercent,
      rank: data.rank,
      total: data.total,
      fivek_seconds,
    };
  }
  function validateInputsOrAlert() {
    const fivek_seconds = fiveKMin > 0 ? Math.round(fiveKMin * 60) : null;
  
    // CLEAN NAME
    const cleanName = displayName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 ._-]/g, "");
  
    const finalName = cleanName.length >= 2 ? cleanName : "Anonymous Athlete";
  
    // REQUIRED
    if (w < 80 || w > 400) {
      alert("Bodyweight must be between 80 and 400 lbs");
      return { ok: false as const };
    }
  
    // If they typed something, it must be in range
    if (b > 0 && (b < 45 || b > 700)) {
      alert("Bench must be between 45 and 700 lbs");
      return { ok: false as const };
    }
  
    if (s > 0 && (s < 45 || s > 900)) {
      alert("Squat must be between 45 and 900 lbs");
      return { ok: false as const };
    }
  
    if (d > 0 && (d < 45 || d > 1000)) {
      alert("Deadlift must be between 45 and 1000 lbs");
      return { ok: false as const };
    }
  
    if (fivek_seconds !== null && (fivek_seconds < 840 || fivek_seconds > 3600)) {
      alert("5K must be between 14 and 60 minutes");
      return { ok: false as const };
    }
  
    // RATIO CHECKS (only if lift provided)
    if (b > 0 && b / w > 3.2) {
      alert("Bench/bodyweight ratio unrealistic");
      return { ok: false as const };
    }
    if (s > 0 && s / w > 4.0) {
      alert("Squat/bodyweight ratio unrealistic");
      return { ok: false as const };
    }
    if (d > 0 && d / w > 4.5) {
      alert("Deadlift/bodyweight ratio unrealistic");
      return { ok: false as const };
    }
  
    return { ok: true as const, finalName, fivek_seconds };
  }
  async function saveSubmission(finalName: string, fivek_seconds: number | null) {
    setIsSaving(true);
    setStatusText("Logging to HQ…");
  
    try {
      const { error } = await supabase.from("submissions").insert([
        {
          bodyweight: w,
          fivek_seconds,
          squat: s || null,
          bench: b || null,
          deadlift: d || null,
          athlete_name: finalName,
  
          hq_score: hqScore,
          rank: currentRank,
          archetype: currentArchetype,
          strength_index: strengthIndex,
          endurance_index: enduranceIndex,
          total_lift: totalLift,
          strength_ratio: strengthRatio,
        },
      ]);
  
      if (error) {
        console.error(error);
        setStatusText("Couldn’t log right now — your profile is still generated.");
      } else {
        setStatusText("Logged to HQ.");
      }
    } catch (err) {
      console.error(err);
      setStatusText("Couldn’t log right now — your profile is still generated.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusText(""), 1800);
    }
  }

  async function generateAndLog() {
    if (!canGenerate) {
      alert("Enter bodyweight and at least one metric.");
      return;
    }
  
    // ✅ VALIDATE BEFORE SHOWING RESULTS
    const v = validateInputsOrAlert();
    if (!v.ok) return;
  
    setShowResults(true);
    setShowAdvanced(false);
  
    const el = document.getElementById("results");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  
    setIsScanning(true);
    setScanStage("CALIBRATING");
    await new Promise((r) => setTimeout(r, 320));
    setScanStage("SCANNING");
    await new Promise((r) => setTimeout(r, 420));
    setScanStage("COMPILING");
    await new Promise((r) => setTimeout(r, 320));
  
    await saveSubmission(v.finalName, v.fivek_seconds);
    setIsScanning(false);
  }

  async function downloadScorecard() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#07070A",
      });
      const link = document.createElement("a");
      link.download = "strendex-scorecard.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Could not generate image. Try again.");
    }
  }

  async function copyShareText() {
    const name = displayName.trim() ? displayName.trim() : "Anonymous Athlete";
    const text = `STRENDEX PROFILE\n\n${name}\nHQ Score: ${hqScore}\nTier: ${currentRank}\nArchetype: ${currentArchetype}\nGlobal Rank: ${
      topPercent === null ? "—" : `Top ${topPercent}%`
    }\n\nBW: ${w || "—"} lbs\nBench: ${b || "—"}\nSquat: ${s || "—"}\nDeadlift: ${
      d || "—"
    }\n5K: ${format5KFromMinutes(fiveKMin)}\n\nstrendex`;

    try {
      await navigator.clipboard.writeText(text);
      alert("Share text copied.");
    } catch {
      alert("Could not copy. (Browser blocked clipboard)");
    }
  }

  const copyShareLink = async () => {
    const params = new URLSearchParams();
    const name = displayName.trim();
    if (name) params.set("name", name);
    if (weight.trim()) params.set("bw", weight.trim());
    if (bench.trim()) params.set("b", bench.trim());
    if (squat.trim()) params.set("s", squat.trim());
    if (deadlift.trim()) params.set("d", deadlift.trim());
    if (fiveK.trim()) params.set("k", fiveK.trim());

    const url = `${window.location.origin}/tool?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(url);
      alert("Share link copied.");
    } catch {
      alert("Could not copy link.");
    }
  };

  // Load share params + localStorage name
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSiteLabel(window.location.host);

    const sharedName = params.get("name");
    const sharedBw = params.get("bw");
    const sharedB = params.get("b");
    const sharedS = params.get("s");
    const sharedD = params.get("d");
    const sharedK = params.get("k");

    const hasSharedStats = Boolean(sharedBw || sharedB || sharedS || sharedD || sharedK);

    if (sharedName) {
      setDisplayName(sharedName);
      localStorage.setItem("strendex_name", sharedName);
    } else {
      const savedName = localStorage.getItem("strendex_name");
      if (savedName) setDisplayName(savedName);
    }

    if (sharedBw) setWeight(sharedBw);
    if (sharedB) setBench(sharedB);
    if (sharedS) setSquat(sharedS);
    if (sharedD) setDeadlift(sharedD);
    if (sharedK) setFiveK(sharedK);

    if (hasSharedStats) {
      setShowResults(true);
      setShowAdvanced(false);
    }
  }, []);

    // NEW: when results are shown (and not scanning), compute HQ + rank info from inputs
    useEffect(() => {
      if (!showResults || isScanning) return;
  
      const t = setTimeout(async () => {
        try {
          await computeScore();
        } catch {
          // ignore
        }
      }, 250);
  
      return () => clearTimeout(t);
    }, [showResults, isScanning, w, b, s, d, fiveKMin]);

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
              <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
            </div>
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-wide text-white">STRENDEX</div>
              <div className="text-[11px] text-zinc-500">HQ Tool</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <Link href="/rankings" className="hover:text-white transition-colors">
              Rankings
            </Link>
            <a href="#results" className="hover:text-white transition-colors">
              Results
            </a>
          </nav>

          <div className="hidden md:block text-xs text-zinc-500">Hybrid scoring + global rankings</div>
        </div>
      </header>

      {/* PAGE */}
      <section className="mx-auto max-w-7xl px-6 py-10 pb-28 md:py-14 md:pb-14">
        {/* Hero strip */}
        <div id="inputs" className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <Image src="/logo.png" alt="Strendex" fill className="object-contain p-2" priority />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">Hybrid Quotient</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Create your Strendex profile</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Enter your stats, hit <span className="text-white font-semibold">Calculate</span>, and get your archetype +
                  share card instantly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Output</div>
                <div className="mt-1 text-sm font-semibold text-white">HQ Score</div>
                <div className="mt-1 text-xs text-zinc-500">Strength + endurance</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Profile</div>
                <div className="mt-1 text-sm font-semibold text-white">Archetype</div>
                <div className="mt-1 text-xs text-zinc-500">Training focus</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Rank</div>
                <div className="mt-1 text-sm font-semibold text-white">Percentile</div>
                <div className="mt-1 text-xs text-zinc-500">Global database</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: INPUTS */}
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white tracking-wide">Athlete Inputs</h3>
                <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Enter</span>
              </div>

              <div className="mt-5 space-y-4">
                <TextField
                  label="Display Name"
                  placeholder="e.g., Ryan"
                  value={displayName}
                  onChange={(value) => {
                    setDisplayName(value);
                    localStorage.setItem("strendex_name", value);
                  }}
                />

                <Field label="Bodyweight (lbs)" placeholder="e.g., 195" value={weight} onChange={setWeight} />
                <Field label="5K Time (minutes)" placeholder="e.g., 22.5" value={fiveK} onChange={setFiveK} />

                <div className="pt-2 border-t border-white/10" />

                <Field label="Bench (lbs)" placeholder="e.g., 275" value={bench} onChange={setBench} />
                <Field label="Squat (lbs)" placeholder="e.g., 365" value={squat} onChange={setSquat} />
                <Field label="Deadlift (lbs)" placeholder="e.g., 425" value={deadlift} onChange={setDeadlift} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Total Lift</span>
                  <span className="text-white font-semibold">{totalLift > 0 ? `${totalLift} lbs` : "—"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">5K</span>
                  <span className="text-white font-semibold">{fiveKMin > 0 ? format5KFromMinutes(fiveKMin) : "—"}</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={generateAndLog}
                  disabled={!canGenerate}
                  className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-xs font-semibold tracking-widest text-black hover:bg-zinc-200 transition disabled:opacity-40 disabled:hover:bg-white"
                >
                  {isScanning ? "GENERATING…" : isSaving ? "LOGGING…" : "CALCULATE"}
                </button>

                {statusText ? (
                  <div className="mt-2 text-[11px] text-zinc-400">{statusText}</div>
                ) : (
                  <div className="mt-2 text-[11px] text-zinc-500">One click: generate profile + log to HQ.</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: RESULTS */}
          <div className="lg:col-span-8 space-y-6">
            <div id="results" />

            {!showResults ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Results</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">Your profile will appear here</h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      Enter your stats on the left, then press <span className="text-white font-semibold">Calculate</span>.
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    READY
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">HQ Score</div>
                      <div className="mt-1 text-4xl font-semibold tracking-tight text-white/60">—</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Tier</div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold tracking-widest text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400/60" />
                        —
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Scan moment */}
                {isScanning ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Generating Profile</div>
                        <h3 className="mt-2 text-xl font-semibold text-white">
                          {scanStage === "CALIBRATING"
                            ? "Calibrating inputs"
                            : scanStage === "SCANNING"
                            ? "Scanning performance signature"
                            : "Compiling report"}
                        </h3>
                        <p className="mt-2 text-sm text-zinc-400">Building your Strendex output…</p>
                      </div>

                      <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        PROFILE_SCAN
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full bg-emerald-400/70 transition-all duration-300 ${
                            scanStage === "CALIBRATING"
                              ? "w-[28%]"
                              : scanStage === "SCANNING"
                              ? "w-[62%]"
                              : "w-[92%]"
                          }`}
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                        <span>
                          {scanStage === "CALIBRATING"
                            ? "Normalizing metrics"
                            : scanStage === "SCANNING"
                            ? "Computing archetype"
                            : "Finalizing output"}
                        </span>
                        <span className="font-mono">
                          {scanStage === "CALIBRATING" ? "01" : scanStage === "SCANNING" ? "02" : "03"}/03
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Report summary */}
                {!isScanning ? (
                  <div className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 ${rankMeta[currentRank].glow}`}>
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-zinc-500">HQ Score</div>
                        <div className="mt-1 text-6xl font-semibold tracking-tight text-white drop-shadow-[0_0_18px_rgba(34,197,94,0.35)]">
                          {Number.isFinite(hqScore) ? hqScore : 0}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-widest ${rankMeta[currentRank].pill}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {rankMeta[currentRank].label}
                          </div>

                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold tracking-widest text-zinc-300">
  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
  {globalRank === null || totalAthletes === null
    ? "Loading rank…"
    : `Rank #${globalRank} of ${totalAthletes}`}
</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowAdvanced((v) => !v)}
                          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06] transition"
                        >
                          {showAdvanced ? "Hide details" : "Show details"}
                        </button>
                      </div>
                    </div>

                    {/* Archetype */}
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-500">
                        <span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/30 text-emerald-300">
                          <ArchetypeIcon archetype={currentArchetype} className="h-3.5 w-3.5" />
                        </span>
                        Archetype
                      </div>

                      <div className="mt-2">
                        <ArchetypeBadge archetype={currentArchetype} />
                      </div>

                      <div className="mt-2 text-xs text-zinc-400">
                        <span className="text-zinc-200 font-semibold">{archetypeInfo.tagline}</span>
                      </div>

                      {showAdvanced ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs text-zinc-400 leading-relaxed">{archetypeInfo.description}</p>
                          <div className="mt-3 text-xs">
                            <span className="font-semibold text-zinc-200">Focus: </span>
                            <span className="text-zinc-400">{archetypeInfo.focus}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
{/* Next Tier Projection */}
{nextTier && (
  <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
    <div className="text-[10px] uppercase tracking-widest text-zinc-500">
      Next Tier
    </div>

    <div className="mt-2 text-sm font-semibold text-white">
      {nextTier}
    </div>

    <p className="mt-2 text-xs text-zinc-400">
      You are <span className="text-white font-semibold">{hqGap}</span> HQ away from reaching this tier.
    </p>

    <div className="mt-3 text-xs text-zinc-500">
      Improve your strength totals or 5K time to increase your Hybrid Quotient.
    </div>
  </div>
)}
                {/* Shareable athlete card */}
                {!isScanning ? (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Share</div>
                        <h2 className="mt-1 text-lg font-semibold text-white">Athlete Card</h2>
                        <p className="mt-1 text-sm text-zinc-400">Download or copy your Strendex profile for socials.</p>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={downloadScorecard}
                          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition"
                        >
                          Download PNG
                        </button>

                        <button
                          onClick={copyShareText}
                          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
                        >
                          Copy Text
                        </button>

                        <button
                          onClick={copyShareLink}
                          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition"
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>

                    {/* NEW PREMIUM CARD */}
                    <div className="mt-6 grid place-items-center">
                      <div
                        ref={cardRef}
                        className="relative w-full max-w-[640px] overflow-hidden rounded-[30px] border border-white/10 bg-[#07070A] p-7"
                      >
                        {/* background layers */}
                        <div aria-hidden className="pointer-events-none absolute inset-0">
                          <div className="absolute -top-28 left-1/2 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.22),_transparent_62%)] blur-2xl" />
                          <div className="absolute -bottom-40 left-1/2 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.14),_transparent_60%)] blur-2xl" />
                          <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:56px_56px]" />
                          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,transparent_0%,rgba(7,7,10,0.50)_55%,rgba(7,7,10,0.98)_100%)]" />
                          <div className="absolute -right-16 top-12 opacity-[0.06] rotate-12">
                            <div className="text-[120px] font-semibold tracking-tight text-white">STRENDEX</div>
                          </div>
                        </div>

                        {/* header */}
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
                              <img
                                src="/logo.png"
                                alt="Strendex"
                                className="h-full w-full object-cover p-0 scale-[1.08]"
                                crossOrigin="anonymous"
                              />
                            </div>
                            <div className="leading-none">
                              <div className="text-sm font-semibold tracking-wide text-white">STRENDEX</div>
                              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400">
                                ATHLETE CARD
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
  <div className="text-[10px] uppercase tracking-widest text-zinc-400">Standing</div>
  <div className="mt-1 text-sm font-semibold text-white">
    {topPercent === null ? "—" : `Better than ${Math.max(0, 100 - topPercent)}%`}
  </div>
  <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
    of athletes
  </div>
</div>
                        </div>

                        {/* main row */}
                        <div className="relative z-10 mt-6 grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-end">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-400">Athlete</div>
                            <div className="mt-1 text-[26px] font-semibold tracking-tight text-white">
                              {displayName.trim() ? displayName.trim() : "Anonymous Athlete"}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">

  <span
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest ${rankMeta[currentRank].pill}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
    {currentRank}
  </span>

  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-200">
    <span className="grid h-5 w-5 place-items-center rounded-full bg-black/40 text-emerald-300">
      <ArchetypeIcon archetype={currentArchetype} className="h-3.5 w-3.5" />
    </span>
    {currentArchetype}
  </span>

  {globalRank !== null && totalAthletes !== null && (
  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-200">
    #{globalRank} / {totalAthletes}
  </span>
)}

{topPercent !== null && (
  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-emerald-300">
    BETTER THAN {Math.max(0, 100 - topPercent)}%
  </span>
)}

</div>

                            <div className="mt-3 text-xs text-zinc-300">
                              <span className="font-semibold text-white">{archetypeInfo.tagline}</span>
                            </div>
                          </div>

                          <div className="text-right">
  <div className="text-[10px] uppercase tracking-widest text-zinc-400">Hybrid Quotient</div>

  <div className="mt-1 text-[72px] font-semibold tracking-tight text-white drop-shadow-[0_0_24px_rgba(34,197,94,0.45)] leading-none">
    {Number.isFinite(hqScore) ? hqScore : 0}
  </div>

  <div className="mt-2 text-[11px] text-zinc-400 uppercase tracking-widest">
    HQ Score
  </div>
</div>
                        </div>

                        {/* premium gauges (NO bars) */}
                        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Strength</div>
                              <div className="text-[10px] font-semibold text-zinc-200">{strengthIndex}/100</div>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <MiniRing value={strengthIndex} variant="strength" />
                              <div className="text-xs text-zinc-400 leading-snug">
                                Lift index based on BW normalization.
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Endurance</div>
                              <div className="text-[10px] font-semibold text-zinc-200">{enduranceIndex}/100</div>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <MiniRing value={enduranceIndex} variant="endurance" />
                              <div className="text-xs text-zinc-400 leading-snug">
                                Pace index from 5K time.
                              </div>
                            </div>
                          </div>
                        </div>
{/* Hybrid Balance Meter */}
<div className="relative z-10 mt-6 rounded-2xl border border-white/10 bg-black/35 p-4">
  <div className="flex items-center justify-between">
    <div className="text-[10px] uppercase tracking-widest text-zinc-400">
      Hybrid Balance
    </div>
  </div>

  <div className="mt-4 relative h-[6px] w-full rounded-full bg-white/[0.08]">
  <div
  className="absolute top-1/2 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]"
  style={{
    left: `${balancePosition}%`,
    transform: "translate(-50%, -50%)",
  }}
/>
  </div>

  <div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
    <span>Strength</span>
    <span>Endurance</span>
  </div>
</div>
                        {/* stats */}
                        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 text-sm">
                          {[
                            { label: "Bodyweight", value: w > 0 ? `${w} lbs` : "—" },
                            { label: "5K", value: format5KFromMinutes(fiveKMin) },
                            { label: "Bench", value: b > 0 ? `${b} lbs` : "—" },
                            { label: "Squat", value: s > 0 ? `${s} lbs` : "—" },
                            { label: "Deadlift", value: d > 0 ? `${d} lbs` : "—" },
                            { label: "Total", value: totalLift > 0 ? `${totalLift} lbs` : "—" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-400">{item.label}</div>
                              <div className="mt-1 font-semibold text-white">{item.value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 uppercase tracking-[0.25em]">
  <span>STRENDEX PERFORMANCE REPORT</span>
  <span className="text-zinc-600">TEST YOURSELF → {siteLabel}</span>
</div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {/* Advanced (optional) */}
                {showAdvanced && !isScanning ? (
                  <>
                    <div
                      id="profile"
                      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
                    >
                      <div aria-hidden className="absolute inset-0">
                        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.18),_transparent_65%)] blur-2xl" />
                      </div>

                      <div className="relative z-10 flex items-center justify-between gap-6">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Radar</div>
                          <h3 className="mt-2 text-xl font-semibold text-white">Performance Signature</h3>
                          <p className="mt-1 text-sm text-zinc-400">Normalized across lifts and 5K pace.</p>
                        </div>

                        <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ACTIVE
                        </div>
                      </div>

                      <div className="relative z-10 mt-6 grid place-items-center rounded-2xl border border-white/10 bg-black/30 p-4 md:p-6">
                        <StrendexChart data={chartData} />
                      </div>
                    </div>

                    <div id="standards" className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                      <div className="flex items-center justify-between px-6 py-5">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Standards</div>
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
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-white/10">
                            {[
                              { label: "WORLD CLASS", range: "6.0+" },
                              { label: "ELITE", range: "4.5 – 5.9" },
                              { label: "ADVANCED", range: "3.0 – 4.4" },
                              { label: "INTERMEDIATE", range: "1.5 – 2.9" },
                              { label: "NOVICE", range: "0.0 – 1.4" },
                            ].map((row) => {
                              const active = currentRank === (row.label as Rank);
                              return (
                                <tr key={row.label} className={active ? "bg-emerald-400/10" : ""}>
                                  <td className="px-6 py-4 font-semibold text-zinc-200">{row.label}</td>
                                  <td className="px-6 py-4 text-zinc-400">{row.range}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}

                {/* Small footer nav */}
                {!isScanning ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-zinc-400">Tip: use true 1RMs and your most recent 5K time.</p>
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
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
{/* Sticky Results Dock (mobile-first) */}
{showResults && !isScanning && (
  <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#020203]/80 backdrop-blur-xl md:hidden">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white leading-none">
            HQ {Number.isFinite(hqScore) ? hqScore : 0}
          </div>

          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-widest ${rankMeta[currentRank].pill}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {currentRank}
          </span>

          {topPercent !== null && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-emerald-300">
              TOP {topPercent}%
            </span>
          )}
        </div>

        <div className="mt-1 truncate text-[11px] text-zinc-500 uppercase tracking-[0.22em]">
          {displayName.trim() ? displayName.trim() : "Anonymous Athlete"}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={downloadScorecard}
          className="inline-flex items-center justify-center rounded-full bg-white px-3 py-2 text-[11px] font-semibold tracking-widest text-black"
        >
          PNG
        </button>

        <button
          onClick={copyShareLink}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold tracking-widest text-white"
        >
          LINK
        </button>
      </div>
    </div>
  </div>
)}
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

/** Premium ring gauge (used in share card) */
function MiniRing({ value, variant }: { value: number; variant: "strength" | "endurance" }) {
  const clamped = Math.min(100, Math.max(0, value));
  const size = 44;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  const id = variant === "strength" ? "gradStrength" : "gradEndurance";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id="gradStrength" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(34,197,94,0.95)" />
          <stop offset="1" stopColor="rgba(34,197,94,0.22)" />
        </linearGradient>
        <linearGradient id="gradEndurance" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(59,130,246,0.95)" />
          <stop offset="1" stopColor="rgba(59,130,246,0.22)" />
        </linearGradient>
      </defs>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={`url(#${id})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        fontSize="10"
        fill="rgba(255,255,255,0.85)"
        fontWeight="600"
        fontFamily="ui-sans-serif, system-ui, -apple-system"
      >
        {Math.round(clamped)}
      </text>
    </svg>
  );
}

/** Professional badge icons (SVG), no emojis */
function ArchetypeBadge({ archetype }: { archetype: Archetype }) {
  const meta: Record<Archetype, { label: string; ring: string; bg: string; icon: ReactNode }> = {
    "STRENGTH BEAST": {
      label: "Strength Beast",
      ring: "border-emerald-400/20",
      bg: "bg-emerald-400/10 text-emerald-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M4 12c2.5-3.5 5.5-5 8-5s5.5 1.5 8 5c-2.5 3.5-5.5 5-8 5s-5.5-1.5-8-5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M7.2 10.6 6 9.4M16.8 10.6 18 9.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    "ENGINE MACHINE": {
      label: "Engine Machine",
      ring: "border-sky-400/20",
      bg: "bg-sky-400/10 text-sky-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    "BALANCED HYBRID": {
      label: "Balanced Hybrid",
      ring: "border-violet-400/20",
      bg: "bg-violet-400/10 text-violet-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 7h12M7.5 17h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M8 7c0 4-2 6-2 6h4s-2-2-2-6ZM16 7c0 4 2 6 2 6h-4s2-2 2-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    "POWER HYBRID": {
      label: "Power Hybrid",
      ring: "border-amber-400/20",
      bg: "bg-amber-400/10 text-amber-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M12 2 5 9l7 13 7-13-7-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 6v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "ENDURANCE-LEANING HYBRID": {
      label: "Endurance Leaning",
      ring: "border-sky-400/20",
      bg: "bg-sky-400/10 text-sky-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M7 14c2-6 4-9 5-9s3 3 5 9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M5 19h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "STRENGTH-LEANING HYBRID": {
      label: "Strength Leaning",
      ring: "border-emerald-400/20",
      bg: "bg-emerald-400/10 text-emerald-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M7 9h10M9 7v10M15 7v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4 12h3M17 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "BASE BUILDER": {
      label: "Base Builder",
      ring: "border-white/10",
      bg: "bg-white/[0.03] text-zinc-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M5 19V9l7-4 7 4v10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 19v-6h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
  };

  const m = meta[archetype];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-widest ${m.ring} ${m.bg}`}
      title={m.label}
    >
      <span className="grid place-items-center">{m.icon}</span>
      {m.label}
    </span>
  );
}

function TextField({
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
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={24}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
      />
    </div>
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