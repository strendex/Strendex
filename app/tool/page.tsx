"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import StrendexChart from "./StrendexChart";
import { toPng } from "html-to-image";

type Tier = "WORLD CLASS" | "ELITE" | "ADVANCED" | "INTERMEDIATE" | "NOVICE";
type Archetype =
  | "BALANCED HYBRID"
  | "STRENGTH BEAST"
  | "ENDURANCE MACHINE"
  | "POWER HYBRID"
  | "ENDURANCE-LEANING HYBRID"
  | "STRENGTH-LEANING HYBRID"
  | "BASE BUILDER";

type RunDistance = "3mi" | "5k" | "10k" | "half" | "marathon";
type UnitSystem = "lb" | "kg";

const ARCHETYPE_COPY: Record<
  Archetype,
  { tagline: string; description: string; focus: string }
> = {
  "STRENGTH BEAST": {
    tagline: "Strength-dominant — endurance is the limiter.",
    description:
      "Your strength output is significantly higher than your endurance capacity. You’ll score well off the big lifts, but your endurance is the main thing holding your hybrid profile back.",
    focus:
      "Add 2–3 aerobic sessions/week (easy Zone 2) + 1 short interval day. Keep lifting heavy, but avoid maxing too often.",
  },
  "ENDURANCE MACHINE": {
    tagline: "Endurance-dominant — strength is the limiter.",
    description:
      "Your endurance is strong relative to your strength totals. Your endurance boosts your profile, but adding strength will raise your overall score quickly.",
    focus:
      "Maintain running 2–3 days/week, then push progressive overload on bench/squat/deadlift (2–4 hard sets each, 2–3x/week).",
  },
  "BALANCED HYBRID": {
    tagline: "Well-rounded — strength and endurance are aligned.",
    description:
      "You’re relatively balanced: both strength and endurance contribute similarly. This is the classic hybrid profile.",
    focus:
      "Progress both slowly: 1–2 strength PR attempts/month and 1 structured run workout/week. Avoid huge spikes in total volume.",
  },
  "POWER HYBRID": {
    tagline: "High-high — strong and fast together.",
    description:
      "You’re strong and you’ve got a solid endurance. This profile pushes into elite territory when trained consistently.",
    focus:
      "Keep strength volume efficient (quality over quantity) and add running quality (tempo + intervals). Prioritize recovery and sleep.",
  },
  "ENDURANCE-LEANING HYBRID": {
    tagline: "Endurance-leaning — still decently strong.",
    description:
      "Your endurance is ahead, but you’ve got more strength than the average runner. A focused strength block can raise your score a lot.",
    focus:
      "Keep 2 quality runs/week and add 2–3 strength sessions focused on squat/hinge/press progressions.",
  },
  "STRENGTH-LEANING HYBRID": {
    tagline: "Strength-leaning — still decent endurance.",
    description:
      "Your strength is ahead, but your endurance is not far behind. Building your aerobic base will make you much more complete.",
    focus:
      "Maintain lifting intensity, add 2–3 Zone 2 sessions/week, and retest your endurance time after 4–6 weeks.",
  },
  "BASE BUILDER": {
    tagline: "Early stage — build the foundation.",
    description:
      "You haven’t filled enough stats yet (or they’re very low). The goal is consistent training and clean technique.",
    focus:
      "Start simple: 3 days lifting + 2 days easy running each week. Retest your numbers after 6–8 weeks.",
  },
};

// ---------- Helpers ----------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseTimeToSeconds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

  if (parts.length === 2) {
    const mm = Number(parts[0]);
    const ss = Number(parts[1]);
    if (mm < 0 || ss < 0 || ss >= 60) return null;
    return mm * 60 + ss;
  }

  if (parts.length === 3) {
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2]);
    if (hh < 0 || mm < 0 || mm >= 60 || ss < 0 || ss >= 60) return null;
    return hh * 3600 + mm * 60 + ss;
  }

  return null;
}

function formatDigitsToTime(digitsRaw: string): string {
  const digits = digitsRaw.replace(/\D/g, "").slice(0, 6);
  if (!digits) return "";

  if (digits.length <= 2) {
    const min = Number(digits);
    if (!Number.isFinite(min)) return "";
    return `${min}:00`;
  }

  if (digits.length <= 4) {
    const sec = Number(digits.slice(-2));
    const min = Number(digits.slice(0, -2));
    if (!Number.isFinite(min) || !Number.isFinite(sec)) return "";
    const secClamped = Math.max(0, Math.min(59, sec));
    return `${min}:${String(secClamped).padStart(2, "0")}`;
  }

  const sec = Number(digits.slice(-2));
  const min = Number(digits.slice(-4, -2));
  const hr = Number(digits.slice(0, -4));
  if (!Number.isFinite(hr) || !Number.isFinite(min) || !Number.isFinite(sec)) return "";

  const secClamped = Math.max(0, Math.min(59, sec));
  const minClamped = Math.max(0, Math.min(59, min));

  return `${hr}:${String(minClamped).padStart(2, "0")}:${String(secClamped).padStart(2, "0")}`;
}

