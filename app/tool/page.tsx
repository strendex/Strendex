"use client";

// The Strendex calculator.
//
// ONE request per submission: POST /api/score validates, converts, scores,
// persists and returns the SAVED row. Everything shown as a result — score,
// indexes, percentiles, tier, archetype and placement — comes from that
// response. The browser converts nothing and scores nothing; the shared
// canonical module is used only to pre-check entries before spending a
// request, and to decompose the server's own strength index for the chart.
//
// Every calculation is submitted publicly (SUBMISSION_VISIBILITY) and the page
// says so next to the button — scoring IS entering the leaderboard. The full
// benchmark disclosure lives in the "?" popover beside the score.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import StrendexChart from "./StrendexChart";
import AthleteReviewCTA from "@/components/AthleteReviewCTA";
import { findBannedWord } from "@/lib/nameFilter";
import {
  STRENGTH_RATIO_THRESHOLDS,
  strengthScoreFromRatio,
  toCanonicalEnduranceSeconds,
  toKilograms,
} from "@/lib/scoring/core";
import type {
  Archetype,
  RunDistance,
  Tier,
  UnitSystem,
} from "@/lib/scoring/core";
import {
  ANONYMOUS_NAME,
  SUBMISSION_VISIBILITY,
  buildScoreRequestDraft,
  createSubmissionSession,
  submitScore,
  type ScoreResultView,
  type SubmissionError,
  type SubmissionOutcome,
} from "@/lib/tool/scoreSubmission";
import {
  leaderboardExclusion,
  leaderboardStanding,
  scoreExplanation,
} from "@/lib/tool/resultPresentation";
import { toPng } from "html-to-image";

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

/** A weight field the athlete has actually filled in. */
function enteredWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tierMeta: Record<Tier, { pill: string; glow: string }> = {
  "WORLD CLASS": {
    pill: "border-[#DFFF00]/25 bg-[#DFFF00]/10 text-[#DFFF00]",
    glow: "shadow-[0_0_50px_rgba(223,255,0,0.12)]",
  },
  ELITE: {
    pill: "border-white/15 bg-white/[0.04] text-white/80",
    glow: "",
  },
  ADVANCED: {
    pill: "border-white/15 bg-white/[0.04] text-white/80",
    glow: "",
  },
  INTERMEDIATE: {
    pill: "border-white/15 bg-white/[0.04] text-white/80",
    glow: "",
  },
  NOVICE: {
    pill: "border-white/10 bg-white/[0.03] text-zinc-300",
    glow: "",
  },
};

