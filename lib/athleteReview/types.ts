// Shared types for the Strendex Athlete Review feature.
// Pure types only — no I/O, safe to import from client and server.

import type { Tier } from "@/lib/scoring/core";
import type { CurrentBenchmark, ScenarioTargets } from "./targets";

export type UnitSystem = "lb" | "kg";

export const SNAPSHOT_VERSION = 1;

// Saved to sessionStorage when the athlete finishes the normal benchmark.
// `inputs` are canonical units (kg + half-marathon-equivalent seconds) and are
// what the review endpoint re-scores from. `display` values are shown in the UI
// only and are never treated as canonical by the server.
export type ResultSnapshotV1 = {
  v: 1;
  savedAt: number;
  inputs: {
    bodyweightKg: number;
    benchKg: number | null;
    squatKg: number | null;
    deadliftKg: number | null;
    enduranceSeconds: number | null;
    runDistance: string | null;
    runTimeText: string | null;
    /**
     * The run as entered, in whole seconds at runDistance. The review talks
     * about this run, and the server checks it converts to enduranceSeconds.
     * Null on a snapshot saved before the review carried it.
     */
    runSeconds: number | null;
    unitSystem: UnitSystem;
  };
  /**
   * The frozen benchmark the saved result was scored against. The review
   * re-scores against THIS dataset version, never whichever is active now.
   * Null only on a snapshot saved before Group 3; the review then asks the
   * athlete to recalculate. Carries no submission data.
   */
  benchmark: {
    datasetVersionId: string | null;
    scoreVersion: string | null;
  };
  display: {
    hybridScore: number;
    strengthPercentile: number | null;
    endurancePercentile: number | null;
    strengthIndex: number | null;
    enduranceIndex: number | null;
    tier: string;
    archetype: string;
    rank: number | null;
    totalAthletes: number | null;
    betterThanPercent: number | null;
  };
};

export type GoalOption =
  | "raise_score"
  | "balance"
  | "strength"
  | "endurance"
  | "race_prep"
  | "muscle_endurance"
  | "fat_loss"
  | "athleticism";

export type PriorityLift = "bench" | "squat" | "deadlift" | "overall";

export type AssessmentAnswers = {
  // Step 1 — athlete context
  ageRange: "u18" | "18_24" | "25_34" | "35_44" | "45_54" | "55p";
  trainingYears: "u1" | "1_2" | "3_5" | "6_9" | "10p";
  background:
    | "strength"
    | "running"
    | "hybrid"
    | "crossfit"
    | "team"
    | "general"
    | "returning"
    | "other";

  // Step 2 — current training
  strengthSessions: number; // 0–7
  enduranceSessions: number; // 0–7
  weeklyRunVolume: "none" | "u10" | "10_20" | "21_35" | "36_50" | "50p";
  sessionDuration: "u30" | "30_45" | "46_60" | "61_90" | "90p";
  programming: "structured" | "self_planned" | "coached" | "no_plan" | "rebuilding";
  consistency: "very" | "mostly" | "inconsistent" | "returning" | "unable";

  // Step 3 — goals
  primaryGoal: GoalOption;
  secondaryGoal?: GoalOption;
  timeline: "4_6w" | "8_12w" | "3_6m" | "6_12m" | "none";
  targetHybridScore?: number; // only if primaryGoal === "raise_score"
  priorityLift?: PriorityLift; // only if primaryGoal === "strength"
  targetLiftValue?: number; // optional, athlete's display unit
  targetEvent?: "5k" | "10k" | "half" | "marathon" | "hyrox" | "general";
  targetTime?: string; // optional, "mm:ss" style text

  // Step 4 — recovery + constraints
  daysAvailable: number; // 1–7
  sleepHours: "u5" | "5_6" | "6_7" | "7_8" | "8_9" | "9p";
  sleepQuality: "poor" | "inconsistent" | "fair" | "good" | "excellent";
  stress: "very_low" | "low" | "moderate" | "high" | "very_high";
  recovery: "poor" | "below_avg" | "average" | "good" | "excellent";
  mainConstraint:
    | "time"
    | "recovery"
    | "motivation"
    | "injury"
    | "programming"
    | "nutrition"
    | "equipment"
    | "priorities"
    | "unsure";
  injuryNote?: string; // ≤400 chars, only if mainConstraint === "injury"

  // Step 5 — final context
  holdingBack?: string; // ≤500 chars
};

