// JSON schema for the OpenAI structured output plus a defensive server-side
// validator. OpenAI strict mode is the primary shape guarantee; validateReport
// is defense-in-depth (hard-fails on missing keys / wrong types / wrong arity,
// soft-truncates over-long strings).

import type { AthleteReviewReport, ReportLimiter } from "./types";

export const REPORT_PROMPT_VERSION = "ar-v3";

// Canonical legal copy — always overwrites whatever the model wrote.
export const CANONICAL_DISCLAIMER =
  "Strendex Athlete Review provides informational training guidance and is not medical advice. Performance comparisons use the current Strendex reference baseline; see the methodology for details.";

const str = { type: "string" } as const;
const int = { type: "integer" } as const;

export const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "athleteSummary",
    "profileInterpretation",
    "strengths",
    "limiters",
    "highestLeverageMove",
    "priorities",
    "focusPlan",
    "retest",
    "confidenceNote",
    "disclaimer",
  ],
  properties: {
    headline: str,
    athleteSummary: str,
    profileInterpretation: str,
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "explanation", "evidence"],
        properties: { title: str, explanation: str, evidence: str },
      },
    },
    limiters: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "impact", "explanation", "evidence"],
        properties: {
          title: str,
          impact: { type: "string", enum: ["high", "medium", "low"] },
          explanation: str,
          evidence: str,
        },
      },
    },
    highestLeverageMove: {
      type: "object",
      additionalProperties: false,
      required: ["title", "why", "whatToDo", "whatToMaintain", "deprioritize"],
      properties: { title: str, why: str, whatToDo: str, whatToMaintain: str, deprioritize: str },
    },
    priorities: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "action", "reason"],
        properties: { priority: int, action: str, reason: str },
      },
    },
    focusPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "durationWeeks",
        "strengthFocus",
        "enduranceFocus",
        "recoveryFocus",
        "weeklyStructure",
      ],
      properties: {
        durationWeeks: int,
        strengthFocus: str,
        enduranceFocus: str,
        recoveryFocus: str,
        // One line per TRAINING day. The upper bound is the athlete's own
        // daysAvailable, enforced in validateReport.
        weeklyStructure: {
          type: "array",
          minItems: 1,
          maxItems: 7,
          items: str,
        },
      },
    },
    retest: {
      type: "object",
      additionalProperties: false,
      required: ["recommendedWeeks", "metricsToRetest", "successSignal"],
      properties: {
        recommendedWeeks: int,
        metricsToRetest: { type: "array", minItems: 1, maxItems: 5, items: str },
        successSignal: str,
      },
    },
    confidenceNote: str,
    disclaimer: str,
  },
} as const;

// ---- Defensive validation ----

const MAX = {
  headline: 140,
  athleteSummary: 700,
  profileInterpretation: 1000,
  title: 100,
  explanation: 500,
  evidence: 260,
  why: 500,
  whatToDo: 600,
  whatToMaintain: 400,
  deprioritize: 400,
  action: 260,
  reason: 400,
  focusText: 500,
  weeklyLine: 200,
  metric: 100,
  successSignal: 400,
  confidenceNote: 500,
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function takeString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function takeInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n < min || n > max ? null : n;
}

/**
 * A weekly-structure line that is only a rest day ("Day 7: Rest", "Sunday —
 * rest and mobility"). Rest is implied on the days without a line, so these are
 * dropped rather than counted as training days.
 */