const NEUTRAL_TIER = {
  pill: "border-white/10 bg-white/[0.03] text-white/50",
  glow: "",
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
  const [showHQTooltip, setShowHQTooltip] = useState(false);

  // saving / scan moment
  const [isWorking, setIsWorking] = useState(false);
  const [scanStage, setScanStage] = useState<"CALIBRATING" | "SCORING" | "COMPILING">(
    "CALIBRATING",
  );
  const [statusText, setStatusText] = useState<string>("");

  // The saved result, exactly as the server returned it. Never assembled here.
  const [result, setResult] = useState<ScoreResultView | null>(null);
  const [submitError, setSubmitError] = useState<SubmissionError | null>(null);

  // One in-flight guard and one idempotency key per logical submission.
  const sessionRef = useRef(createSubmissionSession());

  /**
   * Bumped by every edit and every reset. A request that finishes after the
   * generation moved on describes inputs that are no longer on screen, so its
   * result must not be rendered against them.
   */
  const editGenerationRef = useRef(0);

  const [siteLabel, setSiteLabel] = useState<string>("strendex");
  const [arIntent, setArIntent] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);

  // The "?" popover must close on a tap anywhere else — on a phone there is no
  // mouseleave to do it — and on Escape, returning focus to the button so a
  // keyboard user is never stranded. Listening only while open costs nothing
  // the rest of the time.
  useEffect(() => {
    if (!showHQTooltip) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!tooltipRef.current?.contains(event.target as Node)) {
        setShowHQTooltip(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowHQTooltip(false);
      helpButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showHQTooltip]);

  // parsed inputs, in the athlete's OWN unit system
  const wInput = enteredWeight(weight);
  const bInput = enteredWeight(bench);
  const sInput = enteredWeight(squat);
  const dInput = enteredWeight(deadlift);
  const runSeconds = parseTimeToSeconds(runTimeText);

  const unitLabel = unitSystem.toUpperCase();
  const displayTotalLift = (bInput ?? 0) + (sInput ?? 0) + (dInput ?? 0);
  const strengthRatio = wInput ? displayTotalLift / wInput : 0;

  const hasResult = result !== null;
  const tierStyle = result ? tierMeta[result.tier] : NEUTRAL_TIER;
  const archetypeInfo = result ? ARCHETYPE_COPY[result.archetype] : null;
  const standing = result ? leaderboardStanding(result) : null;
  const exclusion = result ? leaderboardExclusion(result) : null;
  const explanation = result ? scoreExplanation(result) : null;

  /**
   * Per-lift breakdown of the SERVER's strength index, using the same canonical
   * curve the server averages. The endurance axis is the server's own index —
   * nothing on this chart is a second opinion about the score.
   */
  const chartData = useMemo(() => {
    if (!result) return [];

    const bodyweightKg = wInput ? toKilograms(wInput, unitSystem) : 0;
    if (bodyweightKg <= 0) return [];

    const axis = (
      entered: number | null,
      thresholds: { mid: number; strong: number; elite: number },
    ) => {
      if (!entered) return 0;
      const ratio = toKilograms(entered, unitSystem) / bodyweightKg;
      return Number(
        strengthScoreFromRatio(
          ratio,
          thresholds.mid,
          thresholds.strong,
          thresholds.elite,
        ).toFixed(1),
      );
    };

    return [
      { subject: "Bench", value: axis(bInput, STRENGTH_RATIO_THRESHOLDS.bench) },
      { subject: "Squat", value: axis(sInput, STRENGTH_RATIO_THRESHOLDS.squat) },
      {
        subject: "Deadlift",
        value: axis(dInput, STRENGTH_RATIO_THRESHOLDS.deadlift),
      },
      { subject: "Endurance", value: result.enduranceIndex },
    ];
  }, [result, wInput, bInput, sInput, dInput, unitSystem]);

  /** Canonical inputs for the Athlete Review snapshot. Inputs, not results. */
  const reviewInputs = useMemo(() => {
    if (!wInput) return null;
    return {
      bodyweightKg: toKilograms(wInput, unitSystem),
      benchKg: bInput ? toKilograms(bInput, unitSystem) : null,
      squatKg: sInput ? toKilograms(sInput, unitSystem) : null,
      deadliftKg: dInput ? toKilograms(dInput, unitSystem) : null,
      enduranceSeconds:
        runSeconds && runSeconds > 0
          ? toCanonicalEnduranceSeconds(runSeconds, runDistance)
          : null,
      runDistance: runSeconds ? runDistance : null,
      runTimeText: runSeconds ? runTimeText : null,
      unitSystem,
    };
  }, [wInput, bInput, sInput, dInput, runSeconds, runDistance, runTimeText, unitSystem]);

  const nameError = findBannedWord(displayName)
    ? "Please choose a different display name."
    : null;

  const canContinueStep1 = wInput !== null && !nameError;
  const canContinueStep2 =
    wInput !== null && bInput !== null && sInput !== null && dInput !== null;
  const canContinueStep3 = canContinueStep2 && runSeconds !== null;
  const canSubmit = canContinueStep3 && !nameError && !isWorking;

  /**
   * Any edit invalidates the result on screen: it belongs to the numbers that
   * produced it, not the ones now in the boxes. The entries themselves are
   * never touched here, and neither is anything else the athlete typed.
   */
  function noteEdit() {
    editGenerationRef.current += 1;
    if (result) setResult(null);
    if (submitError) setSubmitError(null);
    if (statusText) setStatusText("");
  }

  function cleanedName() {
    const clean = displayName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 ._-]/g, "");
    return clean.length >= 2 ? clean : ANONYMOUS_NAME;
  }

  async function generateProfile() {
    // Belt and braces against a double tap: the disabled button, the isWorking
    // flag, and the session's own in-flight guard.
    if (isWorking || sessionRef.current.inFlight) return;

    const built = buildScoreRequestDraft({
      displayName: cleanedName(),
      unitSystem,
      bodyweight: weight,
      bench,
      squat,
      deadlift,
      runDistance,
      runSeconds,
      // Always public — the line beside the button says so before the tap.
      visibility: SUBMISSION_VISIBILITY,
    });

    if (!built.ok) {
      setSubmitError(built.error);
      setStatusText("");
      return;
    }

    // What the athlete had entered when they asked for this score.
    const generation = editGenerationRef.current;

    setIsWorking(true);
    setSubmitError(null);
    setStatusText("Scoring…");
    setScanStage("CALIBRATING");

    document
      .getElementById("results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    let outcome: SubmissionOutcome;
    try {
      // The request starts immediately; the reveal animation runs alongside it.
      const pending = submitScore(sessionRef.current, built.draft);

      const reveal = (async () => {
        await wait(250);
        setScanStage("SCORING");
        await wait(350);
        setScanStage("COMPILING");
        await wait(250);
      })();

      [outcome] = await Promise.all([pending, reveal]);
    } finally {
      // Whatever happens, the button comes back. Leaving this to the happy
      // path would strand the calculator on "Calculating…" forever.
      setIsWorking(false);
    }

    // The inputs moved on while this was scoring. The result is saved, but it
    // describes the previous entries, so it is not shown against these ones.
    if (editGenerationRef.current !== generation) {
      setStatusText(
        "Your entries changed while that was scoring — tap again for an updated result.",
      );
      return;
    }

    if (outcome.status === "busy") {
      setStatusText("");
      return;
    }

    if (outcome.status === "error") {
      // Everything entered stays exactly where it is, and so does the key, so
      // tapping again retries this submission instead of creating a second one.
      setSubmitError(outcome.error);
      setStatusText("");
      return;
    }

    setResult(outcome.result);
    setSubmitError(null);
    setStatusText(
      outcome.replayed
        ? "Already saved — showing your saved result."
        : "Result saved.",
    );

    setShowDetails(false);
    setTimeout(() => {
      if (window.innerWidth >= 1024) {
        setShowDetails(true);
      } else {
        document
          .getElementById("details-toggle-btn")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 800);

    setTimeout(() => setStatusText(""), 2400);
  }

  function resetAll() {
    // Counts as an edit: a request still in flight must not land on the
    // cleared form when it returns.
    editGenerationRef.current += 1;
    setWeight("");
    setBench("");
    setSquat("");
    setDeadlift("");
    setRunTimeDigits("");
    setResult(null);
    setSubmitError(null);
    setShowDetails(false);
    setStatusText("");
    // A cleared form is a new logical submission, not a retry of the old one.
    sessionRef.current.idempotency = null;
    setStep(1);
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

  // Load share params + the remembered name, once, on mount. These live in the
  // browser only — `window` and `localStorage` do not exist while this renders
  // on the server, so seeding them during render would hydrate to different
  // markup. That is why this effect sets state rather than deriving it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSiteLabel(window.location.host);

    if (params.get("intent") === "athlete-review") setArIntent(true);

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

    // Shared links carry inputs, never a result: land on the review step with
    // the numbers filled in and nothing scored.
    if (hasSharedStats) setStep(4);
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
      title: "You're ready",
      sub: "Check your numbers, then get your result.",
    },
  };

  return (
    <section className="mx-auto max-w-7xl">
      {/* Top header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-white/50">Hybrid Athlete Benchmark</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Find out where you <span className="text-[#DFFF00]">actually rank.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/70">
  Enter your lifts and run time to see where you rank.
</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
  <Progress step={step} />
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
              <div className="grid w-[120px] shrink-0 grid-cols-2 overflow-hidden rounded-full border border-white/10 bg-black/30 sm:w-[128px]">
  <button
    type="button"
    onClick={() => {
      setUnitSystem("lb");
      noteEdit();
    }}
    className={`min-w-0 px-0 py-2 text-center text-sm font-semibold transition ${
      unitSystem === "lb" ? "bg-white text-black" : "text-white/70 hover:bg-white/[0.06]"
    }`}
  >
    LB
  </button>
  <button
    type="button"
    onClick={() => {
      setUnitSystem("kg");
      noteEdit();
    }}
    className={`min-w-0 px-0 py-2 text-center text-sm font-semibold transition ${
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
                      noteEdit();
                    }}
                    error={nameError}
                  />

                  <Field
                    label={`Bodyweight (${unitLabel})`}
                    placeholder="e.g., 195"
                    value={weight}
                    onChange={(value) => {
                      setWeight(value);
                      noteEdit();
                    }}
                    hint="Used to calculate your relative strength."
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
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  <Field
                    label={`Bench (${unitLabel})`}
                    placeholder="e.g., 275"
                    value={bench}
                    onChange={(value) => {
                      setBench(value);
                      noteEdit();
                    }}
                  />
                  <Field
                    label={`Squat (${unitLabel})`}
                    placeholder="e.g., 365"
                    value={squat}
                    onChange={(value) => {
                      setSquat(value);
                      noteEdit();
                    }}
                  />
                  <Field
                    label={`Deadlift (${unitLabel})`}
                    placeholder="e.g., 425"
                    value={deadlift}
                    onChange={(value) => {
                      setDeadlift(value);
                      noteEdit();
                    }}
                  />

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between text-sm">
  <span className="text-white/70">Total lift</span>
  <span className="text-white font-semibold">
  {displayTotalLift > 0 ? `${Math.round(displayTotalLift)} ${unitLabel}` : "—"}
</span>
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
  All three lifts are needed — a ranked score compares complete profiles only.
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
                        onChange={(e) => {
                          setRunDistance(e.target.value as RunDistance);
                          noteEdit();
                        }}
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
                          noteEdit();
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
                            noteEdit();
                            if (allSelected) return setRunTimeDigits("");
                            return setRunTimeDigits((prev) => prev.slice(0, -1));
                          }
                          if (key === "Delete") {
                            e.preventDefault();
                            noteEdit();
                            return setRunTimeDigits("");
                          }
                          if (/^\d$/.test(key)) {
                            e.preventDefault();
                            noteEdit();
                            return setRunTimeDigits((prev) => (prev + key).slice(0, 6));
                          }
                          e.preventDefault();
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData("text") || "";
                          const digits = pasted.replace(/\D/g, "").slice(0, 6);
                          setRunTimeDigits(digits);
                          noteEdit();
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
  A run time is required — the score is half strength, half endurance.
</div>
                </>
              )}

              {/* STEP 4 — final CTA */}
              {step === 4 && (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-medium text-white/60">Review</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-base">
                      <Row label="Name" value={displayName.trim() ? displayName.trim() : ANONYMOUS_NAME} />
                      <Row label="Bodyweight" value={wInput ? `${Math.round(wInput)} ${unitLabel}` : "—"} />
<Row label="Strength" value={displayTotalLift > 0 ? `${Math.round(displayTotalLift)} ${unitLabel} total` : "—"} />
                      <Row
                        label="Endurance"
                        value={runTimeText.trim() ? `${runDistance.toUpperCase()} • ${runTimeText.trim()}` : "—"}
                      />
                    </div>
                  </div>

                  <button
                    onClick={generateProfile}
                    disabled={!canSubmit}
                    className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {isWorking ? "Calculating…" : "Get my score →"}
                  </button>

                  <div className="text-center text-xs leading-relaxed text-white/45">
                    Calculating adds your result and display name to the public
                    leaderboard.
                  </div>

                  {submitError ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-white/20 bg-white/[0.04] p-4"
                    >
                      <div className="text-sm font-semibold text-white">
                        Couldn’t score that yet
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-white/70">
                        {submitError.message}
                      </div>
                      <div className="mt-2 text-xs text-white/45">
                        {submitError.field
                          ? "Your entries are exactly as you left them. Adjust that value, then try again."
                          : submitError.canRetry
                            ? "Your entries are exactly as you left them — tap again to retry."
                            : "Your entries are exactly as you left them."}
                      </div>
                    </div>
                  ) : statusText ? (
                    <div className="text-center text-xs text-white/60">{statusText}</div>
                  ) : null}

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
                      onClick={resetAll}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT — Results / Reveal */}
        <div className="lg:col-span-7">
          <div id="results" />
          <div className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${tierStyle.glow}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <div className="text-sm font-medium text-white/60">
  {isWorking ? "Computing" : hasResult ? "Your result" : "Your score will appear here"}
</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Hybrid Score <span className="text-white/60">(0–100)</span>
                </h2>
                <p className="mt-2 text-base text-white/70">
  {hasResult
    ? "Here’s where you stand."
    : "Fill in your stats on the left to see where you rank."}
</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                <span className={`h-1.5 w-1.5 rounded-full ${isWorking ? "bg-[#DFFF00] animate-pulse" : "bg-white/30"}`} />
                {isWorking ? scanStage : "READY"}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              {/* The popover is anchored to this row, not to the 24px button, so
                  it spans the card and can never run off a narrow screen. */}
              <div ref={tooltipRef} className="relative">
              <div className="flex items-end justify-between gap-3">
              <div>
  <div className="text-sm text-white/55">Hybrid Score</div>

  <div className="mt-1 flex items-start gap-2">
    <div className="text-6xl font-semibold tracking-tight text-[#DFFF00]">
      {result ? Math.round(result.hybridScore) : "—"}
    </div>

    {result && explanation && (
  <div
    className="ml-2 -mt-1"
    onMouseEnter={() => setShowHQTooltip(true)}
    onMouseLeave={() => setShowHQTooltip(false)}
  >
    {/* The ring stays 24px so it reads as a quiet hint; the ::after box
        widens the touch target to ~44px without changing how it looks. */}
    <button
      ref={helpButtonRef}
      type="button"
      onClick={() => setShowHQTooltip((prev) => !prev)}
      className="relative flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[12px] font-medium leading-none text-white/55 transition after:absolute after:-inset-2.5 after:content-[''] hover:border-white/35 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="How your score works"
      aria-expanded={showHQTooltip}
      aria-controls="hybrid-score-help"
    >
      ?
    </button>
  </div>
)}
  </div>
</div>

                <div className="text-right">
                <div className="text-sm text-white/55">Tier</div>
                  <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-widest ${tierStyle.pill}`}>
                    {result && <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />}
                    {result ? result.tier : "—"}
                  </div>
                </div>
              </div>

              {showHQTooltip && explanation && (
                <div
                  id="hybrid-score-help"
                  role="note"
                  className="absolute left-0 right-0 top-full z-30 mt-2 sm:max-w-md"
                >
                  <div className="space-y-2 rounded-xl border border-white/10 bg-[#0E1014] p-3.5 text-xs font-medium leading-relaxed text-white/75 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                    {explanation.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
              </div>

              {/* Strength / endurance against the comparison group. "Ahead of
                  X%" is the PERCENTILE — the index is named separately on the
                  line below so the two can never be read as the same number.
                  Stacked rows, not side-by-side cards: at 320px a two-column
                  split leaves ~68px per cell, which "Ahead of 100.0%" cannot
                  fit without wrapping mid-number. */}
<div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
  {[
    {
      label: "Strength",
      percentile: result?.strengthPercentile ?? null,
      index: result?.strengthIndex ?? null,
    },
    {
      label: "Endurance",
      percentile: result?.endurancePercentile ?? null,
      index: result?.enduranceIndex ?? null,
    },
  ].map((row) => (
    <div
      key={row.label}
      className="px-3.5 py-3 sm:flex sm:items-baseline sm:justify-between sm:gap-3"
    >
      <div className="text-[11px] uppercase tracking-widest text-white/40">
        {row.label}
      </div>
      <div className="mt-1 sm:mt-0 sm:text-right">
        <div className="text-base font-semibold text-white">
          {row.percentile === null
            ? "—"
            : `Ahead of ${row.percentile.toFixed(1)}%`}
        </div>
        <div className="text-[11px] text-white/45">
          {row.percentile === null || row.index === null
            ? "of athletes in the current comparison group"
            : `of athletes · index ${row.index.toFixed(1)}`}
        </div>
      </div>
    </div>
  ))}
</div>

              {/* Athlete type */}
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:mt-3">
                <div className="text-[11px] uppercase tracking-widest text-white/40">Athlete type</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {result ? result.archetype : "—"}
                </div>
                {archetypeInfo && (
                  <div className="mt-0.5 text-xs text-white/50">{archetypeInfo.tagline}</div>
                )}
              </div>

              {/* Placement — the saved row's, or one plain line on why not yet. */}
              {result && (
                <div className="mt-3 text-sm text-white/70">
                  {standing
                    ? `#${standing.rank} of ${standing.total} on the leaderboard — ahead of ${standing.beatPercent.toFixed(1)}% of listed athletes.`
                    : exclusion}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
    id="details-toggle-btn"
    onClick={() => setShowDetails((v) => !v)}
    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
  >
    {showDetails ? "Hide details" : "See full breakdown →"}
  </button>

  <Link
    href="/rankings"
    className="w-full rounded-2xl bg-[#DFFF00] px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
  >
    View Rankings
  </Link>
</div>

            {result && !isWorking && reviewInputs && (
              <AthleteReviewCTA
                hybridScore={Math.round(result.hybridScore)}
                strengthPercentile={result.strengthPercentile}
                endurancePercentile={result.endurancePercentile}
                strengthIndex={result.strengthIndex}
                enduranceIndex={result.enduranceIndex}
                tier={result.tier}
                archetype={result.archetype}
                rank={standing?.rank ?? null}
                totalAthletes={standing?.total ?? null}
                betterThanPercent={standing?.beatPercent ?? null}
                inputs={reviewInputs}
                emphasized={arIntent}
              />
            )}

            {/* Details */}
            {showDetails && (
              <div className="mt-6 space-y-6">
                {result && archetypeInfo && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Archetype</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ArchetypeBadge archetype={result.archetype} />
                      <span className="text-sm text-white/70">{archetypeInfo.tagline}</span>
                    </div>

                    <div className="mt-3 text-sm text-white/60 leading-relaxed">{archetypeInfo.description}</div>
                    <div className="mt-3 text-sm">
                      <span className="font-semibold text-white">Focus:</span>{" "}
                      <span className="text-white/60">{archetypeInfo.focus}</span>
                    </div>
                  </div>
                )}

                {result && chartData.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Performance signature</div>
                    <div className="mt-1 text-xs text-white/45">
                      How your bench, squat, deadlift and run stack up.
                    </div>
                    <div className="mt-4 grid place-items-center rounded-2xl border border-white/10 bg-[#020203] p-4">
                      <StrendexChart data={chartData} />
                    </div>
                  </div>
                )}

                {/* Share Card */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                    <div className="mt-1 text-lg font-semibold text-white">Your Athlete Card</div>
                    <div className="mt-1 text-sm text-white/60">Download your card and post it. Challenge someone to beat your score.</div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={downloadScorecard}
                        className="rounded-2xl bg-[#DFFF00] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#c9e600]"
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


                  <div style={{ display: "flex", justifyContent: "center", width: "100%", marginTop: "16px" }}>
                  <div
ref={cardRef}
className="relative overflow-hidden"
style={{
width: "min(360px, 100%)",
aspectRatio: "9/16",
borderRadius: "28px",
background: "linear-gradient(160deg, #0D0F14 0%, #07070A 45%, #050507 100%)",
border: "1px solid rgba(255,255,255,0.1)",
flexShrink: 0,
  }}
>
  {/* Background effects */}
  <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
    <div style={{
      position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
      width: "300px", height: "220px", borderRadius: "50%",
      background: "radial-gradient(circle at center, rgba(223,255,0,0.16), transparent 65%)",
      filter: "blur(50px)",
    }} />
    <div style={{
      position: "absolute", inset: 0, opacity: 0.06,
      backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
      backgroundSize: "28px 28px",
      maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 65%)",
    }} />
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(85% 55% at 50% 0%, transparent 0%, rgba(7,7,10,0.5) 55%, rgba(7,7,10,0.97) 100%)",
    }} />
  </div>

  <div style={{ position: "relative", zIndex: 10, padding: "6% 7%", height: "100%", display: "flex", flexDirection: "column" }}>

    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
      <div style={{ fontSize: "clamp(9px, 3vw, 13px)", fontWeight: 800, letterSpacing: "0.3em", color: "rgba(255,255,255,0.92)", textTransform: "uppercase" }}>
          STRENDEX
