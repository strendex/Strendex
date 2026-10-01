"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import StrendexChart from "./StrendexChart";
import AthleteReviewCTA from "@/components/AthleteReviewCTA";
import { createResultViewTracker, scoreBand } from "@/lib/athleteReview/analytics";
import { EASE, usePrefersReducedMotion } from "@/components/home/motion";
import { findBannedWord } from "@/lib/nameFilter";
import { ARCHETYPE_COPY } from "@/lib/archetypeCopy";
import { toPng } from "html-to-image";
import {
  STRENGTH_RATIO_THRESHOLDS,
  kilogramsToPounds,
  poundsToKilograms,
  strengthScoreFromRatio,
  toCanonicalEnduranceSeconds,
  type Archetype,
  type RunDistance,
  type Tier,
  type UnitSystem,
} from "@/lib/scoring/core";
import {
  ANONYMOUS_NAME,
  submissionVisibility,
  buildScoreRequestDraft,
  createSubmissionSession,
  parseRunTime,
  runTimeRangeText,
  submissionSignature,
  submitScore,
  type ScoreFormValues,
  type ScoreRequestDraft,
  type ScoreResultView,
  type SubmissionError,
} from "@/lib/tool/scoreSubmission";
import {
  placementLine,
  savedStatusText,
  scoreExplanation,
} from "@/lib/tool/resultPresentation";

// Tier, Archetype, RunDistance and UnitSystem are imported from the canonical
// domain rather than redeclared here: the calculator must not be able to drift
// from the values the server will actually return.

// ---------- Helpers ----------

/**
 * Seconds back to mm:ss / h:mm:ss. Used to render the run time of a SAVED
 * result from the validated `run_seconds` that was actually scored, rather than
 * from the live text field — so the time shown on a result always belongs to it.
 */
function formatSecondsToTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