function distanceMeters(d: RunDistance): number {
  switch (d) {
    case "3mi":
      return 4828.032;
    case "5k":
      return 5000;
    case "10k":
      return 10000;
    case "half":
      return 21097.5;
    case "marathon":
      return 42195;
  }
}

function toHalfMarathonEquivalentSeconds(inputSeconds: number, dist: RunDistance): number {
  const D1 = distanceMeters(dist);
  const D2 = distanceMeters("half");
  const exponent = 1.06;
  const ratio = D2 / D1;
  return Math.round(inputSeconds * Math.pow(ratio, exponent));
}

function lbToKg(lb: number): number {
  return lb / 2.2046226218;
}
function kgToLb(kg: number): number {
  return kg * 2.2046226218;
}

function getTier(score: number): Tier {
  if (score >= 90) return "WORLD CLASS";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "NOVICE";
}

function getArchetype(str: number, end: number): Archetype {
  if (str < 10 && end < 10) return "BASE BUILDER";

  const diff = str - end;

  if (str >= 75 && end >= 75) return "POWER HYBRID";
  if (diff >= 20) return "STRENGTH BEAST";
  if (diff <= -20) return "ENDURANCE MACHINE";
  if (Math.abs(diff) <= 8) return "BALANCED HYBRID";
  if (diff > 0) return "STRENGTH-LEANING HYBRID";
  return "ENDURANCE-LEANING HYBRID";
}

const tierMeta: Record<Tier, { pill: string; glow: string }> = {
  "WORLD CLASS": {
    pill: "border-[#DFFF00]/25 bg-[#DFFF00]/10 text-[#DFFF00]",
    glow: "shadow-[0_0_50px_rgba(223,255,0,0.12)]",
  },
  ELITE: {
    pill: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    glow: "shadow-[0_0_40px_rgba(56,189,248,0.12)]",
  },
  ADVANCED: {
    pill: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    glow: "shadow-[0_0_40px_rgba(167,139,250,0.12)]",
  },
  INTERMEDIATE: {
    pill: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.10)]",
  },
  NOVICE: {
    pill: "border-white/10 bg-white/[0.03] text-zinc-300",
    glow: "",
  },
};

// ---------- Page ----------

type Step = 1 | 2 | 3 | 4;