export type ScenarioId = "endurance_push" | "strength_push" | "balanced";

export type Scenario = {
  id: ScenarioId;
  title: string;
  description: string; // deterministic template string — never AI text
  horizonWeeks: number;
  available: boolean;
  /**
   * Why an unavailable scenario can't be projected, when presentation needs to
   * say it in the athlete's own terms. "endurance_at_cap": the run already
   * earns the maximum endurance score, so a faster time changes nothing.
   */
  unavailableReason?: "endurance_at_cap";
  changes: {
    enduranceSecondsDelta: number | null; // negative = faster
    benchPct: number;
    squatPct: number;
    deadliftPct: number;
  };
  projected: {
    hq: number;
    tier: string;
    strengthPercentile: number;
    endurancePercentile: number;
    hqDelta: number;
    /** The exact benchmark computeScore was given for this projection (kg, canonical seconds). */
    inputs: {
      benchKg: number | null;
      squatKg: number | null;
      deadliftKg: number | null;
      enduranceSeconds: number | null;
    };
  } | null;
  isPrimary: boolean;
};

export type ReportStrength = {
  title: string;
  explanation: string;
  evidence: string;
};

export type ReportLimiter = {
  title: string;
  impact: "high" | "medium" | "low";
  explanation: string;
  evidence: string;
};

export type AthleteReviewReport = {
  headline: string;
  athleteSummary: string;
  profileInterpretation: string;
  strengths: ReportStrength[]; // exactly 3
  limiters: ReportLimiter[]; // exactly 3
  highestLeverageMove: {
    title: string;
    why: string;
    whatToDo: string;
    whatToMaintain: string;
    /** What to stop chasing this block, and the trade-off it buys. */
    deprioritize: string;
  };
  priorities: { priority: number; action: string; reason: string }[]; // exactly 3
  focusPlan: {
    durationWeeks: number;
    strengthFocus: string;
    enduranceFocus: string;
    recoveryFocus: string;
    weeklyStructure: string[];
  };
  retest: {
    recommendedWeeks: number;
    metricsToRetest: string[];
    successSignal: string;
  };
  confidenceNote: string;
  disclaimer: string;
};

export type AthleteReviewComputed = {
  hq: number;
  tier: string;
  archetype: string;
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
};

/**
 * Deterministic performance diagnosis (lib/athleteReview/diagnosis.ts), built
 * on the server from the canonical score and scenarios. Never AI output.
 */
export type AthleteReviewDiagnosis = {
  hybridScore: number;
  tier: Tier;
  archetype: string;
  strengthPercentile: number;
  endurancePercentile: number;

  /** "balanced" when the engine's lean rule calls the gap balanced. */
  leadingSide: "strength" | "endurance" | "balanced";
  trailingSide: "strength" | "endurance" | null;
  /** |strength percentile − endurance percentile|, to one decimal like the percentiles. */
  percentileGap: number;

  /** The scenario computeScenarios marked primary — null when none could be projected. */
  bestFit: {
    id: ScenarioId;
    title: string;
    description: string;
    horizonWeeks: number;
    currentHybridScore: number;
    projectedHybridScore: number;
    projectedGain: number;
    projectedTier: string;
    /** The projected score lands in a higher tier than the current one. */
    reachesHigherTier: boolean;
    /** The scenario's exact projected inputs, in the athlete's run distance and units. */
    targets: ScenarioTargets;
  } | null;

  /** The athlete's own benchmark as they entered it: run distance and time, lifts in their unit. */
  benchmark: CurrentBenchmark;
  /** Athlete-facing targets for every projected scenario, keyed by scenario. */
  scenarioTargets: Partial<Record<ScenarioId, ScenarioTargets>>;

  /** The next tier up and how far away it is — null once the top tier is reached. */
  nextTier: { tier: Tier; threshold: number; pointsAway: number } | null;
  topTierReached: boolean;
};

export type AthleteReviewResponse = {
  report: AthleteReviewReport;
  scenarios: Scenario[];
  computed: AthleteReviewComputed;
  diagnosis: AthleteReviewDiagnosis;
  meta: {
    model: string;
    promptVersion: string;
    /** The dataset and score version the review was computed against. */
    datasetVersionId: string;
    scoreVersion: string;
  };
};
