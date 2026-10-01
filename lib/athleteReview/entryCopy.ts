// Copy for the Athlete Review entry points: the invitation on the results page,
// the intro once a result has carried over, and the landing for direct visitors.
// Pure module — no I/O — so the copy decisions can be unit tested.

import type { ResultSnapshotV1 } from "./types";

export type TensionVariant = "gap" | "balanced" | "incomplete";

export type TensionInput = {
  strengthPercentile: number | null;
  endurancePercentile: number | null;
  /** The archetype the engine assigned to this saved result. */
  archetype: string;
  inputs: Pick<
    ResultSnapshotV1["inputs"],
    "benchKg" | "squatKg" | "deadliftKg" | "enduranceSeconds"
  >;
};

/**
 * The question the athlete cannot answer from the basic result alone, built
 * from their own percentiles. "Balanced" follows the archetype the engine
 * assigned, so this line never contradicts the athlete type shown beside it.
 */
export function ctaTension(p: TensionInput): {
  variant: TensionVariant;
  copy: string;
} {
  const { strengthPercentile: sp, endurancePercentile: ep, inputs } = p;
  const missingLifts = [inputs.benchKg, inputs.squatKg, inputs.deadliftKg].filter(
    (v) => v === null,
  ).length;

  if (inputs.enduranceSeconds === null || missingLifts >= 2 || sp === null || ep === null) {
    return {
      variant: "incomplete",
      copy: "Part of your performance picture is still unresolved. Athlete Review shows what is most useful to test or improve next.",
    };
  }

  const gap = Math.round(Math.abs(sp - ep));
  if (p.archetype !== "BALANCED HYBRID" && gap >= 1) {
    const [trailing, leading] = ep < sp ? ["endurance", "strength"] : ["strength", "endurance"];
    return {
      variant: "gap",
      copy: `Your ${trailing} trails your ${leading} by ${gap} percentile point${gap === 1 ? "" : "s"}. Athlete Review shows which realistic change is most likely to move your score.`,
    };
  }

  return {
    variant: "balanced",
    copy: "Your two sides are close. That makes the next move less obvious — Athlete Review compares the smaller levers to show where your next points are most likely to come from.",
  };
}

export type ReviewRow = { title: string; detail: string; primary?: boolean };

/** Results-page invitation: what the review gives back. */
export const CTA_PREVIEW_ROWS: readonly ReviewRow[] = [
  {
    title: "What’s holding your score back",
    detail: "See which part of your profile is costing you the most.",
  },
  {
    title: "The change most likely to raise it",
    detail: "Compare realistic improvement scenarios against your score.",
  },
  {
    title: "Your next training focus",
    detail: "Turn the result into a practical direction for your next block.",
  },
];

/** Intro and landing: what the finished review answers. */
export const REVIEW_ANSWERS: readonly ReviewRow[] = [
  {
    title: "What’s holding your score back",
    detail: "The parts of your profile costing you the most points.",
  },
  {
    title: "The one change most likely to raise it",
    detail: "Chosen for your goals, training and recovery.",
    primary: true,
  },
  {
    title: "Estimated score scenarios",
    detail: "Realistic improvements, scored by the same Strendex engine.",
  },
  {
    title: "What you should keep doing",
    detail: "The habits already carrying your profile.",
  },
  {
    title: "Your next training focus",
    detail: "A practical direction for your next block.",
  },
];