</div>
<div style={{ fontSize: "clamp(7px, 2vw, 9px)", letterSpacing: "0.2em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginTop: "4px" }}>
          Hybrid Athlete Card
</div>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] ${tierStyle.pill}`}
        style={{ backdropFilter: "blur(8px)" }}>
        <span className="h-2 w-2 rounded-full bg-[#DFFF00]" />
        {result ? result.tier : "—"}
      </span>
    </div>

    {/* Divider accent */}
    <div style={{ marginTop: "20px", height: "0.5px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />

    {/* Athlete name */}
    <div style={{ marginTop: "16px" }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: "6px" }}>
        Athlete
      </div>
      <div style={{ fontSize: "clamp(18px, 6vw, 26px)", fontWeight: 700, color: "white", letterSpacing: "-0.03em", lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {displayName.trim() ? displayName.trim() : ANONYMOUS_NAME}
      </div>
      <div style={{ fontSize: "clamp(8px, 2.5vw, 11px)", color: "rgba(255,255,255,0.38)", marginTop: "5px", letterSpacing: "0.06em" }}>
        {result ? result.archetype : "—"}
      </div>
    </div>

    {/* Score — hero */}
    <div style={{
      marginTop: "20px", flex: 1,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      borderRadius: "20px",
      border: "0.5px solid rgba(223,255,0,0.12)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
      position: "relative", overflow: "hidden",
      padding: "20px 0",
    }}>
      <div style={{
        position: "absolute", bottom: "-40px", left: "50%", transform: "translateX(-50%)",
        width: "200px", height: "200px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(223,255,0,0.1), transparent 68%)",
        filter: "blur(20px)", pointerEvents: "none",
      }} />
      <div style={{ fontSize: "10px", letterSpacing: "0.3em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
        Hybrid Score
      </div>
      <div style={{
fontSize: "clamp(72px, 22vw, 100px)", fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.05em",
color: "#DFFF00", marginTop: "10px",
WebkitTextFillColor: "#DFFF00",
textShadow: "0 0 60px rgba(223,255,0,0.22)",
      }}>
        {result ? Math.round(result.hybridScore) : "—"}
      </div>
      <div style={{ fontSize: "10px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginTop: "10px" }}>
        out of 100
      </div>
      {standing !== null && (
        <div style={{
          marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "7px",
          borderRadius: "999px", border: "0.5px solid rgba(223,255,0,0.2)",
          background: "rgba(223,255,0,0.08)", padding: "11px 20px",
          fontSize: "clamp(9px, 2.5vw, 12px)", fontWeight: 700, color: "rgba(240,255,170,0.95)", letterSpacing: "0.02em", lineHeight: 1,
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#DFFF00", boxShadow: "0 0 10px rgba(223,255,0,0.6)" }} />
          Better than {standing.beatPercent.toFixed(1)}% of listed athletes
        </div>
      )}
    </div>

    {/* Stats row */}
    <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
      {[
        { k: "BW", v: wInput ? `${Math.round(wInput)} ${unitLabel}` : "—" },
        { k: "Total", v: displayTotalLift > 0 ? `${Math.round(displayTotalLift)} ${unitLabel}` : "—" },
        { k: runDistance.toUpperCase(), v: runTimeText || "—" },
      ].map((x) => (
        <div key={x.k} style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          borderRadius: "12px", border: "0.5px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)", padding: "11px 8px",
        }}>
          <div style={{ fontSize: "clamp(7px, 2vw, 9px)", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {x.k}
          </div>
          <div style={{ fontSize: "clamp(9px, 2.5vw, 12px)", fontWeight: 600, color: "rgba(255,255,255,0.78)", marginTop: "5px", lineHeight: 1, whiteSpace: "nowrap" }}>
            {x.v}
          </div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div style={{ marginTop: "16px", height: "0.5px", background: "linear-gradient(to right, transparent, rgba(223,255,0,0.2), transparent)" }} />
    <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ fontSize: "clamp(7px, 2vw, 9px)", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>
{siteLabel}
</div>
<div style={{ fontSize: "clamp(7px, 2vw, 9px)", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>
        {standing !== null ? `#${standing.rank} / ${standing.total}` : "CAN YOU BEAT THIS?"}
      </div>
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
                      <div className="mt-1 text-base font-semibold text-white">Where do you land?</div>
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
                          const active = result?.tier === (row.label as Tier);
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
              Open details to see your full breakdown, archetype, and shareable athlete card.
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile quick dock */}
      {result && !isWorking && (
        <div className="fixed bottom-3 left-3 right-3 z-50 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#020203]/85 px-3 py-2 backdrop-blur-xl">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-xs font-semibold text-white">Hybrid {Math.round(result.hybridScore)}</div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest ${tierStyle.pill}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#DFFF00]" />
                  {result.tier}
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

function Progress({ step }: { step: Step }) {
  return (
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
}

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
  error,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
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
        className={`w-full rounded-2xl border bg-black/30 px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none transition focus:ring-2 ${
          error
            ? "border-white/40 focus:border-white/60 focus:ring-white/10"
            : "border-white/10 focus:border-[#DFFF00]/50 focus:ring-[#DFFF00]/10"
        }`}
      />
      {error ? <div className="mt-1 text-sm text-white/70">{error}</div> : null}
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
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
    "BALANCED HYBRID": {
      label: "Balanced Hybrid",
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 7h12M7.5 17h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    "POWER HYBRID": {
      label: "Power Hybrid",
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path d="M12 2 5 9l7 13 7-13-7-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
    "ENDURANCE-LEANING HYBRID": {
      label: "Endurance Leaning",
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
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
