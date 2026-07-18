// Shared types for the Strendex Athlete Review feature.
// Pure types only — no I/O, safe to import from client and server.

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
    unitSystem: UnitSystem;
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

export type AthleteReviewResponse = {
  report: AthleteReviewReport;
  scenarios: Scenario[];
  computed: AthleteReviewComputed;
  meta: { model: string; promptVersion: string };
};
