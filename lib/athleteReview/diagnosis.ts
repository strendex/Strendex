// Deterministic performance diagnosis for the Athlete Review. Pure module — no
// I/O. Built on the server from the canonical score and the deterministic
// scenarios, returned with the review, and rendered verbatim by the report.
// The model is given these findings to explain; it never produces them.

import { TIERS, getArchetype, getTier, type Tier } from "@/lib/scoring/core";
import { currentBenchmark, scenarioTargets, type AthleteBenchmark, type ScenarioTargets } from "./targets";
import type { AthleteReviewDiagnosis, Scenario, ScenarioId } from "./types";

export type { AthleteReviewDiagnosis };

const tierIndex = (tier: string) => TIERS.indexOf(tier as Tier);

/**
 * Whether the engine treats this strength–endurance gap as balanced. The
 * athlete type alone can't say: POWER HYBRID and BASE BUILDER are level
 * categories that override the lean. Asking getArchetype about the same gap at
 * mid-range percentiles isolates its lean rule without restating its threshold.
 */
function isBalancedGap(strengthPercentile: number, endurancePercentile: number): boolean {
  const diff = strengthPercentile - endurancePercentile;
  return getArchetype(50 + diff / 2, 50 - diff / 2) === "BALANCED HYBRID";
}

/**
 * The lowest Hybrid Score in the next tier, found by asking the canonical
 * getTier rather than restating its thresholds. Hybrid Scores are whole
 * numbers, so the first integer that getTier places higher is the threshold.
 */
export function nextTierFor(score: number): AthleteReviewDiagnosis["nextTier"] {
  const current = tierIndex(getTier(score));
  if (current === TIERS.length - 1) return null;
  for (let s = Math.floor(score) + 1; s <= 100; s++) {
    const tier = getTier(s);
    if (tierIndex(tier) > current) {
      return { tier, threshold: s, pointsAway: s - score };
    }
  }
  return null;
}

export function diagnose(
  computed: {
    hq: number;
    archetype: string;
    strengthPercentile: number;
    endurancePercentile: number;
  },
  scenarios: Scenario[],
  athlete: AthleteBenchmark,
): AthleteReviewDiagnosis {
  const sp = computed.strengthPercentile;
  const ep = computed.endurancePercentile;
  const percentileGap = Number(Math.abs(sp - ep).toFixed(1));
  const tier = getTier(computed.hq);

  // Balanced exactly when the engine's own lean rule says so — which always
  // agrees with a BALANCED HYBRID athlete type, and also covers level types
  // (e.g. POWER HYBRID) whose two sides are close.
  const balanced = isBalancedGap(sp, ep);
  const leadingSide = balanced ? "balanced" : sp > ep ? "strength" : "endurance";
  const trailingSide =
    leadingSide === "balanced" ? null : leadingSide === "strength" ? "endurance" : "strength";

  // Every projected scenario in the athlete's own run distance and units.
  const targets: Partial<Record<ScenarioId, ScenarioTargets>> = {};
  for (const scenario of scenarios) {
    const t = scenarioTargets(scenario, athlete);
    if (t) targets[scenario.id] = t;
  }

  const primary = scenarios.find((s) => s.isPrimary && s.available && s.projected !== null);
  const bestFit =
    primary && primary.projected && targets[primary.id]
      ? {
          id: primary.id,
          title: primary.title,
          description: primary.description,
          horizonWeeks: primary.horizonWeeks,
          currentHybridScore: computed.hq,
          projectedHybridScore: primary.projected.hq,
          projectedGain: primary.projected.hqDelta,
          projectedTier: primary.projected.tier,
          reachesHigherTier: tierIndex(primary.projected.tier) > tierIndex(tier),
          targets: targets[primary.id]!,
        }
      : null;

  const nextTier = nextTierFor(computed.hq);

  return {
    hybridScore: computed.hq,
    tier,
    archetype: computed.archetype,
    strengthPercentile: sp,
    endurancePercentile: ep,
    leadingSide,
    trailingSide,
    percentileGap,
    benchmark: currentBenchmark(athlete),
    scenarioTargets: targets,
    bestFit,
    nextTier,
    topTierReached: nextTier === null,
  };
}
