// Athlete-facing performance targets for the Athlete Review. Pure module — no I/O.
//
// Scenarios are scored on internal values: kilograms, and a canonical
// (half-marathon-equivalent) run time. Athletes train their own distance in
// their own units, so this translates a scenario's EXACT projected inputs —
// the ones computeScore was given — back into the athlete's run distance and
// unit system. Display only: nothing here feeds a score.

import {
  CANONICAL_RUN_DISTANCE,
  RIEGEL_EXPONENT,
  distanceMetres,
  kilogramsToPounds,
  type RunDistance,
  type UnitSystem,
} from "@/lib/scoring/core";
import type { Scenario } from "./types";

export type LiftId = "bench" | "squat" | "deadlift";

export const RUN_DISTANCE_LABEL: Record<RunDistance, string> = {
  "3mi": "3 mi",
  "5k": "5K",
  "10k": "10K",
  half: "Half marathon",
  marathon: "Marathon",
};

const LIFT_LABEL: Record<LiftId, string> = { bench: "Bench", squat: "Squat", deadlift: "Deadlift" };

/** The athlete's own benchmark: original run distance and time, lifts in kg. */
export type AthleteBenchmark = {
  unitSystem: UnitSystem;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  run: { distance: RunDistance; seconds: number } | null;
};

export type CurrentBenchmark = {
  unit: UnitSystem;
  run: { distance: RunDistance; label: string; time: string } | null;
  lifts: { lift: LiftId; label: string; value: number }[];
};

export type ScenarioTargets = {
  /** null target: the run is held. `fasterBySeconds` is the change at the athlete's distance. */
  run: {
    distance: RunDistance;
    label: string;
    current: string;
    target: string | null;
    fasterBySeconds: number | null;
  } | null;
  /** Entered lifts only. null target: the lift is held. */
  lifts: { lift: LiftId; label: string; current: number; target: number | null }[];
  unit: UnitSystem;
};

/**
 * Inverse of toCanonicalEnduranceSeconds: the time at `distance` that converts
 * to `canonicalSeconds`. Same constants, same Riegel model, rounded to whole
 * seconds like the forward conversion.
 */
export function fromCanonicalEnduranceSeconds(canonicalSeconds: number, distance: RunDistance): number {
  const ratio = distanceMetres(CANONICAL_RUN_DISTANCE) / distanceMetres(distance);
  return Math.round(canonicalSeconds / Math.pow(ratio, RIEGEL_EXPONENT));
}

export function formatRunTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const half = (n: number) => Math.round(n * 2) / 2;

/** A lift as the athlete entered it: their unit, to the nearest half unit. */
function displayCurrent(kg: number, unit: UnitSystem): number {
  return half(unit === "lb" ? kilogramsToPounds(kg) : kg);
}

/** A projected lift: whole pounds, or the nearest half kilogram. */
function displayTarget(kg: number, unit: UnitSystem): number {
  return unit === "lb" ? Math.round(kilogramsToPounds(kg)) : half(kg);
}

function liftsOf(b: AthleteBenchmark): { lift: LiftId; kg: number }[] {
  const out: { lift: LiftId; kg: number }[] = [];
  if (b.benchKg !== null) out.push({ lift: "bench", kg: b.benchKg });
  if (b.squatKg !== null) out.push({ lift: "squat", kg: b.squatKg });
  if (b.deadliftKg !== null) out.push({ lift: "deadlift", kg: b.deadliftKg });
  return out;
}

export function currentBenchmark(b: AthleteBenchmark): CurrentBenchmark {
  return {
    unit: b.unitSystem,
    run: b.run
      ? { distance: b.run.distance, label: RUN_DISTANCE_LABEL[b.run.distance], time: formatRunTime(b.run.seconds) }
      : null,
    lifts: liftsOf(b).map(({ lift, kg }) => ({
      lift,
      label: LIFT_LABEL[lift],
      value: displayCurrent(kg, b.unitSystem),
    })),
  };
}

/** A projected scenario in the athlete's own numbers, or null when it has no projection. */
export function scenarioTargets(scenario: Scenario, b: AthleteBenchmark): ScenarioTargets | null {
  const projected = scenario.projected;
  if (!scenario.available || !projected) return null;

  let run: ScenarioTargets["run"] = null;
  if (b.run) {
    const projectedCanonical = projected.inputs.enduranceSeconds;
    const changed =
      projectedCanonical !== null && scenario.changes.enduranceSecondsDelta !== null;
    const targetSeconds = changed ? fromCanonicalEnduranceSeconds(projectedCanonical, b.run.distance) : null;
    // A cut too small to survive rounding at a short distance is still shown
    // as faster, never as an unchanged or slower time.
    const faster = targetSeconds !== null && targetSeconds < b.run.seconds;
    run = {
      distance: b.run.distance,
      label: RUN_DISTANCE_LABEL[b.run.distance],
      current: formatRunTime(b.run.seconds),
      target: faster ? formatRunTime(targetSeconds) : null,
      fasterBySeconds: faster ? b.run.seconds - targetSeconds : changed ? 0 : null,
    };
  }

  const lifts = liftsOf(b).map(({ lift, kg }) => {
    const projectedKg = projected.inputs[`${lift}Kg`];
    const moved = projectedKg !== null && projectedKg !== kg;
    return {
      lift,
      label: LIFT_LABEL[lift],
      current: displayCurrent(kg, b.unitSystem),
      target: moved ? displayTarget(projectedKg, b.unitSystem) : null,
    };
  });

  return { run, lifts, unit: b.unitSystem };
}

/** The athlete's run as it reads mid-sentence: "Your current 5K …". */
const RUN_IN_SENTENCE: Record<RunDistance, string> = {
  "3mi": "3 mi time",
  "5k": "5K",
  "10k": "10K",
  half: "half marathon",
  marathon: "marathon",
};

/**
 * Why a scenario can't be projected, in the athlete's terms. The cap case is
 * worded from the distance they entered — never an index or an internal time.
 */
export function unavailableScenarioCopy(
  scenario: Pick<Scenario, "description" | "unavailableReason">,
  run: RunDistance | null,
): string {
  if (scenario.unavailableReason === "endurance_at_cap") {
    const subject = run ? `Your current ${RUN_IN_SENTENCE[run]}` : "Your current run time";
    return `${subject} is already at the top of Strendex’s endurance scale, so a faster time would not raise your Hybrid Score.`;
  }
  return scenario.description;
}

/** The same targets as plain lines, for the model's DATA block. */
export function describeTargets(t: ScenarioTargets): string[] {
  const lines: string[] = [];
  if (t.run) {
    lines.push(
      t.run.target
        ? `${t.run.label}: ${t.run.current} → ~${t.run.target}`
        : t.run.fasterBySeconds === 0
          ? `${t.run.label}: a few seconds faster than ${t.run.current}`
          : `${t.run.label}: hold around ${t.run.current}`,
    );
  }
  const held = t.lifts.filter((l) => l.target === null);
  for (const l of t.lifts) {
    if (l.target !== null) lines.push(`${l.label}: ${l.current} ${t.unit} → ~${l.target} ${t.unit}`);
  }
  if (held.length > 0 && held.length === t.lifts.length) {
    lines.push(`Lifts: hold current performance (${held.map((l) => `${l.label} ${l.current} ${t.unit}`).join(", ")})`);
  } else {
    for (const l of held) lines.push(`${l.label}: hold around ${l.current} ${t.unit}`);
  }
  return lines;
}