function formatDigitsToTime(digitsRaw: string): string {
  const digits = digitsRaw.replace(/\D/g, "").slice(0, 6);
  if (!digits) return "";

  if (digits.length <= 2) {
    const min = Number(digits);
    if (!Number.isFinite(min)) return "";
    return `${min}:00`;
  }

  // Digits are laid out as typed, never clamped: "2275" stays 22:75 so
  // parseRunTime can reject it, rather than silently becoming 22:59.
  if (digits.length <= 4) {
    return `${Number(digits.slice(0, -2))}:${digits.slice(-2)}`;
  }

  return `${Number(digits.slice(0, -4))}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
}

// Distance metres, the Riegel conversion, the pound/kilogram factor, getTier and
// getArchetype all used to be reimplemented here. They are gone: the server
// derives the score, tier, archetype and both percentiles, and the calculator
// renders what came back. `kgToLb` / `lbToKg` now delegate to the canonical
// conversion so there is exactly one copy of the factor in the codebase — they
// are used only to normalise the athlete's typed numbers for local display and
// for the balance chart, never to produce a score.

function lbToKg(lb: number): number {
  return poundsToKilograms(lb);
}
function kgToLb(kg: number): number {
  return kilogramsToPounds(kg);
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

// ---------- Flow and presentation constants ----------

type Step = 1 | 2 | 3 | 4;

/**
 * Which step owns each input. A validation or server error that names a field
 * is shown beside that field, on its step, instead of as a line at the bottom
 * of the form. Errors naming nothing here stay under the submit button.
 */
const FIELD_STEP: Record<string, Step> = {
  display_name: 1,
  bodyweight: 1,
  bench: 2,
  squat: 2,
  deadlift: 2,
  run_distance: 3,
  run_seconds: 3,
};

const fieldId = (field: string) => `field-${field}`;

const DISTANCE_LABEL: Record<RunDistance, string> = {
  "3mi": "3 miles",
  "5k": "5K",
  "10k": "10K",
  half: "Half marathon",
  marathon: "Marathon",
};

const STEP_COPY: Record<Step, { title: string; sub: string }> = {
  1: { title: "Your basics", sub: "Start with your bodyweight." },
  2: { title: "Your lifts", sub: "Your best recent bench, squat and deadlift." },
  3: { title: "Your run", sub: "Pick the distance you ran and enter your time." },
  4: { title: "Review", sub: "Check your numbers, then get your score." },
};

// Rankings are temporarily hidden while the athlete dataset grows, so the
// calculator withholds every rankings surface: the placement line, the share
// card rank, the "Leaderboard placement" preview item and the links to
// /rankings. Presentation only — the server still returns placement, the
// Athlete Review snapshot still receives it, and /rankings itself still works.
// /rankings and calculator placement share one rule (lib/leaderboard.ts:
// approved, public, active dataset AND current score version, competition
// ranks), verified against each other on staging — see
// docs/group-3-leaderboard-moderation.md. When shown, the UI shows only what
// the server returned: a rank and total when there is one, otherwise the
// reason there is none (placementLine). Set to true when rankings open.
const LEADERBOARD_PLACEMENT_AVAILABLE = false as const;

/** What the empty result panel promises — descriptions, never values. */
const RESULT_PREVIEW: Array<{ term: string; detail: string; placement?: true }> = [
  {
    term: "Hybrid Score (0–100)",
    detail: "The average of your strength and endurance percentiles.",
  },
  {
    term: "Strength and endurance percentiles",
    detail:
      "Where each side sits within the Strendex reference dataset. The 70th percentile means you're above roughly 70% of it.",
  },
  {
    term: "Tier and athlete type",
    detail:
      "Where your score sits, and how your two sides compare. A high score can still lean heavily to one side.",
  },
  {
    term: "Leaderboard placement",
    detail: "Only if you choose to publish. It's separate from your percentiles.",
    placement: true,
  },
];

// Controls. Lime marks the one primary action in view; everything else is
// neutral. Focus is a visible white ring on every control.
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014]";
const PRESS =
  "transition-[filter,background-color,border-color,opacity,transform,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100";
const BTN_PRIMARY = `inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 ${PRESS} ${FOCUS_RING}`;
const BTN_SECONDARY = `inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 ${PRESS} ${FOCUS_RING}`;
const INPUT =
  "w-full rounded-2xl border bg-black/30 px-4 py-3.5 text-[16px] text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow] duration-150 focus:ring-2";
const INPUT_OK = "border-white/10 focus:border-white/40 focus:ring-white/10";
const INPUT_ERROR = "border-white/60 focus:border-white/80 focus:ring-white/15";

/** Step changes: short, and the outgoing step leaves before the next arrives. */
const STEP_ENTER = { duration: 0.24, ease: EASE };
const STEP_EXIT = { duration: 0.12, ease: EASE };

/**
 * Scroll `el` to just below the sticky header, but only when it is not already
 * comfortably in view — so nothing moves when it doesn't need to.
 */
function bringIntoView(el: HTMLElement, reducedMotion: boolean) {
  const rect = el.getBoundingClientRect();
  const headerBottom =
    document.querySelector("body > div header")?.getBoundingClientRect().bottom ?? 0;
  if (rect.top >= headerBottom + 8 && rect.bottom <= window.innerHeight - 8) return;
  el.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
}

async function downloadCard(node: HTMLElement) {
  try {
    const dataUrl = await toPng(node, {
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

// ---------- Page ----------

export default function ToolPage() {
  const reducedMotion = usePrefersReducedMotion();

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
  // Opt-in publication (Group 4). Unticked = private. Applies to the NEXT
  // submission only: it never changes or removes a result already saved.
  const [publishToLeaderboard, setPublishToLeaderboard] = useState<boolean>(false);
  const runTimeText = formatDigitsToTime(runTimeDigits);

  // UX flow
  const [step, setStep] = useState<Step>(1);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [showExplainer, setShowExplainer] = useState<boolean>(false);

  // True only while POST /api/score is genuinely in flight. There is no staged
  // "calibrating" theatre and no artificial delay: the spinner is the request.
  const [isWorking, setIsWorking] = useState(false);
  // The line under the submit button: an error that names no single field, or
  // the short confirmation after a save.
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  // An error about one input, shown beside that input on its own step.
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  /**
   * THE saved submission: the result exactly as POST /api/score returned it,
   * together with the validated inputs that produced it.
   *
   * These two travel as ONE piece of state and are only ever written together,
   * which is the whole point. Previously the result came from the server while
   * the chart, the Athlete Review handoff and the share card all read the LIVE
   * form — so editing a field after scoring silently paired a saved score with
   * inputs it was never computed from. Anything describing a result now reads
   * `saved.inputs`; only the form itself reads the form.
   *
   * `inputs` is the ScoreRequestDraft captured BEFORE the request was sent, so a
   * response can never pick up an edit made while it was in flight.
   */
  type SavedSubmission = {
    result: ScoreResultView;
    inputs: ScoreRequestDraft;
    signature: string;
  };
  const [saved, setSaved] = useState<SavedSubmission | null>(null);
  const result = saved?.result ?? null;
  // A result exists only once the server has returned one. A shared link that
  // pre-fills the form is NOT a result.
  const hasResults = saved !== null;

  // Top of the Athlete Review funnel: once per saved result, never per render.
  const [trackResultViewed] = useState(createResultViewTracker);
  useEffect(() => {
    if (!result) return;
    trackResultViewed(result.resultId, {
      score_band: scoreBand(result.hybridScore),
      archetype: result.archetype,
    });
  }, [result, trackResultViewed]);

  // One submission session for the life of the page: it owns the idempotency
  // key and the in-flight guard, so a retry reuses the key and a double tap
  // cannot produce two rows. A ref, not state, because changing it must not
  // re-render and it must never be reset by one.
  const sessionRef = useRef(createSubmissionSession());

  const [siteLabel, setSiteLabel] = useState<string>("strendex");
  const [arIntent, setArIntent] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Focus and scroll requests. Each is set by an explicit action (a step
  // button, an error, a finished request) and applied once the element it
  // targets exists — never on an ordinary edit.
  const stepRegionRef = useRef<HTMLDivElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const revealResultPending = useRef(false);
  const cardDownloadPending = useRef(false);
  const detailsScrollPending = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const displayWeight = unitSystem === "kg" ? wInput : wLb;
  const displayBench = unitSystem === "kg" ? bInput : bLb;
  const displaySquat = unitSystem === "kg" ? sInput : sLb;
  const displayDeadlift = unitSystem === "kg" ? dInput : dLb;
  const displayTotalLift = displayBench + displaySquat + displayDeadlift;
  const unitLabel = unitSystem.toUpperCase();

  const parsedRunTime = parseRunTime(runTimeText);
  const runSeconds = parsedRunTime.ok ? parsedRunTime.seconds : 0;
  // Shown under the time field only once something is typed.
  const runTimeProblem =
    runTimeText && !parsedRunTime.ok ? parsedRunTime.error.message : null;

  const totalLift = bLb + sLb + dLb;

  // Display only: the raw total-to-bodyweight ratio shown in the input summary.
  // Not a score input — the server derives its own from the values it validated.
  const strengthRatio = wLb > 0 ? totalLift / wLb : 0;

  /**
   * Everything a SAVED result is described with, derived from the inputs that
   * were actually scored — never from the live form.
   *
   * Weights in the draft are in the athlete's original unit system, so they are
   * displayed as-is and converted to kilograms only for the ratio maths.
   */
  const savedView = useMemo(() => {
    if (!saved) return null;
    const i = saved.inputs;
    const toKg = (v: number) => (i.unit_system === "lb" ? lbToKg(v) : v);
    const bwKg = toKg(i.bodyweight);

    const bar = (
      weight: number,
      t: { mid: number; strong: number; elite: number },
    ) => (bwKg > 0 ? strengthScoreFromRatio(toKg(weight) / bwKg, t.mid, t.strong, t.elite) : 0);

    return {
      displayName: i.display_name,
      unitLabel: i.unit_system.toUpperCase(),
      bodyweight: i.bodyweight,
      totalLift: i.bench + i.squat + i.deadlift,
      runDistance: i.run_distance,
      runTimeText: formatSecondsToTime(i.run_seconds),
      bodyweightKg: bwKg,
      benchKg: toKg(i.bench),
      squatKg: toKg(i.squat),
      deadliftKg: toKg(i.deadlift),
      benchBar: bar(i.bench, STRENGTH_RATIO_THRESHOLDS.bench),
      squatBar: bar(i.squat, STRENGTH_RATIO_THRESHOLDS.squat),
      deadliftBar: bar(i.deadlift, STRENGTH_RATIO_THRESHOLDS.deadlift),
    };
  }, [saved]);

  // What the athlete currently has typed, in the shape the submission pipeline
  // takes. Built here so both the submit handler and the staleness check work
  // from one definition of "the current submission".
  const currentForm: ScoreFormValues = useMemo(
    () => ({
      displayName,
      unitSystem,
      bodyweight: weight,
      bench,
      squat,
      deadlift,
      runDistance,
      runSeconds: runSeconds > 0 ? runSeconds : null,
      runTimeText,
      visibility: submissionVisibility(publishToLeaderboard),
    }),
    [displayName, unitSystem, weight, bench, squat, deadlift, runDistance, runSeconds, runTimeText, publishToLeaderboard],
  );

  // True when the displayed result no longer describes the form. Only a
  // COMPLETE, valid form can be compared — while an entry is half-typed there is
  // no signature to compare against, and flickering "stale" on every keystroke
  // would be noise rather than information.
  const resultIsStale = useMemo(() => {
    if (!saved) return false;
    const built = buildScoreRequestDraft(currentForm);
    if (!built.ok) return true;
    return submissionSignature(built.draft) !== saved.signature;
  }, [saved, currentForm]);

  // Tier and archetype come from the SAVED result. Before a result exists there
  // is nothing to show, and the result panel shows a neutral preview instead of
  // a guessed tier or athlete type.
  const tier: Tier = result?.tier ?? "NOVICE";
  const archetype: Archetype | null = result?.archetype ?? null;
  const archetypeInfo = archetype ? ARCHETYPE_COPY[archetype] : null;

  // Every axis describes the SAME submission. The lift bars used to come from the
  // live form while endurance came from the saved result, so editing a lift after
  // scoring redrew three axes and left the fourth behind.
  const chartData = useMemo(() => {
    return [
      { subject: "Bench", value: savedView?.benchBar ?? 0 },
      { subject: "Squat", value: savedView?.squatBar ?? 0 },
      { subject: "Deadlift", value: savedView?.deadliftBar ?? 0 },
      { subject: "Endurance", value: saved?.result.enduranceIndex ?? 0 },
    ];
  }, [savedView, saved]);

  const nameError = findBannedWord(displayName)
    ? "Please choose a different display name."
    : null;

  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : null;

  function clearFieldError(field: string) {
    setFieldError((current) => (current?.field === field ? null : current));
  }

  // ---- Focus management ----------------------------------------------------

  /** Move focus to what the last explicit action asked for, once it exists. */
  function flushPendingFocus() {
    const target = pendingFocus.current;
    if (!target) return;
    const el =
      target === "step" ? stepRegionRef.current : document.getElementById(target);
    // Not mounted yet: the outgoing step is still animating away. This runs
    // again once it has gone and when the incoming step starts to animate.
    if (!el) return;
    pendingFocus.current = null;
    el.focus({ preventScroll: true });
    bringIntoView(
      target === "step" ? el : ((el.closest("[data-field]") as HTMLElement | null) ?? el),
      reducedMotion,
    );
  }

  // Same-step focus requests (an error on the step already shown) resolve on
  // the commit that follows them. A no-op whenever nothing was requested.
  useEffect(() => {
    flushPendingFocus();
  });

  function goToStep(next: Step, focusTarget: string = "step") {
    pendingFocus.current = focusTarget;
    setStep(next);
  }

  // After a successful save, move focus to the result's heading so it is
  // announced, and bring it into view below the sticky header if it isn't.
  useEffect(() => {
    if (!revealResultPending.current || !saved) return;
    revealResultPending.current = false;
    const el = resultHeadingRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    bringIntoView(document.getElementById("results") ?? el, reducedMotion);
  }, [saved, reducedMotion]);

  // The mobile bar's "Card" and "Details" open the breakdown first; the card
  // only exists once it is rendered, so the download waits for that.
  useEffect(() => {
    if (!showDetails) return;
    if (cardDownloadPending.current && cardRef.current) {
      cardDownloadPending.current = false;
      void downloadCard(cardRef.current);
    }
    if (detailsScrollPending.current) {
      detailsScrollPending.current = false;
      const el = document.getElementById("result-details");
      if (el) el.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
    }
  }, [showDetails, reducedMotion]);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  // ---- Validation ----------------------------------------------------------

  /**
   * Show an error where it belongs: beside its input, on that input's step,
   * when it names one; otherwise under the submit button.
   */
  function showError(error: SubmissionError) {
    const owner = error.field ? FIELD_STEP[error.field] : undefined;
    if (error.field && owner !== undefined) {
      setStatus(null);
      setFieldError({ field: error.field, message: error.message });
      goToStep(owner, fieldId(error.field));
      return;
    }
    setStatus({ tone: "error", text: error.message });
  }

  /**
   * Continue from `from`, checking everything entered so far with the SAME
   * canonical validator the submission uses (buildScoreRequestDraft). A problem
   * with an input on a later step is ignored — that step hasn't been reached —
   * so this adds no rule of its own. Range checks run once every input is
   * present, which is why an out-of-range entry can send the athlete back.
   */
  function advance(from: Step) {
    if (from === 1 && nameError) {
      // Already shown inline; nothing re-renders, so focus it directly.
      pendingFocus.current = fieldId("display_name");
      flushPendingFocus();
      return;
    }
    const built = buildScoreRequestDraft(currentForm);
    if (!built.ok) {
      const owner = built.error.field ? FIELD_STEP[built.error.field] : undefined;
      if (owner !== undefined && owner <= from) {
        showError(built.error);
        return;
      }
    }
    setFieldError(null);
    goToStep((from + 1) as Step);
  }

  function flashStatus(text: string) {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus({ tone: "info", text });
    statusTimer.current = setTimeout(() => {
      setStatus((current) =>
        current?.tone === "info" && current.text === text ? null : current,
      );
    }, 5000);
  }

  // validateInputsOrThrow() used to live here. It was a THIRD opinion on what a
  // valid entry is — expressed in pounds, with bounds that disagreed with the
  // server's kilogram bounds at both ends (it accepted 400 lb, which is 181.44 kg
  // and over the server's 181 kg cap, and it accepted a 5K time of 4:00, which
  // converts far below the canonical floor). buildScoreRequestDraft() below runs
  // parseCanonicalBenchmark — the very validator the route runs — so there is now
  // one set of rules, and its messages are the ones the athlete sees.

  /**
   * ONE request per submission.
   *
   * POST /api/score validates, converts, scores against the frozen dataset
   * version, persists, and returns the SAVED row. There is no second call and
   * no local arithmetic, so what the athlete reads is what the database holds.
   *
   * The session ref owns the idempotency key: an unchanged retry replays the
   * original row instead of writing a second one, changed inputs rotate the key,
   * and a request already in flight makes this a no-op.
   */
  async function generateProfile() {
    if (isWorking) return;

    // The athlete's OWN numbers, unconverted. The server converts from these and
    // re-validates; a browser-side conversion is never trusted or sent.
    //
    // Pre-flight through the SAME canonical validator the server runs, so an
    // impossible entry is caught without spending one of the athlete's five
    // requests per minute. The server still re-validates everything.
    const built = buildScoreRequestDraft(currentForm);
    if (!built.ok) {
      showError(built.error);
      return;
    }

    setIsWorking(true);
    setStatus(null);
    setFieldError(null);

    try {
      const outcome = await submitScore(sessionRef.current, built.draft);

      if (outcome.status === "busy") {
        // A submission is already in flight and owns the status line.
        return;
      }

      if (outcome.status === "error") {
        // The message is already athlete-facing and never echoes a submitted
        // value. Inputs are untouched, and on a retryable failure the stored
        // idempotency key is kept, so tapping again retries the SAME submission
        // rather than creating a second one. The previously saved result AND
        // its inputs stay exactly as they were — `saved` is never cleared on
        // failure, and because the two live in one piece of state they cannot
        // come apart here.
        showError(outcome.error);
        return;
      }

      // The ONLY place a result is set, and it is set wholesale from the saved
      // server row. Nothing is merged in from local state, so a stale field
      // cannot survive alongside a fresh one.
      // ONE write. The result and the inputs it was computed from land together,
      // and `built.draft` was captured before the request went out — so an edit
      // made while this was in flight cannot be attached to this result.
      setSaved({
        result: outcome.result,
        inputs: built.draft,
        signature: submissionSignature(built.draft),
      });
      setShowDetails(false);
      setShowExplainer(false);
      flashStatus(savedStatusText(outcome.result, outcome.replayed));
      revealResultPending.current = true;
    } catch (e: unknown) {
      // submitScore converts every expected failure into an outcome, so this is
      // genuinely unexpected. Keep whatever result was already on screen.
      setStatus({
        tone: "error",
        text: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  function resetForm() {
    // Blocked while a request is pending. Clearing the form mid-flight would
    // leave a response arriving for a submission the athlete has abandoned;
    // blocking the click is smaller and clearer than reconciling that
    // afterwards. (The response itself is already safe — it carries its own
    // captured inputs — but the UI state would be confusing.)
    if (isWorking) return;
    setWeight("");
    setBench("");
    setSquat("");
    setDeadlift("");
    setRunTimeDigits("");
    // One assignment clears every scored value, because there is only one
    // place they live now.
    setSaved(null);
    // The submission session is deliberately NOT reset. The stored key is
    // keyed to the INPUTS: re-entering the same numbers is the same logical
    // submission and must replay the existing row, not write a second one,
    // while any change rotates the key on its own. Clearing the session here
    // would turn "reset, retype the same values" into a duplicate leaderboard
    // entry.
    setShowDetails(false);
    setShowExplainer(false);
    setStatus(null);
    setFieldError(null);
    // Publication consent is never carried over a reset.
    setPublishToLeaderboard(false);
    goToStep(1);
  }

  async function downloadScorecard() {
    if (cardRef.current) await downloadCard(cardRef.current);
  }

  function downloadFromBar() {
    if (showDetails && cardRef.current) {
      void downloadCard(cardRef.current);
      return;
    }
    cardDownloadPending.current = true;
    setShowDetails(true);
  }

  function openDetailsFromBar() {
    detailsScrollPending.current = true;
    if (showDetails) {
      document
        .getElementById("result-details")
        ?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      detailsScrollPending.current = false;
      return;
    }
    setShowDetails(true);
  }

  const copyShareLink = async () => {
    // Shares the SAVED submission. This used to serialise the live form, so a
    // link copied after editing a field described numbers that were never
    // scored — and whoever opened it got a different result than the card.
    if (!saved) {
      alert("Generate your profile first, then copy your link.");
      return;
    }

    const i = saved.inputs;
    const params = new URLSearchParams();
    params.set("name", i.display_name);
    params.set("bw", String(i.bodyweight));
    params.set("b", String(i.bench));
    params.set("s", String(i.squat));
    params.set("d", String(i.deadlift));
    params.set("u", i.unit_system);
    params.set("dist", i.run_distance);
    params.set("t", formatSecondsToTime(i.run_seconds));

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

    if (hasSharedStats) setStep(4);
  }, []);

  const submitLabel = isWorking
    ? "Calculating…"
    : saved && resultIsStale
      ? "Update my score"
      : "Get my score";

  return (
    <MotionConfig reducedMotion="user">
    <section className={`mx-auto max-w-7xl ${hasResults && !isWorking ? "pb-20 lg:pb-0" : ""}`}>
      {/* One line of context, then straight into the form. */}
      <div className="mb-5 sm:mb-6">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-3xl">
          Get your Hybrid Score
        </h1>
        <p className="mt-1.5 hidden text-[15px] text-white/65 sm:block">
          Your result is private unless you choose to publish it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Guided input card */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-medium text-white/60">Step {step} of 4</div>
              <UnitToggle
                value={unitSystem}
                onChange={(next) => {
                  setUnitSystem(next);
                  // Range messages are in the athlete's units.
                  setFieldError(null);
                }}
              />
            </div>
            <StepProgress step={step} />

            {/*
              The step region is the focus target when the step changes, so a
              keyboard or screen-reader user lands on the new step's heading.
              It stays mounted; only its contents animate.
            */}
            <div
              ref={stepRegionRef}
              tabIndex={-1}
              role="group"
              aria-labelledby="step-title"
              className="mt-5 scroll-mt-24 outline-none"
            >
              <AnimatePresence
                mode="wait"
                initial={false}
                // The incoming step renders just after this fires, hence the frame.
                onExitComplete={() => requestAnimationFrame(flushPendingFocus)}
              >
                <motion.div
                  key={step}
                  onAnimationStart={flushPendingFocus}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: STEP_ENTER }}
                  exit={{ opacity: 0, y: -4, transition: STEP_EXIT }}
                >
                  <h2 id="step-title" className="text-2xl font-semibold text-white">
                    {STEP_COPY[step].title}
                  </h2>
                  <p className="mt-1 text-[15px] text-white/65">{STEP_COPY[step].sub}</p>

                  <form
                    noValidate
                    className="mt-5 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (step === 4) void generateProfile();
                      else advance(step);
                    }}
                  >
                    {/* STEP 1 */}
                    {step === 1 && (
                      <>
                        <TextField
                          id={fieldId("display_name")}
                          label="Display name (optional)"
                          placeholder="e.g., Ryan"
                          value={displayName}
                          onChange={(value) => {
                            setDisplayName(value);
                            localStorage.setItem("strendex_name", value);
                            clearFieldError("display_name");
                          }}
                          hint="Shown on your athlete card, and on the leaderboard only if you publish."
                          error={nameError ?? errorFor("display_name")}
                        />

                        <Field
                          id={fieldId("bodyweight")}
                          label={`Bodyweight (${unitLabel})`}
                          placeholder="e.g., 195"
                          value={weight}
                          onChange={(value) => {
                            setWeight(value);
                            clearFieldError("bodyweight");
                          }}
                          hint="Used to scale your lifts."
                          error={errorFor("bodyweight")}
                        />

                        <button type="submit" className={`mt-2 ${BTN_PRIMARY}`}>
                          Continue
                        </button>
                      </>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                      <>
                        <Field
                          id={fieldId("bench")}
                          label={`Bench (${unitLabel})`}
                          placeholder="e.g., 275"
                          value={bench}
                          onChange={(value) => {
                            setBench(value);
                            clearFieldError("bench");
                          }}
                          error={errorFor("bench")}
                        />
                        <Field
                          id={fieldId("squat")}
                          label={`Squat (${unitLabel})`}
                          placeholder="e.g., 365"
                          value={squat}
                          onChange={(value) => {
                            setSquat(value);
                            clearFieldError("squat");
                          }}
                          error={errorFor("squat")}
                        />
                        <Field
                          id={fieldId("deadlift")}
                          label={`Deadlift (${unitLabel})`}
                          placeholder="e.g., 425"
                          value={deadlift}
                          onChange={(value) => {
                            setDeadlift(value);
                            clearFieldError("deadlift");
                          }}
                          error={errorFor("deadlift")}
                        />

                        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-white/65">Total lift</span>
                            <span className="font-semibold tabular-nums text-white">
                              {displayTotalLift > 0 ? `${Math.round(displayTotalLift)} ${unitLabel}` : "—"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-white/65">Total ÷ bodyweight</span>
                            <span className="font-semibold tabular-nums text-white">
                              {strengthRatio > 0 ? strengthRatio.toFixed(2) : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => goToStep(1)} className={BTN_SECONDARY}>
                            Back
                          </button>
                          <button type="submit" className={BTN_PRIMARY}>
                            Continue
                          </button>
                        </div>
                      </>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                      <>
                        <div data-field className="scroll-mt-24">
                          <label
                            htmlFor={fieldId("run_distance")}
                            className="mb-1.5 block text-sm font-medium text-white/75"
                          >
                            Distance
                          </label>
                          <div className="relative">
                            <select
                              id={fieldId("run_distance")}
                              value={runDistance}
                              onChange={(e) => {
                                setRunDistance(e.target.value as RunDistance);
                                clearFieldError("run_distance");
                                // The accepted time range depends on the distance.
                                clearFieldError("run_seconds");
                              }}
                              aria-describedby={`${fieldId("run_distance")}-hint`}
                              className={`${INPUT} ${INPUT_OK} appearance-none pr-11 hover:bg-white/[0.04]`}
                            >
                              {(Object.keys(DISTANCE_LABEL) as RunDistance[]).map((d) => (
                                <option key={d} value={d}>
                                  {DISTANCE_LABEL[d]}
                                </option>
                              ))}
                            </select>
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <p id={`${fieldId("run_distance")}-hint`} className="mt-1.5 text-sm text-white/55">
                            Every distance is converted to one common standard.
                          </p>
                        </div>

                        <div data-field className="scroll-mt-24">
                          <label
                            htmlFor={fieldId("run_seconds")}
                            className="mb-1.5 block text-sm font-medium text-white/75"
                          >
                            Time
                          </label>
                          <input
                            id={fieldId("run_seconds")}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={runTimeText}
                            placeholder="e.g., 2230 for 22:30"
                            aria-invalid={runTimeProblem || errorFor("run_seconds") ? true : undefined}
                            aria-describedby={[
                              runTimeProblem || errorFor("run_seconds") ? `${fieldId("run_seconds")}-error` : null,
                              `${fieldId("run_seconds")}-hint`,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setRunTimeDigits(digits);
                              clearFieldError("run_seconds");
                            }}
                            className={`${INPUT} ${runTimeProblem || errorFor("run_seconds") ? INPUT_ERROR : INPUT_OK} tabular-nums`}
                            onKeyDown={(e) => {
                              const key = e.key;
                              if (
                                key === "Tab" ||
                                key === "Enter" ||
                                key === "ArrowLeft" ||
                                key === "ArrowRight" ||
                                key === "ArrowUp" ||
                                key === "ArrowDown" ||
                                key === "Home" ||
                                key === "End" ||
                                // Keyboard shortcuts (paste, select all, …) keep
                                // their normal behaviour.
                                e.metaKey ||
                                e.ctrlKey
                              ) {
                                return;
                              }
                              const el = e.currentTarget;
                              const allSelected = el.selectionStart === 0 && el.selectionEnd === el.value.length;

                              if (key === "Backspace") {
                                e.preventDefault();
                                clearFieldError("run_seconds");
                                if (allSelected) return setRunTimeDigits("");
                                return setRunTimeDigits((prev) => prev.slice(0, -1));
                              }
                              if (key === "Delete") {
                                e.preventDefault();
                                clearFieldError("run_seconds");
                                return setRunTimeDigits("");
                              }
                              if (/^\d$/.test(key)) {
                                e.preventDefault();
                                clearFieldError("run_seconds");
                                return setRunTimeDigits((prev) => (prev + key).slice(0, 6));
                              }
                              e.preventDefault();
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData("text") || "";
                              const digits = pasted.replace(/\D/g, "").slice(0, 6);
                              setRunTimeDigits(digits);
                              clearFieldError("run_seconds");
                            }}
                          />
                          {runTimeProblem || errorFor("run_seconds") ? (
                            <FieldError
                              id={`${fieldId("run_seconds")}-error`}
                              message={(runTimeProblem ?? errorFor("run_seconds")) as string}
                            />
                          ) : null}
                          <p id={`${fieldId("run_seconds")}-hint`} className="mt-1.5 text-sm text-white/55">
                            Digits only. Accepted range: {runTimeRangeText(runDistance)}.
                          </p>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => goToStep(2)} className={BTN_SECONDARY}>
                            Back
                          </button>
                          <button type="submit" className={BTN_PRIMARY}>
                            Continue
                          </button>
                        </div>
                      </>
                    )}

                    {/* STEP 4 — review, consent, submit */}
                    {step === 4 && (
                      <>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="grid grid-cols-1 gap-3 text-[15px]">
                            <Row label="Name" value={displayName.trim() ? displayName.trim() : ANONYMOUS_NAME} />
                            <Row label="Bodyweight" value={displayWeight > 0 ? `${Math.round(displayWeight)} ${unitLabel}` : "—"} />
                            <Row label="Lifts" value={displayTotalLift > 0 ? `${Math.round(displayTotalLift)} ${unitLabel} total` : "—"} />
                            <Row
                              label="Run"
                              value={runTimeText.trim() ? `${DISTANCE_LABEL[runDistance]} · ${runTimeText.trim()}` : "—"}
                            />
                          </div>
                        </div>

                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors duration-150 hover:bg-white/[0.05] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/70">
                          <input
                            type="checkbox"
                            checked={publishToLeaderboard}
                            onChange={(e) => setPublishToLeaderboard(e.target.checked)}
                            disabled={isWorking}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-white outline-none"
                            data-testid="publish-to-leaderboard"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-white">
                              Include my result when public rankings open
                            </span>
                            <span className="mt-1 block text-xs text-white/55">
                              Rankings are temporarily hidden while the athlete dataset grows. Publishing now makes your result eligible to appear when rankings open. Changing this later won&apos;t remove a result you&apos;ve already published.
                            </span>
                          </span>
                        </label>

                        <button
                          type="submit"
                          disabled={isWorking}
                          aria-busy={isWorking}
                          className={saved && !resultIsStale && !isWorking ? BTN_SECONDARY : BTN_PRIMARY}
                        >
                          {isWorking ? <Spinner /> : null}
                          {submitLabel}
                        </button>

                        {/* A save confirmation describes the saved result, so it
                            gives way to the consent line once the entries change. */}
                        {status && (status.tone === "error" || !resultIsStale) ? (
                          status.tone === "error" ? (
                            <div role="alert" className="flex items-start gap-2 text-sm text-white">
                              <ErrorMark />
                              <span>{status.text}</span>
                            </div>
                          ) : (
                            <div role="status" className="text-sm text-white/60">
                              {status.text}
                            </div>
                          )
                        ) : (
                          <div className="text-sm text-white/60">
                            {publishToLeaderboard
                              ? "Your result will be saved for the public rankings. Higher scores may be reviewed before appearing."
                              : "Your result stays private. You’ll still receive your full score and performance breakdown."}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button type="button" onClick={() => goToStep(3)} className={BTN_SECONDARY}>
                            Back
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={resetForm}
                            className={BTN_SECONDARY}
                          >
                            Reset
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Result */}
        <div className="lg:col-span-7">
          <motion.div
            id="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.05 }}
            aria-busy={isWorking}
            className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
          >
            {!result ? (
              isWorking ? <ResultLoading /> : <ResultPreview />
            ) : (
              <div className={`transition-opacity duration-200 ${isWorking ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white/60">
                    {resultIsStale ? "Your saved result" : "Your result"}
                  </div>
                  {isWorking ? (
                    <div role="status" className="inline-flex items-center gap-2 text-sm text-white/70">
                      <Spinner /> Calculating…
                    </div>
                  ) : null}
                </div>

                {/*
                  The inputs have changed since this result was saved. The score
                  below is still the real, saved one — it is just no longer a
                  score for what is in the form. Say that plainly rather than
                  silently showing a number beside numbers it was not computed
                  from.
                */}
                <AnimatePresence initial={false}>
                  {resultIsStale && !isWorking ? (
                    <motion.div
                      key="stale"
                      role="status"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/80"
                    >
                      Your entries have changed since this result was saved. Use
                      “Update my score” to score them.
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Keyed on the saved row: a new result reveals once; a replay
                    of the same row does not animate again. */}
                <motion.div
                  key={result.resultId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <h2
                      ref={resultHeadingRef}
                      tabIndex={-1}
                      className="scroll-mt-24 rounded-lg outline-none"
                    >
                      <span className="block text-sm font-medium text-white/60">Hybrid Score</span>
                      <span className="mt-1 flex items-baseline gap-2">
                        <span className="text-6xl font-semibold tracking-tight tabular-nums text-[#DFFF00]">
                          {result.hybridScore}
                        </span>
                        <span className="text-[16px] font-medium text-white/50">/ 100</span>
                      </span>
                    </h2>

                    <div className="text-right">
                      <div className="text-sm text-white/55">Tier</div>
                      <div className="mt-2 inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-widest text-white/85">
                        {result.tier}
                      </div>
                    </div>
                  </div>

                  {/* The score explanation, behind a real disclosure. Built from
                      the SAVED row, so it describes the dataset this result was
                      actually scored against — including saying plainly when that
                      comparison group is still provisional. */}
                  <button
                    type="button"
                    aria-expanded={showExplainer}
                    aria-controls="score-explainer"
                    onClick={() => setShowExplainer((v) => !v)}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-md text-sm text-white/65 underline-offset-4 transition-colors duration-150 hover:text-white hover:underline ${FOCUS_RING}`}
                  >
                    How is this calculated?
                    <Chevron open={showExplainer} />
                  </button>
                  <AnimatePresence initial={false}>
                    {showExplainer ? (
                      <motion.div
                        id="score-explainer"
                        key="explainer"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/70">
                          {scoreExplanation(result).map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                          <p>
                            <Link
                              href="/methodology"
                              className={`rounded text-white underline underline-offset-4 ${FOCUS_RING}`}
                            >
                              Read the full methodology
                            </Link>
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/*
                    The tiles are the two component percentiles and the athlete
                    type. The percentiles are measured against the frozen
                    reference dataset, NOT the leaderboard, so leaderboard
                    placement is kept out of them: it is the single labelled line
                    below the tiles, and it never shows a percentage.
                  */}
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatTile label="Strength percentile" value={`${result.strengthPercentile.toFixed(1)}%`} note="of the reference dataset" />
                    <StatTile label="Endurance percentile" value={`${result.endurancePercentile.toFixed(1)}%`} note="of the reference dataset" />
                    <StatTile
                      label="Athlete type"
                      value={result.archetype}
                      note={archetypeInfo?.tagline ?? ""}
                      compact
                      className="col-span-2 sm:col-span-1"
                    />
                  </div>

                  {/* Leaderboard placement: the server's rank and total, or why there is none. */}
                  {LEADERBOARD_PLACEMENT_AVAILABLE && result ? (
                    <div className="mt-4 text-sm text-white/65" data-testid="leaderboard-placement">
                      {placementLine(result).text}
                    </div>
                  ) : null}
                </motion.div>

                {/* Athlete Review sits under the key result and above the
                    breakdown: the score stays the first thing the athlete sees. */}
                {saved && savedView && !isWorking && (
                  <AthleteReviewCTA
                    /* Scores from the SAVED row, inputs from the SAME submission.
                       Both halves come out of one piece of state, so the review can
                       never be handed a saved score beside edited inputs. */
                    hybridScore={saved.result.hybridScore}
                    strengthPercentile={saved.result.strengthPercentile}
                    endurancePercentile={saved.result.endurancePercentile}
                    strengthIndex={saved.result.strengthIndex}
                    enduranceIndex={saved.result.enduranceIndex}
                    tier={saved.result.tier}
                    archetype={saved.result.archetype}
                    /* Placement only as the server returned it; the review must
                       not imply a standing otherwise. */
                    rank={saved.result.leaderboard?.rank ?? null}
                    totalAthletes={saved.result.leaderboard?.total ?? null}
                    betterThanPercent={null}
                    inputs={{
                      bodyweightKg: savedView.bodyweightKg,
                      benchKg: savedView.benchKg,
                      squatKg: savedView.squatKg,
                      deadliftKg: savedView.deadliftKg,
                      /* The canonical conversion, from the one implementation that
                         defines it — the same function and the same validated
                         seconds the server scored, so the snapshot cannot describe a
                         different run than the score. */
                      enduranceSeconds: toCanonicalEnduranceSeconds(
                        saved.inputs.run_seconds,
                        saved.inputs.run_distance,
                      ),
                      runDistance: saved.inputs.run_distance,
                      runTimeText: savedView.runTimeText,
                      unitSystem: saved.inputs.unit_system,
                    }}
                    /* The benchmark this saved result was scored against, so the
                       review re-scores against the same frozen dataset. */
                    benchmark={{
                      datasetVersionId: saved.result.datasetVersionId,
                      scoreVersion: saved.result.scoreVersion,
                    }}
                    emphasized={arIntent}
                  />
                )}

                <div className={`mt-5 grid grid-cols-1 gap-2 ${LEADERBOARD_PLACEMENT_AVAILABLE ? "sm:grid-cols-2" : ""}`}>
                  <button
                    type="button"
                    id="details-toggle-btn"
                    aria-expanded={showDetails}
                    aria-controls="result-details"
                    onClick={() => setShowDetails((v) => !v)}
                    className={BTN_SECONDARY}
                  >
                    {showDetails ? "Hide full breakdown" : "See full breakdown"}
                    <Chevron open={showDetails} />
                  </button>
                  {LEADERBOARD_PLACEMENT_AVAILABLE ? (
                    <Link href="/rankings" className={BTN_SECONDARY}>
                      View rankings
                    </Link>
                  ) : null}
                </div>

                {/* Full breakdown */}
                <AnimatePresence initial={false}>
                  {showDetails ? (
                    <motion.div
                      id="result-details"
                      key="details"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="mt-6 scroll-mt-24 space-y-6"
                    >
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Archetype</div>
                        {archetype && archetypeInfo ? (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <ArchetypeBadge archetype={archetype} />
                              <span className="text-sm text-white/70">{archetypeInfo.tagline}</span>
                            </div>

                            <div className="mt-3 text-sm text-white/60 leading-relaxed">{archetypeInfo.description}</div>
                            <div className="mt-3 text-sm">
                              <span className="font-semibold text-white">Focus:</span>{" "}
                              <span className="text-white/60">{archetypeInfo.focus}</span>
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 text-sm text-white/55">
                            Generate your profile to see your archetype.
                          </div>
                        )}
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
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] ${tierMeta[tier].pill}`}
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
              {savedView ? savedView.displayName : "—"}
            </div>
            <div style={{ fontSize: "clamp(8px, 2.5vw, 11px)", color: "rgba(255,255,255,0.38)", marginTop: "5px", letterSpacing: "0.06em" }}>
              {archetype ?? ""}
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
              {result ? result.hybridScore : "—"}
            </div>
            <div style={{ fontSize: "10px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginTop: "10px" }}>
              out of 100
            </div>
            {/*
              No "Better than X% of athletes" here: a leaderboard-derived percentage
              would read like the benchmark percentiles. The card carries the
              archetype; placement, when the server returned one, is in the footer.
            */}
            {archetype && (
              <div style={{
                marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "7px",
                borderRadius: "999px", border: "0.5px solid rgba(223,255,0,0.2)",
                background: "rgba(223,255,0,0.08)", padding: "11px 20px",
                fontSize: "clamp(9px, 2.5vw, 12px)", fontWeight: 700, color: "rgba(240,255,170,0.95)", letterSpacing: "0.02em", lineHeight: 1,
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#DFFF00", boxShadow: "0 0 10px rgba(223,255,0,0.6)" }} />
                {archetype}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {/* The card describes the SAVED submission, not the live form. */}
            {[
              { k: "BW", v: savedView ? `${Math.round(savedView.bodyweight)} ${savedView.unitLabel}` : "—" },
              { k: "Total", v: savedView ? `${Math.round(savedView.totalLift)} ${savedView.unitLabel}` : "—" },
              { k: (savedView?.runDistance ?? runDistance).toUpperCase(), v: savedView?.runTimeText ?? "—" },
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
              {LEADERBOARD_PLACEMENT_AVAILABLE && result?.leaderboard
                ? `#${result.leaderboard.rank} / ${result.leaderboard.total}`
                : "CAN YOU BEAT THIS?"}
            </div>
          </div>

        </div>
        </div>
      </div>
      </div>
                      {/* Tiers */}
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <div className="flex items-center justify-between px-5 py-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Tiers</div>
                            <div className="mt-1 text-[16px] font-semibold text-white">Where your score sits</div>
                          </div>
                          {LEADERBOARD_PLACEMENT_AVAILABLE ? (
                            <Link
                              href="/rankings"
                              className={`rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-white/[0.06] ${FOCUS_RING}`}
                            >
                              Open rankings
                            </Link>
                          ) : null}
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
                                // Only a saved result has a tier to mark.
                                const active = result.tier === (row.label as Tier);
                                return (
                                  <tr
                                    key={row.label}
                                    aria-current={active ? "true" : undefined}
                                    className={active ? "bg-white/[0.07]" : ""}
                                  >
                                    <td className="px-5 py-3 font-semibold text-white">
                                      {row.label}
                                      {active ? <span className="ml-2 text-xs font-medium text-white/55">Your tier</span> : null}
                                    </td>
                                    <td className="px-5 py-3 text-white/60">{row.range}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Mobile result bar: the saved score stays in reach while scrolling. */}
      {hasResults && !isWorking && result && (
        <div className="fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0E1014] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs text-white/60">Hybrid Score</span>
              <span className="text-[16px] font-semibold tabular-nums text-[#DFFF00]">{result.hybridScore}</span>
              <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-white/80">
                {result.tier}
              </span>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={downloadFromBar}
                className={`inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white ${PRESS} ${FOCUS_RING}`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={openDetailsFromBar}
                className={`inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white ${PRESS} ${FOCUS_RING}`}
              >
                Details
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
    </MotionConfig>
  );
}

// ---------- Small UI components ----------

function StepProgress({ step }: { step: Step }) {
  return (
    <div aria-hidden="true" className="mt-3 grid grid-cols-4 gap-1.5">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className="relative h-1 overflow-hidden rounded-full bg-white/10">
          <motion.span
            className="absolute inset-0 origin-left rounded-full bg-white/70"
            initial={false}
            animate={{ scaleX: n <= step ? 1 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        </span>
      ))}
    </div>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (next: UnitSystem) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Weight units"
      className="grid w-[112px] grid-cols-2 gap-0.5 rounded-full border border-white/10 bg-black/30 p-0.5"
    >
      {(["lb", "kg"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={value === u}
          onClick={() => onChange(u)}
          className={`rounded-full py-1.5 text-center text-sm font-semibold transition-colors duration-150 ${FOCUS_RING} ${
            value === u ? "bg-white text-black" : "text-white/70 hover:bg-white/[0.06]"
          }`}
        >
          {u.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** The result panel before anything has been scored: what you'll get, no values. */
function ResultPreview() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">Your Hybrid Score will appear here</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/65">
        Complete the four steps to see:
      </p>
      <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
        {RESULT_PREVIEW.filter((item) => LEADERBOARD_PLACEMENT_AVAILABLE || !item.placement).map((item) => (
          <div key={item.term} className="py-3.5 sm:grid sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold text-white">{item.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-white/60 sm:mt-0">{item.detail}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/methodology"
        className={`mt-4 inline-block rounded text-sm text-white/70 underline underline-offset-4 transition-colors duration-150 hover:text-white ${FOCUS_RING}`}
      >
        How scoring works
      </Link>
    </div>
  );
}

/** First calculation in flight: real pending state, no placeholder numbers. */
function ResultLoading() {
  return (
    <div role="status">
      <div className="inline-flex items-center gap-2 text-sm font-medium text-white/70">
        <Spinner /> Calculating your score…
      </div>
      <div aria-hidden="true" className="mt-5 space-y-4">
        <div className="h-16 w-36 rounded-xl bg-white/[0.05] motion-safe:animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.04] motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  compact = false,
  className = "",
}: {
  label: string;
  value: string;
  note: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}>
      <div className="text-sm text-white/55">{label}</div>
      <div
        className={`mt-1 font-semibold text-white ${compact ? "text-sm leading-snug" : "text-2xl tabular-nums"}`}
      >
        {value}
      </div>
      {note ? <div className="mt-1 text-xs leading-snug text-white/55">{note}</div> : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 motion-safe:animate-spin"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-white">
      <ErrorMark />
      <span>{message}</span>
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-white/60">{label}</div>
      <div className="text-right font-semibold text-white">{value}</div>
    </div>
  );
}

function describedBy(id: string, error: string | null | undefined, hint: string | undefined) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

function TextField({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <div data-field className="scroll-mt-24">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/75">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={24}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${INPUT} ${error ? INPUT_ERROR : INPUT_OK}`}
      />
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-white/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <div data-field className="scroll-mt-24">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/75">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${INPUT} ${error ? INPUT_ERROR : INPUT_OK}`}
      />
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-white/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ArchetypeBadge({ archetype }: { archetype: Archetype }) {
  const meta: Record<Archetype, { label: string; ring: string; bg: string; icon: ReactNode }> = {
    "STRENGTH BEAST": {
      label: "Strength Beast",
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
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
      ring: "border-white/15",
      bg: "bg-white/[0.04] text-white/80",
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