export default function ToolPage() {
  // identity + units
  const [displayName, setDisplayName] = useState<string>("");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("lb");

  // inputs (strings to keep empties)
  const [weight, setWeight] = useState<string>("");

  const [bench, setBench] = useState<string>("");
  const [squat, setSquat] = useState<string>("");
  const [deadlift, setDeadlift] = useState<string>("");

  const [runDistance, setRunDistance] = useState<RunDistance>("5k");
  const [runTimeDigits, setRunTimeDigits] = useState<string>("");
  const runTimeText = formatDigitsToTime(runTimeDigits);

  // UX flow
  const [step, setStep] = useState<Step>(1);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // saving / scan moment
  const [isWorking, setIsWorking] = useState(false);
const [scanStage, setScanStage] = useState<"CALIBRATING" | "SCORING" | "COMPILING">("CALIBRATING");
const [statusText, setStatusText] = useState<string>("");

  // results
  const [hasResults, setHasResults] = useState(false);
  const [hybridScore, setHybridScore] = useState<number>(0);
  const [strengthPercentile, setStrengthPercentile] = useState<number | null>(null);
  const [endurancePercentile, setEndurancePercentile] = useState<number | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [totalAthletes, setTotalAthletes] = useState<number | null>(null);
  const [betterThanPercent, setBetterThanPercent] = useState<number | null>(null);
  const [apiStrengthIndex, setApiStrengthIndex] = useState<number | null>(null);
const [apiEnduranceIndex, setApiEnduranceIndex] = useState<number | null>(null);
 

  
  const [siteLabel, setSiteLabel] = useState<string>("strendex");
  const cardRef = useRef<HTMLDivElement | null>(null);

  // parsed
  const wInput = Number(weight) || 0;
  const bInput = Number(bench) || 0;
  const sInput = Number(squat) || 0;
  const dInput = Number(deadlift) || 0;

  // normalize to LB for local ratios / display
  const wLb = unitSystem === "kg" ? kgToLb(wInput) : wInput;
  const bLb = unitSystem === "kg" ? kgToLb(bInput) : bInput;
  const sLb = unitSystem === "kg" ? kgToLb(sInput) : sInput;
  const dLb = unitSystem === "kg" ? kgToLb(dInput) : dInput;

  // endurance -> half-equivalent seconds
  const runSeconds = parseTimeToSeconds(runTimeText) ?? 0;
  const enduranceEqSeconds =
    runSeconds > 0 ? toHalfMarathonEquivalentSeconds(runSeconds, runDistance) : 0;

  // local indices (for archetype + chart only; canonical score comes from API)
  const totalLift = bLb + sLb + dLb;
  const strengthRatio = wLb > 0 ? totalLift / wLb : 0;

  const benchIndex = wLb > 0 ? clamp((bLb / (wLb * 1.5)) * 100, 0, 100) : 0;
  const squatIndex = wLb > 0 ? clamp((sLb / (wLb * 2.0)) * 100, 0, 100) : 0;
  const deadIndex = wLb > 0 ? clamp((dLb / (wLb * 2.5)) * 100, 0, 100) : 0;
  const strengthIndex = Number(((benchIndex + squatIndex + deadIndex) / 3).toFixed(1));

  const END_MIN_SEC = 4200;
  const END_MAX_SEC = 10800;
  const enduranceIndex = Number(
    (enduranceEqSeconds > 0
      ? clamp(((END_MAX_SEC - enduranceEqSeconds) / (END_MAX_SEC - END_MIN_SEC)) * 100, 0, 100)
      : 0
    ).toFixed(1)
  );

  // Default before API returns
  const firstArchetype = Object.keys(ARCHETYPE_COPY)[0] as Archetype;
  const [computedArchetype, setComputedArchetype] = useState<Archetype>(firstArchetype);

// Use computedArchetype for UI copy
const archetypeInfo = ARCHETYPE_COPY[computedArchetype];

  const tier = useMemo(() => getTier(hybridScore), [hybridScore]);

  const chartData = useMemo(() => {
    return [
      { subject: "Bench", value: benchIndex },
      { subject: "Squat", value: squatIndex },
      { subject: "Deadlift", value: deadIndex },
      { subject: "Endurance", value: enduranceIndex },
    ];
  }, [benchIndex, squatIndex, deadIndex, enduranceIndex]);

  const canContinueStep1 = wLb > 0;
  const canContinueStep2 = wLb > 0 && (bLb > 0 || sLb > 0 || dLb > 0);
  const canContinueStep3 = wLb > 0 && (runSeconds > 0);
  const canGenerate =
    wLb > 0 && (bLb > 0 || sLb > 0 || dLb > 0 || runSeconds > 0) && !isWorking;

  function cleanedName() {
    const clean = displayName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 ._-]/g, "");
    return clean.length >= 2 ? clean : "Anonymous Athlete";
  }

  function validateInputsOrThrow() {
    if (!wLb || wLb < 80 || wLb > 400) {
      throw new Error("Bodyweight must be between 80 and 400 lb (or equivalent).");
    }

    if (bLb > 0 && (bLb < 45 || bLb > 700)) {
      throw new Error("Bench must be between 45 and 700 lb (or equivalent).");
    }
    if (sLb > 0 && (sLb < 45 || sLb > 900)) {
      throw new Error("Squat must be between 45 and 900 lb (or equivalent).");
    }
    if (dLb > 0 && (dLb < 45 || dLb > 1000)) {
      throw new Error("Deadlift must be between 45 and 1000 lb (or equivalent).");
    }

    if (bLb > 0 && bLb / wLb > 3.2) throw new Error("Bench/bodyweight ratio looks unrealistic.");
    if (sLb > 0 && sLb / wLb > 4.0) throw new Error("Squat/bodyweight ratio looks unrealistic.");
    if (dLb > 0 && dLb / wLb > 4.5) throw new Error("Deadlift/bodyweight ratio looks unrealistic.");

    if (runTimeText.trim()) {
      const parsed = parseTimeToSeconds(runTimeText);
      if (parsed === null) throw new Error("Time must be mm:ss or hh:mm:ss (e.g., 22:30 or 1:32:10).");
      if (parsed < 4 * 60 || parsed > 8 * 3600) {
        throw new Error("Time looks out of range. Please double-check your entry.");
      }
    }
  }

  async function computeScoreFromAPI() {
    
    // Canonical inputs to API: KG + endurance seconds (half-equivalent)
    const bodyweight_kg = unitSystem === "lb" ? lbToKg(wLb) : wInput;
    const bench_kg = bInput > 0 ? (unitSystem === "lb" ? lbToKg(bLb) : bInput) : null;
    const squat_kg = sInput > 0 ? (unitSystem === "lb" ? lbToKg(sLb) : sInput) : null;
    const deadlift_kg = dInput > 0 ? (unitSystem === "lb" ? lbToKg(dLb) : dInput) : null;

    const endurance_seconds = runSeconds > 0 ? enduranceEqSeconds : null;

    const res = await fetch("/api/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyweight_kg,
        endurance_seconds,
        bench_kg,
        squat_kg,
        deadlift_kg,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("API /api/rank error:", data);
      throw new Error(data?.error ?? "Scoring failed");
    }

    const hq = typeof data.hq === "number" ? Math.round(data.hq) : 0;
    const strP = typeof data.strengthPercentile === "number" ? data.strengthPercentile : null;
    const endP = typeof data.endurancePercentile === "number" ? data.endurancePercentile : null;
    const apiStrengthIndex = typeof data.strengthIndex === "number" ? data.strengthIndex : null;
const apiEnduranceIndex = typeof data.enduranceIndex === "number" ? data.enduranceIndex : null;

const rankRaw = typeof data.rank === "number" ? data.rank : null;
const totalRaw = typeof data.total === "number" ? data.total : null;
const betterThanFromApi =
  typeof data.betterThanPercent === "number" ? data.betterThanPercent : null;

// normalize rank to 1-based (defensive)
let rankPos: number | null = rankRaw;
if (rankRaw !== null) {
  let cleanRank = rankRaw;
  if (cleanRank === 0) cleanRank = 1;
  cleanRank = Math.max(1, Math.floor(cleanRank));
  rankPos = cleanRank;
}

// fallback if API field is missing for any reason
let betterThan: number | null = betterThanFromApi;
if (betterThan === null && rankPos !== null && totalRaw !== null && totalRaw > 0) {
  betterThan = clamp(((totalRaw - rankPos) / totalRaw) * 100, 0, 100);
}

return {
  hq,
  strP,
  endP,
  rankPos,
  totalRaw,
  betterThan,
  endurance_seconds,
  apiStrengthIndex,
  apiEnduranceIndex,
};
  }

  async function saveSubmissionToServer(args: {
    finalName: string;
    hq: number;
    strP: number | null;
    endP: number | null;
    endurance_seconds_for_db: number | null;
    apiStrengthIndex: number | null;
    apiEnduranceIndex: number | null;
    computedArchetype: Archetype;
  }) {
    const {
      finalName,
      hq,
      strP,
      endP,
      endurance_seconds_for_db,
      apiStrengthIndex,
      apiEnduranceIndex,
      computedArchetype,
    } = args;
  
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        athlete_name: finalName,
        bodyweight: wLb,
        endurance_seconds: endurance_seconds_for_db,
        bench: bLb || null,
        squat: sLb || null,
        deadlift: dLb || null,
        hq_score: hq,
        rank: getTier(hq),
        archetype: computedArchetype,
        strength_index: apiStrengthIndex,
        endurance_index: apiEnduranceIndex,
        total_lift: totalLift,
        strength_ratio: strengthRatio,
        strength_percentile: strP,
        endurance_percentile: endP,
      }),
    });
  
    const data = await res.json();
  
    if (!res.ok) {
      return { error: { message: data?.error ?? "Failed to save submission." } };
    }
  
    return { error: null };
  }

  async function generateProfile() {
    try {
      if (!canGenerate) return;

      validateInputsOrThrow();

      setIsWorking(true);
      setStatusText("");
      setScanStage("CALIBRATING");
      setHasResults(true);

      const resultsEl = document.getElementById("results");
      if (resultsEl) resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });

      await new Promise((r) => setTimeout(r, 250));
      setScanStage("SCORING");
      await new Promise((r) => setTimeout(r, 350));
      setScanStage("COMPILING");
      await new Promise((r) => setTimeout(r, 250));

      const finalName = cleanedName();
      const computed = await computeScoreFromAPI();
      const a = getArchetype(computed.strP ?? 0, computed.endP ?? 0);
