// Single source of truth for the Athlete Review assessment.
// Consumed by the wizard renderer (client) and validateAnswers (server).
// Pure module — no I/O.

import type { AssessmentAnswers, GoalOption, UnitSystem } from "./types";

export type QuestionKind = "options" | "count" | "number" | "shorttext" | "freetext";

export type QuestionOption = {
  value: string;
  label: string;
  labelImperial?: string; // shown instead of label when the athlete uses lb/mi
};

export type QuestionDef = {
  id: keyof AssessmentAnswers;
  step: 1 | 2 | 3 | 4 | 5;
  kind: QuestionKind;
  label: string;
  helper?: string;
  required: boolean; // required when visible
  options?: QuestionOption[];
  min?: number; // count / number kinds
  max?: number;
  maxLength?: number; // shorttext / freetext kinds
  placeholder?: string;
  showIf?: (answers: Partial<AssessmentAnswers>) => boolean;
  // For questions whose choices depend on earlier answers (secondary goal).
  excludeValue?: (answers: Partial<AssessmentAnswers>) => string | null;
};

export const GOAL_OPTIONS: QuestionOption[] = [
  { value: "raise_score", label: "Raise my Hybrid Score" },
  { value: "balance", label: "Become more balanced" },
  { value: "strength", label: "Improve strength" },
  { value: "endurance", label: "Improve endurance" },
  { value: "race_prep", label: "Prepare for a race or event" },
  { value: "muscle_endurance", label: "Build muscle while maintaining endurance" },
  { value: "fat_loss", label: "Lose body fat while preserving performance" },
  { value: "athleticism", label: "Improve general athleticism" },
];

const isEnduranceGoal = (a: Partial<AssessmentAnswers>) =>
  a.primaryGoal === "endurance" || a.primaryGoal === "race_prep";