export function isRestLine(line: string): boolean {
  return /^\s*(?:(?:day\s*\d+|mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*[:—–-]\s*)?(?:full\s+|complete\s+|active\s+|total\s+)?(?:rest|off)(?![\w-])/i.test(
    line,
  );
}

/**
 * Internal scoring vocabulary the athlete never entered and has no use for.
 * The model is told not to use it; a report that does anyway is unusable.
 */
export const INTERNAL_TERMS: readonly RegExp[] = [
  /half[\s-]*marathon[\s-]+equivalent/i,
  /canonical[\s-]+endurance/i,
  /canonical[\s-]+time/i,
  /endurance[\s-]+index/i,
  /strength[\s-]+index/i,
];

/** The first internal term found in any string, at any depth, or null. */
export function findInternalTerm(value: unknown): string | null {
  if (typeof value === "string") {
    for (const term of INTERNAL_TERMS) {
      const match = value.match(term);
      if (match) return match[0];
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findInternalTerm(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found = findInternalTerm(item);
      if (found) return found;
    }
  }
  return null;
}

export function validateReport(
  value: unknown,
  context: { daysAvailable?: number } = {},
): { ok: true; report: AthleteReviewReport } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });

  if (!isRecord(value)) return fail("report is not an object");

  const headline = takeString(value.headline, MAX.headline);
  const athleteSummary = takeString(value.athleteSummary, MAX.athleteSummary);
  const profileInterpretation = takeString(
    value.profileInterpretation,
    MAX.profileInterpretation,
  );
  if (!headline || !athleteSummary || !profileInterpretation) {
    return fail("missing top-level text");
  }

  if (!Array.isArray(value.strengths) || value.strengths.length !== 3) {
    return fail("strengths must have exactly 3 items");
  }
  const strengths = [];
  for (const item of value.strengths) {
    if (!isRecord(item)) return fail("invalid strength item");
    const title = takeString(item.title, MAX.title);
    const explanation = takeString(item.explanation, MAX.explanation);
    const evidence = takeString(item.evidence, MAX.evidence);
    if (!title || !explanation || !evidence) return fail("invalid strength item");
    strengths.push({ title, explanation, evidence });
  }

  if (!Array.isArray(value.limiters) || value.limiters.length !== 3) {
    return fail("limiters must have exactly 3 items");
  }
  const limiters: ReportLimiter[] = [];
  for (const item of value.limiters) {
    if (!isRecord(item)) return fail("invalid limiter item");
    const title = takeString(item.title, MAX.title);
    const explanation = takeString(item.explanation, MAX.explanation);
    const evidence = takeString(item.evidence, MAX.evidence);
    const impact = item.impact;
    if (impact !== "high" && impact !== "medium" && impact !== "low") {
      return fail("invalid limiter item");
    }
    if (!title || !explanation || !evidence) {
      return fail("invalid limiter item");
    }
    limiters.push({ title, impact, explanation, evidence });
  }

  if (!isRecord(value.highestLeverageMove)) return fail("missing highestLeverageMove");
  const hlm = {
    title: takeString(value.highestLeverageMove.title, MAX.title),
    why: takeString(value.highestLeverageMove.why, MAX.why),
    whatToDo: takeString(value.highestLeverageMove.whatToDo, MAX.whatToDo),
    whatToMaintain: takeString(
      value.highestLeverageMove.whatToMaintain,
      MAX.whatToMaintain,
    ),
    deprioritize: takeString(value.highestLeverageMove.deprioritize, MAX.deprioritize),
  };
  if (!hlm.title || !hlm.why || !hlm.whatToDo || !hlm.whatToMaintain || !hlm.deprioritize) {
    return fail("invalid highestLeverageMove");
  }

  if (!Array.isArray(value.priorities) || value.priorities.length !== 3) {
    return fail("priorities must have exactly 3 items");
  }
  const priorities = [];
  for (const item of value.priorities) {
    if (!isRecord(item)) return fail("invalid priority item");
    const priority = takeInt(item.priority, 1, 3);
    const action = takeString(item.action, MAX.action);
    const reason = takeString(item.reason, MAX.reason);
    if (priority === null || !action || !reason) return fail("invalid priority item");
    priorities.push({ priority, action, reason });
  }
  priorities.sort((a, b) => a.priority - b.priority);

  if (!isRecord(value.focusPlan)) return fail("missing focusPlan");
  const durationWeeks = takeInt(value.focusPlan.durationWeeks, 4, 16);
  const strengthFocus = takeString(value.focusPlan.strengthFocus, MAX.focusText);
  const enduranceFocus = takeString(value.focusPlan.enduranceFocus, MAX.focusText);
  const recoveryFocus = takeString(value.focusPlan.recoveryFocus, MAX.focusText);
  const weeklyStructureRaw = value.focusPlan.weeklyStructure;
  if (
    durationWeeks === null ||
    !strengthFocus ||
    !enduranceFocus ||
    !recoveryFocus ||
    !Array.isArray(weeklyStructureRaw) ||
    weeklyStructureRaw.length < 1 ||
    weeklyStructureRaw.length > 7
  ) {
    return fail("invalid focusPlan");
  }
  const weeklyStructure: string[] = [];
  for (const line of weeklyStructureRaw) {
    const s = takeString(line, MAX.weeklyLine);
    if (!s) return fail("invalid focusPlan weeklyStructure");
    if (!isRestLine(s)) weeklyStructure.push(s);
  }
  // The plan never schedules more training days than the athlete has. Fewer
  // is allowed: available days are a ceiling, not a quota.
  if (weeklyStructure.length === 0) return fail("invalid focusPlan weeklyStructure");
  if (
    context.daysAvailable !== undefined &&
    weeklyStructure.length > context.daysAvailable
  ) {
    return fail("weeklyStructure exceeds days available");
  }

  if (!isRecord(value.retest)) return fail("missing retest");
  const recommendedWeeks = takeInt(value.retest.recommendedWeeks, 4, 16);
  const successSignal = takeString(value.retest.successSignal, MAX.successSignal);
  const metricsRaw = value.retest.metricsToRetest;
  if (
    recommendedWeeks === null ||
    !successSignal ||
    !Array.isArray(metricsRaw) ||
    metricsRaw.length < 1 ||
    metricsRaw.length > 5
  ) {
    return fail("invalid retest");
  }
  const metricsToRetest: string[] = [];
  for (const m of metricsRaw) {
    const s = takeString(m, MAX.metric);
    if (!s) return fail("invalid retest metric");
    metricsToRetest.push(s);
  }

  const confidenceNote = takeString(value.confidenceNote, MAX.confidenceNote);
  if (!confidenceNote) return fail("missing confidenceNote");

  const aiWritten = {
    headline,
    athleteSummary,
    profileInterpretation,
    strengths,
    limiters,
    highestLeverageMove: hlm,
    priorities,
    focusPlan: { strengthFocus, enduranceFocus, recoveryFocus, weeklyStructure },
    retest: { metricsToRetest, successSignal },
    confidenceNote,
  };
  // Fail closed: never rewrite the model's words. Only AI-written fields are
  // scanned — the disclaimer below is Strendex's own copy.
  if (findInternalTerm(aiWritten)) return fail("internal terminology in report");

  return {
    ok: true,
    report: {
      headline,
      athleteSummary,
      profileInterpretation,
      strengths,
      limiters,
      highestLeverageMove: hlm as AthleteReviewReport["highestLeverageMove"],
      priorities,
      focusPlan: {
        durationWeeks,
        strengthFocus,
        enduranceFocus,
        recoveryFocus,
        weeklyStructure,
      },
      retest: { recommendedWeeks, metricsToRetest, successSignal },
      confidenceNote,
      // Never trust the model for legal copy.
      disclaimer: CANONICAL_DISCLAIMER,
    },
  };
}