setComputedArchetype(a);

      // Apply UI states immediately (do NOT rely on async setState for DB values)
      setHybridScore(computed.hq);
      setStrengthPercentile(computed.strP);
      setEndurancePercentile(computed.endP);
      setGlobalRank(computed.rankPos);
      setTotalAthletes(computed.totalRaw);
      setBetterThanPercent(computed.betterThan);
      setApiStrengthIndex(computed.apiStrengthIndex);
      setApiEnduranceIndex(computed.apiEnduranceIndex);

      

                  // Save to Supabase with canonical computed values
      setStatusText("Saving to rankings…");
      const { error } = await saveSubmissionToServer({
        finalName,
        hq: computed.hq,
        strP: computed.strP,
        endP: computed.endP,
        endurance_seconds_for_db: computed.endurance_seconds,
        apiStrengthIndex: computed.apiStrengthIndex,
        apiEnduranceIndex: computed.apiEnduranceIndex,
        computedArchetype: a,
      });

      if (error) {
        console.error("[SAVE ERROR]", error);
        setStatusText(`Couldn’t save to rankings: ${error.message}`);
        alert(`Couldn’t save to rankings: ${error.message}`);
      } else {
        setStatusText(
          computed.hq >= 90
            ? "Submitted — pending verification (won’t appear on leaderboard yet)."
            : "Saved to rankings."
        );
      }

      // Move user to results view
      // Move user to results view
setStep(4);
setShowDetails(false);