export const QUESTIONS: QuestionDef[] = [
  // ---- Step 1 · Athlete context ----
  {
    id: "ageRange",
    step: 1,
    kind: "options",
    label: "Age range",
    required: true,
    options: [
      { value: "u18", label: "Under 18" },
      { value: "18_24", label: "18–24" },
      { value: "25_34", label: "25–34" },
      { value: "35_44", label: "35–44" },
      { value: "45_54", label: "45–54" },
      { value: "55p", label: "55+" },
    ],
  },
  {
    id: "trainingYears",
    step: 1,
    kind: "options",
    label: "Years of consistent training",
    required: true,
    options: [
      { value: "u1", label: "Under 1 year" },
      { value: "1_2", label: "1–2 years" },
      { value: "3_5", label: "3–5 years" },
      { value: "6_9", label: "6–9 years" },
      { value: "10p", label: "10+ years" },
    ],
  },
  {
    id: "background",
    step: 1,
    kind: "options",
    label: "Primary athletic background",
    required: true,
    options: [
      { value: "strength", label: "Strength training" },
      { value: "running", label: "Running" },
      { value: "hybrid", label: "Hybrid training" },
      { value: "crossfit", label: "CrossFit or functional fitness" },
      { value: "team", label: "Team sports" },
      { value: "general", label: "General fitness" },
      { value: "returning", label: "Returning after a break" },
      { value: "other", label: "Other" },
    ],
  },

  // ---- Step 2 · Current training ----
  {
    id: "strengthSessions",
    step: 2,
    kind: "count",
    label: "Strength sessions per week",
    required: true,
    min: 0,
    max: 7,
  },
  {
    id: "enduranceSessions",
    step: 2,
    kind: "count",
    label: "Running or endurance sessions per week",
    required: true,
    min: 0,
    max: 7,
  },
  {
    id: "weeklyRunVolume",
    step: 2,
    kind: "options",
    label: "Average weekly running distance",
    required: true,
    options: [
      { value: "none", label: "None" },
      { value: "u10", label: "Under 10 km", labelImperial: "Under 6 mi" },
      { value: "10_20", label: "10–20 km", labelImperial: "6–12 mi" },
      { value: "21_35", label: "21–35 km", labelImperial: "13–22 mi" },
      { value: "36_50", label: "36–50 km", labelImperial: "23–31 mi" },
      { value: "50p", label: "Over 50 km", labelImperial: "Over 31 mi" },
    ],
  },
  {
    id: "sessionDuration",
    step: 2,
    kind: "options",
    label: "Typical session duration",
    required: true,
    options: [
      { value: "u30", label: "Under 30 minutes" },
      { value: "30_45", label: "30–45 minutes" },
      { value: "46_60", label: "46–60 minutes" },
      { value: "61_90", label: "61–90 minutes" },
      { value: "90p", label: "Over 90 minutes" },
    ],
  },
  {
    id: "programming",
    step: 2,
    kind: "options",
    label: "Current programming structure",
    required: true,
    options: [
      { value: "structured", label: "Following a structured program" },
      { value: "self_planned", label: "Self-programmed with a clear plan" },
      { value: "coached", label: "Coached" },
      { value: "no_plan", label: "Training without a consistent plan" },
      { value: "rebuilding", label: "Returning or rebuilding" },
    ],
  },
  {
    id: "consistency",
    step: 2,
    kind: "options",
    label: "Consistency over the last eight weeks",
    required: true,
    options: [
      { value: "very", label: "Very consistent" },
      { value: "mostly", label: "Mostly consistent" },
      { value: "inconsistent", label: "Inconsistent" },
      { value: "returning", label: "Recently returning" },
      { value: "unable", label: "Unable to train consistently" },
    ],
  },

  // ---- Step 3 · Goals ----
  {
    id: "primaryGoal",
    step: 3,
    kind: "options",
    label: "Primary goal",
    required: true,
    options: GOAL_OPTIONS,
  },
  {
    id: "secondaryGoal",
    step: 3,
    kind: "options",
    label: "Secondary goal",
    helper: "Optional",
    required: false,
    options: GOAL_OPTIONS,
    excludeValue: (a) => a.primaryGoal ?? null,
  },
  {
    id: "timeline",
    step: 3,
    kind: "options",
    label: "Target timeline",
    required: true,
    options: [
      { value: "4_6w", label: "4–6 weeks" },
      { value: "8_12w", label: "8–12 weeks" },
      { value: "3_6m", label: "3–6 months" },
      { value: "6_12m", label: "6–12 months" },
      { value: "none", label: "No fixed deadline" },
    ],
  },
  {
    id: "targetHybridScore",
    step: 3,
    kind: "number",
    label: "Target Hybrid Score",
    helper: "Optional",
    required: false,
    min: 1,
    max: 100,
    placeholder: "e.g. 75",
    showIf: (a) => a.primaryGoal === "raise_score",
  },
  {
    id: "priorityLift",
    step: 3,
    kind: "options",
    label: "Priority lift",
    required: true,
    options: [
      { value: "bench", label: "Bench" },
      { value: "squat", label: "Squat" },
      { value: "deadlift", label: "Deadlift" },
      { value: "overall", label: "Overall strength" },
    ],
    showIf: (a) => a.primaryGoal === "strength",
  },
  {
    id: "targetLiftValue",
    step: 3,
    kind: "number",
    label: "Target lift",
    helper: "Optional — in your working units",
    required: false,
    min: 20,
    max: 1000,
    placeholder: "e.g. 225",
    showIf: (a) => a.primaryGoal === "strength",
  },
  {
    id: "targetEvent",
    step: 3,
    kind: "options",
    label: "Target distance or event",
    required: true,
    options: [
      { value: "5k", label: "5K" },
      { value: "10k", label: "10K" },
      { value: "half", label: "Half marathon" },
      { value: "marathon", label: "Marathon" },
      { value: "hyrox", label: "Hyrox or similar hybrid event" },
      { value: "general", label: "General endurance" },
    ],
    showIf: isEnduranceGoal,
  },
  {
    id: "targetTime",
    step: 3,
    kind: "shorttext",
    label: "Target time",
    helper: "Optional — e.g. 22:30",
    required: false,
    maxLength: 12,
    placeholder: "mm:ss",
    showIf: isEnduranceGoal,
  },

  // ---- Step 4 · Recovery and constraints ----
  {
    id: "daysAvailable",
    step: 4,
    kind: "count",
    label: "Days available to train per week",
    required: true,
    min: 1,
    max: 7,
  },
  {
    id: "sleepHours",
    step: 4,
    kind: "options",
    label: "Average sleep per night",
    required: true,
    options: [
      { value: "u5", label: "Under 5 hours" },
      { value: "5_6", label: "5–6 hours" },
      { value: "6_7", label: "6–7 hours" },
      { value: "7_8", label: "7–8 hours" },
      { value: "8_9", label: "8–9 hours" },
      { value: "9p", label: "9+ hours" },
    ],
  },
  {
    id: "sleepQuality",
    step: 4,
    kind: "options",
    label: "Sleep quality",
    required: true,
    options: [
      { value: "poor", label: "Poor" },
      { value: "inconsistent", label: "Inconsistent" },
      { value: "fair", label: "Fair" },
      { value: "good", label: "Good" },
      { value: "excellent", label: "Excellent" },
    ],
  },
  {
    id: "stress",
    step: 4,
    kind: "options",
    label: "Current life stress",
    required: true,
    options: [
      { value: "very_low", label: "Very low" },
      { value: "low", label: "Low" },
      { value: "moderate", label: "Moderate" },
      { value: "high", label: "High" },
      { value: "very_high", label: "Very high" },
    ],
  },
  {
    id: "recovery",
    step: 4,
    kind: "options",
    label: "Current recovery",
    required: true,
    options: [
      { value: "poor", label: "Poor" },
      { value: "below_avg", label: "Below average" },
      { value: "average", label: "Average" },
      { value: "good", label: "Good" },
      { value: "excellent", label: "Excellent" },
    ],
  },
  {
    id: "mainConstraint",
    step: 4,
    kind: "options",
    label: "Main constraint",
    required: true,
    options: [
      { value: "time", label: "Time" },
      { value: "recovery", label: "Recovery" },
      { value: "motivation", label: "Motivation" },
      { value: "injury", label: "Injury or movement limitation" },
      { value: "programming", label: "Programming knowledge" },
      { value: "nutrition", label: "Nutrition consistency" },
      { value: "equipment", label: "Gym or equipment access" },
      { value: "priorities", label: "Competing priorities" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  {
    id: "injuryNote",
    step: 4,
    kind: "freetext",
    label: "Briefly describe how it affects your training",
    helper:
      "Optional. Do not include private medical details — this only makes guidance more conservative.",
    required: false,
    maxLength: 400,
    showIf: (a) => a.mainConstraint === "injury",
  },

  // ---- Step 5 · Final context ----
  {
    id: "holdingBack",
    step: 5,
    kind: "freetext",
    label: "What do you feel is currently holding you back?",
    helper: "Optional",
    required: false,
    maxLength: 500,
  },
];

export const STEP_META: Record<
  1 | 2 | 3 | 4 | 5,
  { kicker: string; title: string; sub: string }
> = {
  1: {
    kicker: "STEP 1 · CONTEXT",
    title: "About you as an athlete",
    sub: "Training age and background change what a realistic next block looks like.",
  },
  2: {
    kicker: "STEP 2 · TRAINING",
    title: "How you train right now",
    sub: "Your current volume and structure show where the easiest gains are hiding.",
  },
  3: {
    kicker: "STEP 3 · GOALS",
    title: "What you're working toward",
    sub: "Your goal decides which lever matters most for your Hybrid Score.",
  },
  4: {
    kicker: "STEP 4 · RECOVERY",
    title: "Recovery and constraints",
    sub: "Recovery capacity sets how much new training you can actually absorb.",
  },
  5: {
    kicker: "STEP 5 · REVIEW",
    title: "Final context",
    sub: "Anything else that should shape your review, then confirm your inputs.",
  },
};

export function visibleQuestions(
  step: 1 | 2 | 3 | 4 | 5,
  answers: Partial<AssessmentAnswers>,
): QuestionDef[] {
  return QUESTIONS.filter(
    (q) => q.step === step && (!q.showIf || q.showIf(answers)),
  );
}

export function isStepComplete(
  step: 1 | 2 | 3 | 4 | 5,
  answers: Partial<AssessmentAnswers>,
): boolean {
  return visibleQuestions(step, answers).every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    if (q.kind === "count" || q.kind === "number") {
      return typeof v === "number" && Number.isFinite(v);
    }
    return typeof v === "string" && v.length > 0;
  });
}

export function optionLabel(
  q: QuestionDef,
  value: unknown,
  unitSystem: UnitSystem = "lb",
): string {
  const opt = q.options?.find((o) => o.value === value);
  if (!opt) return String(value ?? "—");
  return unitSystem === "lb" && opt.labelImperial ? opt.labelImperial : opt.label;
}

// ---- Server-side validation ----

function sanitizeFreeText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

export function validateAnswers(
  raw: unknown,
):
  | { ok: true; answers: AssessmentAnswers }
  | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Assessment answers must be an object." };
  }
  const obj = raw as Record<string, unknown>;

  const knownIds = new Set<string>(QUESTIONS.map((q) => q.id));
  for (const key of Object.keys(obj)) {
    if (!knownIds.has(key)) {
      return { ok: false, error: "Assessment contains unexpected fields." };
    }
  }

  const out: Record<string, unknown> = {};
  // Validate iteratively so showIf conditions can read already-validated answers.
  for (const q of QUESTIONS) {
    const visible = !q.showIf || q.showIf(out as Partial<AssessmentAnswers>);
    const value = obj[q.id];

    if (!visible) {
      if (value !== undefined) {
        return { ok: false, error: `Unexpected answer for "${q.id}".` };
      }
      continue;
    }

    if (value === undefined || value === null || value === "") {
      if (q.required) {
        return { ok: false, error: `Missing answer for "${q.id}".` };
      }
      continue;
    }

    if (q.kind === "options") {
      if (
        typeof value !== "string" ||
        !q.options?.some((o) => o.value === value)
      ) {
        return { ok: false, error: `Invalid answer for "${q.id}".` };
      }
      const excluded = q.excludeValue?.(out as Partial<AssessmentAnswers>);
      if (excluded && value === excluded) {
        return { ok: false, error: `"${q.id}" must differ from the primary goal.` };
      }
      out[q.id] = value;
    } else if (q.kind === "count" || q.kind === "number") {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        (q.min !== undefined && n < q.min) ||
        (q.max !== undefined && n > q.max)
      ) {
        return { ok: false, error: `Invalid answer for "${q.id}".` };
      }
      out[q.id] = q.kind === "count" ? Math.round(n) : n;
    } else {
      // shorttext / freetext
      const cleaned = sanitizeFreeText(value, q.maxLength ?? 500);
      if (typeof value === "string" && value.length > (q.maxLength ?? 500) * 2) {
        return { ok: false, error: `Answer for "${q.id}" is too long.` };
      }
      if (cleaned !== null) out[q.id] = cleaned;
    }
  }

  return { ok: true, answers: out as AssessmentAnswers };
}

export function goalLabel(goal: GoalOption): string {
  return GOAL_OPTIONS.find((o) => o.value === goal)?.label ?? goal;
}
