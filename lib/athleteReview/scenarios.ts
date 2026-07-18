// Deterministic "what-if" score scenarios for the Athlete Review.
// All math builds on lib/scoring.ts — the AI never produces these numbers.
// Projected inputs are clamped to the same validity caps as /api/submit so a
// simulated athlete is always a legal athlete.

import {
  clamp,
  computeScore,
  strengthScoreFromRatio,
  type ScoringDataset,
  type ScoringInput,
  type ScoringResult,
} from "@/lib/scoring";
import type { GoalOption, PriorityLift, Scenario, ScenarioId } from "./types";

const HORIZON_WEEKS = 8;
const MIN_ENDURANCE_SEC = 4200;

const LIFT_CAPS = {
  bench: { abs: 318, ratio: 3.2 },
  squat: { abs: 409, ratio: 4.0 },
  deadlift: { abs: 454, ratio: 4.5 },
} as const;

type LiftKey = "bench" | "squat" | "deadlift";

function capLift(kind: LiftKey, valueKg: number, bodyweightKg: number): number {
  const cap = LIFT_CAPS[kind];
  return Math.min(valueKg, cap.abs, cap.ratio * bodyweightKg);
}

function bumpLift(
  kind: LiftKey,
  currentKg: number | null,
  pct: number,
  bodyweightKg: number,
): number | null {
  if (currentKg === null) return null;
  const raised = currentKg * (1 + pct / 100);
  return Number(capLift(kind, raised, bodyweightKg).toFixed(1));
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// Pick the entered lift with the weakest ratio-derived sub-index, using the same
// thresholds computeStrengthIndex uses.
function weakestLift(input: ScoringInput): LiftKey | null {
  const bw = input.bodyweightKg;
  const candidates: { key: LiftKey; idx: number }[] = [];
  if (input.benchKg !== null) {
    candidates.push({
      key: "bench",
      idx: strengthScoreFromRatio(input.benchKg / bw, 0.75, 1.25, 1.75),
    });
  }
  if (input.squatKg !== null) {
    candidates.push({
      key: "squat",
      idx: strengthScoreFromRatio(input.squatKg / bw, 1.0, 1.75, 2.5),
    });
  }
  if (input.deadliftKg !== null) {
    candidates.push({
      key: "deadlift",
      idx: strengthScoreFromRatio(input.deadliftKg / bw, 1.25, 2.25, 3.0),
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.idx - b.idx);
  return candidates[0].key;
}

function project(
  base: Scenario,
  modified: ScoringInput,
  dataset: ScoringDataset,
  current: ScoringResult,
): Scenario {
  const scored = computeScore(modified, dataset);
  return {
    ...base,
    projected: {
      hq: scored.hq,
      tier: scored.tier,
      strengthPercentile: scored.strengthPercentile,
      endurancePercentile: scored.endurancePercentile,
      hqDelta: scored.hq - current.hq,
    },
  };
}

export function computeScenarios(args: {
  input: ScoringInput;
  dataset: ScoringDataset;
  current: ScoringResult;
  primaryGoal: GoalOption;
  priorityLift?: PriorityLift;
}): Scenario[] {
  const { input, dataset, current, primaryGoal, priorityLift } = args;
  const hasEndurance = input.enduranceSeconds !== null;
  const hasLift =
    input.benchKg !== null || input.squatKg !== null || input.deadliftKg !== null;

  // --- Endurance push: ~4% faster (clamped 2:00–8:00 off), lifts held ---
  let endurancePush: Scenario = {
    id: "endurance_push",
    title: `${HORIZON_WEEKS}-week endurance push`,
    description: "Add an endurance time to unlock this scenario.",
    horizonWeeks: HORIZON_WEEKS,
    available: hasEndurance,
    changes: {
      enduranceSecondsDelta: null,
      benchPct: 0,
      squatPct: 0,
      deadliftPct: 0,
    },
    projected: null,
    isPrimary: false,
  };
  if (input.enduranceSeconds !== null) {
    const cut = clamp(Math.round(input.enduranceSeconds * 0.04), 120, 480);
    const newSeconds = Math.max(MIN_ENDURANCE_SEC, input.enduranceSeconds - cut);
    const actualCut = input.enduranceSeconds - newSeconds;
    endurancePush = project(
      {
        ...endurancePush,
        description: `Bring your endurance benchmark down by about ${formatSeconds(actualCut)} while holding your current lifts.`,
        changes: {
          enduranceSecondsDelta: -actualCut,
          benchPct: 0,
          squatPct: 0,
          deadliftPct: 0,
        },
      },
      { ...input, enduranceSeconds: newSeconds },
      dataset,
      current,
    );
  }

  // --- Strength push: priority lift +7.5%, other entered lifts +2.5% ---
  let strengthPush: Scenario = {
    id: "strength_push",
    title: `${HORIZON_WEEKS}-week strength push`,
    description: "Add at least one lift to unlock this scenario.",
    horizonWeeks: HORIZON_WEEKS,
    available: hasLift,
    changes: {
      enduranceSecondsDelta: null,
      benchPct: 0,
      squatPct: 0,
      deadliftPct: 0,
    },
    projected: null,
    isPrimary: false,
  };
  if (hasLift) {
    const spreadAll = priorityLift === "overall";
    const focus: LiftKey | null = spreadAll
      ? null
      : priorityLift && input[`${priorityLift}Kg`] !== null
        ? priorityLift
        : weakestLift(input);

    const pctFor = (key: LiftKey): number => {
      if (input[`${key}Kg`] === null) return 0;
      if (spreadAll) return 5;
      return key === focus ? 7.5 : 2.5;
    };

    const bench = pctFor("bench");
    const squat = pctFor("squat");
    const dead = pctFor("deadlift");

    const focusLabel = spreadAll
      ? "all entered lifts by ~5%"
      : `your ${focus} by ~7.5% and other lifts by ~2.5%`;

    strengthPush = project(
      {
        ...strengthPush,
        description: `Raise ${focusLabel} while holding your endurance where it is.`,
        changes: {
          enduranceSecondsDelta: null,
          benchPct: bench,
          squatPct: squat,
          deadliftPct: dead,
        },
      },
      {
        ...input,
        benchKg: bumpLift("bench", input.benchKg, bench, input.bodyweightKg),
        squatKg: bumpLift("squat", input.squatKg, squat, input.bodyweightKg),
        deadliftKg: bumpLift(
          "deadlift",
          input.deadliftKg,
          dead,
          input.bodyweightKg,
        ),
      },
      dataset,
      current,
    );
  }

  // --- Balanced: endurance −2% (min 1:00) and entered lifts +3% ---
  let balanced: Scenario = {
    id: "balanced",
    title: `${HORIZON_WEEKS}-week balanced build`,
    description:
      "Add both an endurance time and at least one lift to unlock this scenario.",
    horizonWeeks: HORIZON_WEEKS,
    available: hasEndurance && hasLift,
    changes: {
      enduranceSecondsDelta: null,
      benchPct: 0,
      squatPct: 0,
      deadliftPct: 0,
    },
    projected: null,
    isPrimary: false,
  };
  if (input.enduranceSeconds !== null && hasLift) {
    const cut = Math.max(60, Math.round(input.enduranceSeconds * 0.02));
    const newSeconds = Math.max(MIN_ENDURANCE_SEC, input.enduranceSeconds - cut);
    const actualCut = input.enduranceSeconds - newSeconds;
    balanced = project(
      {
        ...balanced,
        description: `Take about ${formatSeconds(actualCut)} off your endurance benchmark and add ~3% to your lifts at the same time.`,
        changes: {
          enduranceSecondsDelta: -actualCut,
          benchPct: input.benchKg !== null ? 3 : 0,
          squatPct: input.squatKg !== null ? 3 : 0,
          deadliftPct: input.deadliftKg !== null ? 3 : 0,
        },
      },
      {
        ...input,
        enduranceSeconds: newSeconds,
        benchKg: bumpLift("bench", input.benchKg, 3, input.bodyweightKg),
        squatKg: bumpLift("squat", input.squatKg, 3, input.bodyweightKg),
        deadliftKg: bumpLift("deadlift", input.deadliftKg, 3, input.bodyweightKg),
      },
      dataset,
      current,
    );
  }

  // --- Primary selection: goal override first, then percentile gap ---
  const gap = current.strengthPercentile - current.endurancePercentile;
  let primaryId: ScenarioId;
  if (primaryGoal === "strength") primaryId = "strength_push";
  else if (primaryGoal === "endurance" || primaryGoal === "race_prep")
    primaryId = "endurance_push";
  else if (gap >= 15) primaryId = "endurance_push";
  else if (gap <= -15) primaryId = "strength_push";
  else primaryId = "balanced";

  const ordered = [endurancePush, strengthPush, balanced];
  const chosen =
    ordered.find((s) => s.id === primaryId && s.available) ??
    ordered.find((s) => s.available);
  if (chosen) chosen.isPrimary = true;

  // Primary first, remaining in stable order.
  return ordered.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}