if (!error) {
  setTimeout(() => setStatusText(""), 1800);
}
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Something went wrong.");
      setStatusText(e?.message ?? "Something went wrong.");
    } finally {
      setIsWorking(false);
    }
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
      link.download = "strendex-card.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Could not generate image. Try again.");
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

    params.set("u", unitSystem);
    params.set("dist", runDistance);
    if (runTimeText.trim()) params.set("t", runTimeText.trim());

    const url = `${window.location.origin}/tool?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(url);
      alert("Share link copied.");
    } catch {
      alert("Could not copy link.");
    }
  };

  // load share params + localStorage name
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSiteLabel(window.location.host);

    const sharedName = params.get("name");
    const sharedBw = params.get("bw");
    const sharedB = params.get("b");
    const sharedS = params.get("s");
    const sharedD = params.get("d");

    const sharedU = params.get("u") as UnitSystem | null;
    const sharedDist = params.get("dist") as RunDistance | null;
    const sharedT = params.get("t");

    const hasSharedStats = Boolean(sharedBw || sharedB || sharedS || sharedD || sharedT);

    if (sharedName) {
      setDisplayName(sharedName);
      localStorage.setItem("strendex_name", sharedName);
    } else {
      const savedName = localStorage.getItem("strendex_name");
      if (savedName) setDisplayName(savedName);
    }

    if (sharedU === "lb" || sharedU === "kg") setUnitSystem(sharedU);
    if (sharedDist && ["3mi", "5k", "10k", "half", "marathon"].includes(sharedDist)) {
      setRunDistance(sharedDist);
    }
    if (sharedT) setRunTimeDigits(sharedT.replace(/\D/g, "").slice(0, 6));

    if (sharedBw) setWeight(sharedBw);
    if (sharedB) setBench(sharedB);
    if (sharedS) setSquat(sharedS);
    if (sharedD) setDeadlift(sharedD);

    if (hasSharedStats) {
      setHasResults(true);
      setStep(4);
    }
  }, []);

  // UI helpers
  const stepTitle: Record<Step, { kicker: string; title: string; sub: string }> = {
    1: {
      kicker: "Step 1 of 4",
      title: "Your basics",
      sub: "Start with your name and bodyweight.",
    },
    2: {
      kicker: "Step 2 of 4",
      title: "Your lifts",
      sub: "Enter your best recent numbers.",
    },
    3: {
      kicker: "Step 3 of 4",
      title: "Your run",
      sub: "Choose a distance and enter your time.",
    },
    4: {
      kicker: "Final step",
      title: "Review and calculate",
      sub: "Check your inputs, then generate your score.",
    },
  };

  const Progress = () => (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((n) => {
        const active = step === (n as Step);
        const done = step > (n as Step);
        return (
          <div
            key={n}
            className={`h-1.5 w-10 rounded-full transition ${
              done ? "bg-[#DFFF00]/70" : active ? "bg-white/70" : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );

  return (
    <section className="mx-auto max-w-7xl">
      {/* Top header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-white/50">Hybrid Athlete Benchmark</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Calculate your <span className="text-[#DFFF00]">Hybrid Score</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/70">
  Enter your lifts and run time to see where you rank.
</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
  <Progress />
  <div className="hidden sm:block text-sm text-white/70">Takes about a minute</div>
</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT — Guided input card */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
              <div className="text-sm font-medium text-white/60">
  {stepTitle[step].kicker}
</div>
<div className="mt-2 text-2xl font-semibold text-white">{stepTitle[step].title}</div>
<div className="mt-1 text-base text-white/70">{stepTitle[step].sub}</div>
              </div>

              {/* Units toggle */}
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/30">
  <button
    type="button"
    onClick={() => setUnitSystem("lb")}
    className={`px-4 py-2 text-sm font-semibold transition ${
      unitSystem === "lb" ? "bg-white text-black" : "text-white/70 hover:bg-white/[0.06]"
    }`}
  >
    LB
  </button>
  <button
    type="button"
    onClick={() => setUnitSystem("kg")}
    className={`px-4 py-2 text-sm font-semibold transition ${
      unitSystem === "kg" ? "bg-white text-black" : "text-white/70 hover:bg-white/[0.06]"
    }`}
  >
    KG
  </button>
</div>
            </div>

            <div className="mt-6 space-y-4">
              {/* STEP 1 */}
              {step === 1 && (
                <>
                  <TextField
                    label="Display name"
                    placeholder="e.g., Ryan"
                    value={displayName}
                    onChange={(value) => {
                      setDisplayName(value);
                      localStorage.setItem("strendex_name", value);
                    }}
                  />

                  <Field
                    label={`Bodyweight (${unitSystem.toUpperCase()})`}
                    placeholder="e.g., 195"
                    value={weight}
                    onChange={setWeight}
                    hint="Used to normalize strength ratios."
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!canContinueStep1}
                      className="w-full rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
                    
                  </div>
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  <Field label={`Bench (${unitSystem.toUpperCase()})`} placeholder="e.g., 275" value={bench} onChange={setBench} />
                  <Field label={`Squat (${unitSystem.toUpperCase()})`} placeholder="e.g., 365" value={squat} onChange={setSquat} />
                  <Field label={`Deadlift (${unitSystem.toUpperCase()})`} placeholder="e.g., 425" value={deadlift} onChange={setDeadlift} />

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between text-sm">
  <span className="text-white/70">Total lift</span>
  <span className="text-white font-semibold">{totalLift > 0 ? `${Math.round(totalLift)} lb` : "—"}</span>
</div>
<div className="mt-2 flex items-center justify-between text-sm">
  <span className="text-white/70">Strength ratio</span>
  <span className="text-white font-semibold">{strengthRatio > 0 ? strengthRatio.toFixed(2) : "—"}</span>
</div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!canContinueStep2}
                      className="w-full rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>

                  <div className="text-sm text-white/60">
  You can still continue if you don’t have a run time yet.
</div>
                </>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        Endurance test
                      </label>
                      <select
                        value={runDistance}
                        onChange={(e) => setRunDistance(e.target.value as RunDistance)}
                        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-10 text-sm text-white outline-none transition hover:bg-white/[0.04] focus:border-[#DFFF00]/50 focus:ring-2 focus:ring-[#DFFF00]/10"
                      >
                        <option value="3mi">3 miles</option>
                        <option value="5k">5K</option>
                        <option value="10k">10K</option>
                        <option value="half">Half Marathon</option>
                        <option value="marathon">Marathon</option>
                      </select>
                      <div className="mt-1 text-sm text-white/55">All distances are adjusted to the same standard.</div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        Time
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={runTimeText}
                        placeholder="Type digits (2230 → 22:30)"
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setRunTimeDigits(digits);
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition hover:bg-white/[0.04] focus:border-[#DFFF00]/50 focus:ring-2 focus:ring-[#DFFF00]/10"
                        onKeyDown={(e) => {
                          const key = e.key;
                          if (
                            key === "Tab" ||
                            key === "ArrowLeft" ||
                            key === "ArrowRight" ||
                            key === "ArrowUp" ||
                            key === "ArrowDown" ||
                            key === "Home" ||
                            key === "End"
                          ) {
                            return;
                          }
                          const el = e.currentTarget;
                          const allSelected = el.selectionStart === 0 && el.selectionEnd === el.value.length;

                          if (key === "Backspace") {
                            e.preventDefault();
                            if (allSelected) return setRunTimeDigits("");
                            return setRunTimeDigits((prev) => prev.slice(0, -1));
                          }
                          if (key === "Delete") {
                            e.preventDefault();
                            return setRunTimeDigits("");
                          }
                          if (/^\d$/.test(key)) {
                            e.preventDefault();
                            return setRunTimeDigits((prev) => (prev + key).slice(0, 6));
                          }
                          e.preventDefault();
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData("text") || "";
                          const digits = pasted.replace(/\D/g, "").slice(0, 6);
                          setRunTimeDigits(digits);
                        }}
                      />

<div className="mt-1 text-sm text-white/55">
  {runTimeText ? `Formatted: ${runTimeText}` : "Enter digits only"}
</div>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      disabled={!canContinueStep3}
                      className="w-full rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>

                  <div className="text-sm text-white/60">
  For the best result, include both lifting and endurance.
</div>
                </>
              )}

              {/* STEP 4 — final CTA */}
              {step === 4 && (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-medium text-white/60">Review</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-base">
                      <Row label="Name" value={displayName.trim() ? displayName.trim() : "Anonymous Athlete"} />
                      <Row label="Bodyweight" value={wLb > 0 ? `${Math.round(wLb)} lb` : "—"} />
                      <Row label="Strength" value={totalLift > 0 ? `${Math.round(totalLift)} lb total` : "—"} />
                      <Row
                        label="Endurance"
                        value={runTimeText.trim() ? `${runDistance.toUpperCase()} • ${runTimeText.trim()}` : "—"}
                      />
                    </div>
                  </div>

                  <button
                    onClick={generateProfile}
                    disabled={!canGenerate}
                    className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {isWorking ? "Calculating…" : "Calculate Hybrid Score"}
                  </button>

                  {statusText ? (
  <div className="text-xs text-white/60">{statusText}</div>
) : (
  <div className="text-sm text-white/60">
    Your result will be submitted to the rankings automatically after calculating.
  </div>
)}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWeight("");
                        setBench("");
                        setSquat("");
                        setDeadlift("");
                        setRunTimeDigits("");
                        setHasResults(false);
                        setHybridScore(0);
                        setStrengthPercentile(null);
                        setEndurancePercentile(null);
                        setGlobalRank(null);
                        setTotalAthletes(null);
                        setBetterThanPercent(null);
                        setShowDetails(false);
                        setStatusText("");
                        setStep(1);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
  <div className="font-semibold text-white">How scoring works</div>
  <div className="mt-1">
    Your Hybrid Score combines your strength and endurance relative to the dataset.
  </div>
</div>
        </div>

        {/* RIGHT — Results / Reveal */}
        <div className="lg:col-span-7">
          <div id="results" />
          <div className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${tierMeta[tier].glow}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <div className="text-sm font-medium text-white/60">
  {isWorking ? "Computing" : hasResults ? "Your result" : "Ready when you are"}
</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Hybrid Score <span className="text-white/60">(0–100)</span>
                </h2>
                <p className="mt-2 text-base text-white/70">
  {hasResults
    ? "Here’s your Strendex result."
    : "Enter your stats on the left to generate your score."}
</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                <span className={`h-1.5 w-1.5 rounded-full ${isWorking ? "bg-[#DFFF00] animate-pulse" : "bg-white/30"}`} />
                {isWorking ? scanStage : "READY"}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                <div className="text-sm text-white/55">Hybrid Score</div>
                  <div className="mt-1 text-6xl font-semibold tracking-tight text-white">
  {hasResults ? Math.round(hybridScore) : "—"}
</div>
                </div>

                <div className="text-right">
                <div className="text-sm text-white/55">Tier</div>
                  <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-widest ${tierMeta[tier].pill}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {tier}
                  </div>
                </div>
              </div>

              {/* Dopamine-first stats */}
<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  <div className="text-sm text-white/55">You beat</div>
    <div className="mt-1 text-2xl font-semibold text-white">
      {betterThanPercent === null ? "—" : `${betterThanPercent.toFixed(1)}%`}
    </div>
    <div className="mt-1 text-[11px] text-white/55">of athletes</div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  <div className="text-sm text-white/55">Leaderboard</div>
    <div className="mt-1 text-2xl font-semibold text-white">
      {globalRank === null || totalAthletes === null ? "—" : `#${globalRank}`}
    </div>
    <div className="mt-1 text-[11px] text-white/55">
      {totalAthletes === null ? "—" : `out of ${totalAthletes}`}
    </div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  <div className="text-sm text-white/55">Athlete type</div>
    <div className="mt-1 text-sm font-semibold text-white">{computedArchetype}</div>
    <div className="mt-1 text-[11px] text-white/55 line-clamp-2">{archetypeInfo.tagline}</div>
  </div>
</div>


            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
  <button
    onClick={() => setShowDetails((v) => !v)}
    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
  >
    {showDetails ? "Hide details" : "Show details"}
  </button>

  

  <Link
    href="/rankings"
    className="w-full rounded-2xl bg-[#DFFF00] px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
  >
    View Rankings
  </Link>
</div>


    


            {/* Details */}
            {showDetails && (
              <div className="mt-6 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Archetype</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ArchetypeBadge archetype={computedArchetype} />
                    <span className="text-sm text-white/70">{archetypeInfo.tagline}</span>
                  </div>

                  <div className="mt-3 text-sm text-white/60 leading-relaxed">{archetypeInfo.description}</div>
                  <div className="mt-3 text-sm">
                    <span className="font-semibold text-white">Focus:</span>{" "}
                    <span className="text-white/60">{archetypeInfo.focus}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Performance signature</div>
                  <div className="mt-4 grid place-items-center rounded-2xl border border-white/10 bg-[#020203] p-4">
                    <StrendexChart data={chartData} />
                  </div>
                </div>

                {/* Share Card */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Share</div>
                      <div className="mt-1 text-lg font-semibold text-white">Athlete Card</div>
                      <div className="mt-1 text-sm text-white/60">Download it or copy a share link.</div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={downloadScorecard}
                        className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                      >
                        Download
                      </button>
                      <button
                        onClick={copyShareLink}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                  

                  <div className="mt-5 grid place-items-center">
                    <div
                      ref={cardRef}
                      className="relative w-full max-w-[680px] overflow-hidden rounded-[32px] border border-white/10 bg-[#07070A] p-6"
                    >
                      <div aria-hidden className="pointer-events-none absolute inset-0">
                        <div className="absolute -top-44 left-1/2 h-[560px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(223,255,0,0.22),_transparent_62%)] blur-3xl" />
                        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:56px_56px]" />
                        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,transparent_0%,rgba(7,7,10,0.55)_55%,rgba(7,7,10,0.98)_100%)]" />
                      </div>

                      <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold tracking-wide text-white">STRENDEX</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/50">
                              HYBRID ATHLETE CARD
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-widest text-white/40">Standing</div>
                            <div className="mt-1 text-sm font-semibold text-white">
                            {betterThanPercent === null ? "—" : `Better than ${betterThanPercent.toFixed(1)}%`}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-widest text-white/40">Athlete</div>
                            <div className="mt-1 truncate text-[26px] font-semibold tracking-tight text-white">
                              {displayName.trim() ? displayName.trim() : "Anonymous Athlete"}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest ${tierMeta[tier].pill}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                                {tier}
                              </span>

                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold tracking-widest text-white">
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-black/40 text-[#DFFF00]">
                                  <ArchetypeIcon archetype={computedArchetype} className="h-3.5 w-3.5" />
                                </span>
                                {computedArchetype}
                              </span>

                              {globalRank !== null && totalAthletes !== null && (
                                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold tracking-widest text-white">
                                  #{globalRank} / {totalAthletes}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 text-sm text-white/60">
                              <span className="font-semibold text-white">{archetypeInfo.tagline}</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className="text-[10px] uppercase tracking-widest text-white/40">Hybrid Score</div>
                            <div className="mt-1 text-[78px] font-semibold leading-none tracking-tight text-white drop-shadow-[0_0_30px_rgba(223,255,0,0.26)]">
                            {hasResults ? Math.round(hybridScore) : 0}
                            </div>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/50">
                              0–100
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/40">
                          <span>STRENDEX</span>
                          <span className="text-white/30">TEST YOURSELF → {siteLabel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ranking bands */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Tiers</div>
                      <div className="mt-1 text-base font-semibold text-white">Score bands</div>
                    </div>
                    <Link
                      href="/rankings"
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Open rankings →
                    </Link>
                  </div>

                  <div className="border-t border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-white/40">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Tier</th>
                          <th className="px-5 py-3 font-semibold">Score</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/10">
                        {[
                          { label: "WORLD CLASS", range: "90+" },
                          { label: "ELITE", range: "75 – 89" },
                          { label: "ADVANCED", range: "60 – 74" },
                          { label: "INTERMEDIATE", range: "40 – 59" },
                          { label: "NOVICE", range: "0 – 39" },
                        ].map((row) => {
                          const active = tier === (row.label as Tier);
                          return (
                            <tr key={row.label} className={active ? "bg-[#DFFF00]/10" : ""}>
                              <td className="px-5 py-3 font-semibold text-white">{row.label}</td>
                              <td className="px-5 py-3 text-white/60">{row.range}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!showDetails && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-base text-white/70">
                Open details to view your archetype, chart, and share card.
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile quick dock */}
      {hasResults && !isWorking && (
        <div className="fixed bottom-3 left-3 right-3 z-50 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#020203]/85 px-3 py-2 backdrop-blur-xl">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-white">Hybrid {Math.round(hybridScore)}</div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest ${tierMeta[tier].pill}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {tier}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={downloadScorecard}
                className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold tracking-widest text-black"
              >
                CARD
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white"
              >
                DETAILS
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Small UI components ----------

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-white/60">{label}</div>
      <div className="text-white font-semibold">{value}</div>
    </div>
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
      <label className="mb-2 block text-sm font-medium text-white/70">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={24}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[#DFFF00]/50 focus:ring-2 focus:ring-[#DFFF00]/10"
      />
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[#DFFF00]/50 focus:ring-2 focus:ring-[#DFFF00]/10"
      />
      {hint ? <div className="mt-1 text-sm text-white/55">{hint}</div> : null}
    </div>
  );
}

function ArchetypeIcon({
  archetype: computedArchetype,
  className = "h-4 w-4",
}: {
  archetype: Archetype;
  className?: string;
}) {
  switch (computedArchetype) {
    case "STRENGTH BEAST":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.5 10v4M7 9v6M17 9v6M19.5 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "ENDURANCE MACHINE":
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
          <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7.5 7l-3 6h6l-3-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16.5 7l-3 6h6l-3-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
          <path d="M7 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
          <path d="M7 10v4M9 9v6M15 9v6M17 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "BASE BUILDER":
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}

function ArchetypeBadge({ archetype }: { archetype: Archetype }) {
  const meta: Record<Archetype, { label: string; ring: string; bg: string; icon: ReactNode }> = {
    "STRENGTH BEAST": {
      label: "Strength Beast",
      ring: "border-[#DFFF00]/25",
      bg: "bg-[#DFFF00]/10 text-[#DFFF00]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M4 12c2.5-3.5 5.5-5 8-5s5.5 1.5 8 5c-2.5 3.5-5.5 5-8 5s-5.5-1.5-8-5Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "ENDURANCE MACHINE": {
      label: "Endurance Machine",
      ring: "border-sky-400/20",
      bg: "bg-sky-400/10 text-sky-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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
        </svg>
      ),
    },
    "ENDURANCE-LEANING HYBRID": {
      label: "Endurance Leaning",
      ring: "border-sky-400/20",
      bg: "bg-sky-400/10 text-sky-200",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M7 14c2-6 4-9 5-9s3 3 5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 19h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "STRENGTH-LEANING HYBRID": {
      label: "Strength Leaning",
      ring: "border-[#DFFF00]/25",
      bg: "bg-[#DFFF00]/10 text-[#DFFF00]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M7 9h10M9 7v10M15 7v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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