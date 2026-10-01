// Group 3 — the Athlete Review report leads with a deterministic diagnosis.
// Diagnosis logic is tested directly; the report is rendered to markup and the
// diagnosis block is checked to depend on deterministic data only.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportView from "../app/athlete-review/components/ReportView";
import { diagnose, nextTierFor } from "../lib/athleteReview/diagnosis";
import { buildAthleteReviewInput } from "../lib/athleteReview/prompt";
import { CANONICAL_DISCLAIMER, REPORT_PROMPT_VERSION } from "../lib/athleteReview/reportSchema";
import { computeScenarios } from "../lib/athleteReview/scenarios";
import { scenarioTargets, type AthleteBenchmark } from "../lib/athleteReview/targets";
import type {
  AssessmentAnswers,
  AthleteReviewReport,
  AthleteReviewResponse,
  GoalOption,
  Scenario,
} from "../lib/athleteReview/types";
import { computeScore, getArchetype, type ScoringInput } from "../lib/scoring";

// A reference population of 0..99, so a percentile reads close to the index.
const DATASET = {
  strengthScores: Array.from({ length: 100 }, (_, i) => i),
  enduranceScores: Array.from({ length: 100 }, (_, i) => i),
};

const STRENGTH_HEAVY: ScoringInput = { bodyweightKg: 82, benchKg: 140, squatKg: 200, deadliftKg: 240, enduranceSeconds: 9000 };
const ENDURANCE_HEAVY: ScoringInput = { bodyweightKg: 70, benchKg: 60, squatKg: 80, deadliftKg: 100, enduranceSeconds: 5000 };

/** The athlete's own benchmark; by default the run was entered as a half, so canonical = entered. */
function athleteFor(input: ScoringInput, unitSystem: "kg" | "lb" = "kg"): AthleteBenchmark {
  return {
    unitSystem,
    benchKg: input.benchKg,
    squatKg: input.squatKg,
    deadliftKg: input.deadliftKg,
    run: input.enduranceSeconds === null ? null : { distance: "half", seconds: input.enduranceSeconds },
  };
}

const NO_BENCHMARK: AthleteBenchmark = { unitSystem: "kg", benchKg: null, squatKg: null, deadliftKg: null, run: null };

function review(input: ScoringInput, primaryGoal: GoalOption = "raise_score", athlete = athleteFor(input)) {
  const computed = computeScore(input, DATASET);
  const scenarios = computeScenarios({ input, dataset: DATASET, current: computed, primaryGoal });
  return { computed, scenarios, diagnosis: diagnose(computed, scenarios, athlete) };
}

/** A scored athlete with chosen percentiles, for cases the dataset can't reach exactly. */
function stated(sp: number, ep: number, hq: number, archetype: string) {
  return { hq, archetype, strengthPercentile: sp, endurancePercentile: ep };
}

const REPORT: AthleteReviewReport = {
  headline: "Your run is where the next points are.",
  athleteSummary: "Summary prose.",
  profileInterpretation: "Interpretation prose.",
  strengths: [1, 2, 3].map((i) => ({ title: `Strength ${i}`, explanation: "e", evidence: "v" })),
  limiters: [1, 2, 3].map((i) => ({ title: `Limiter ${i}`, impact: "medium" as const, explanation: "e", evidence: "v" })),
  highestLeverageMove: { title: "Build the aerobic base", why: "w", whatToDo: "d", whatToMaintain: "m", deprioritize: "Chasing strength PRs." },
  priorities: [1, 2, 3].map((priority) => ({ priority, action: "a", reason: "r" })),
  focusPlan: { durationWeeks: 8, strengthFocus: "s", enduranceFocus: "e", recoveryFocus: "r", weeklyStructure: ["1", "2", "3", "4", "5"] },
  retest: { recommendedWeeks: 8, metricsToRetest: ["5K"], successSignal: "faster" },
  confidenceNote: "Self-reported inputs.",
  disclaimer: CANONICAL_DISCLAIMER,
};

function response(r: ReturnType<typeof review>, report: AthleteReviewReport = REPORT): AthleteReviewResponse {
  return {
    report,
    scenarios: r.scenarios,
    computed: {
      hq: r.computed.hq,
      tier: r.computed.tier,
      archetype: r.computed.archetype,
      strengthIndex: r.computed.strengthIndex,
      enduranceIndex: r.computed.enduranceIndex,
      strengthPercentile: r.computed.strengthPercentile,
      endurancePercentile: r.computed.endurancePercentile,
    },
    diagnosis: r.diagnosis,
    meta: { model: "test", promptVersion: REPORT_PROMPT_VERSION, datasetVersionId: "x", scoreVersion: "y" },
  };
}

const render = (res: AthleteReviewResponse) =>
  renderToStaticMarkup(createElement(ReportView, { result: res, onRetake: () => {} }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
/** The deterministic block at the top of the report. */
function diagnosisBlock(html: string): string {
  const start = html.indexOf('data-section="diagnosis"');
  const end = html.indexOf("The numbers above come from Strendex scoring");
  assert.ok(start >= 0 && end > start, "diagnosis block present before the written analysis");
  return html.slice(start, end);
}

describe("diagnosis: which side is lower", () => {
  it("A. strength-leading athlete", () => {
    const { computed, diagnosis } = review(STRENGTH_HEAVY);
    assert.ok(computed.strengthPercentile > computed.endurancePercentile, "fixture leans to strength");
    assert.equal(diagnosis.leadingSide, "strength");
    assert.equal(diagnosis.trailingSide, "endurance");
    assert.equal(
      diagnosis.percentileGap,
      Number(Math.abs(computed.strengthPercentile - computed.endurancePercentile).toFixed(1)),
    );
  });

  it("B. endurance-leading athlete", () => {
    const { computed, diagnosis } = review(ENDURANCE_HEAVY);
    assert.ok(computed.endurancePercentile > computed.strengthPercentile, "fixture leans to endurance");
    assert.equal(diagnosis.leadingSide, "endurance");
    assert.equal(diagnosis.trailingSide, "strength");
    assert.equal(
      diagnosis.percentileGap,
      Number(Math.abs(computed.strengthPercentile - computed.endurancePercentile).toFixed(1)),
    );
  });

  it("C. balanced athlete follows the engine's athlete type", () => {
    const d = diagnose(stated(61.2, 57.0, 59, "BALANCED HYBRID"), [], NO_BENCHMARK);
    assert.equal(d.leadingSide, "balanced");
    assert.equal(d.trailingSide, null);
    assert.equal(d.percentileGap, 4.2);

    // A leaning athlete is never called balanced beside their athlete type.
    const leaning = diagnose(stated(70, 58, 64, "STRENGTH-LEANING HYBRID"), [], NO_BENCHMARK);
    assert.equal(leaning.leadingSide, "strength");
    assert.equal(leaning.percentileGap, 12);

    // POWER HYBRID is a level type: two close sides are still closely matched.
    const power = diagnose(stated(90, 88, 89, "POWER HYBRID"), [], NO_BENCHMARK);
    assert.equal(power.leadingSide, "balanced");
    assert.equal(power.trailingSide, null);
    // …but a real gap at that level is still named.
    assert.equal(diagnose(stated(95, 76, 86, "POWER HYBRID"), [], NO_BENCHMARK).trailingSide, "endurance");
  });

  it("C. 'balanced' agrees with the engine's lean rule everywhere it applies", () => {
    for (let sp = 10; sp <= 74; sp += 0.5) {
      for (let ep = 10; ep <= 74; ep += 0.5) {
        const archetype = getArchetype(sp, ep);
        const d = diagnose(stated(sp, ep, 50, archetype), [], NO_BENCHMARK);
        assert.equal(d.leadingSide === "balanced", archetype === "BALANCED HYBRID", `${sp}/${ep}`);
      }
    }
  });
});

describe("diagnosis: best-fit scenario", () => {
  it("D. is the scenario computeScenarios marked primary, numbers unchanged", () => {
    for (const [input, goal] of [
      [STRENGTH_HEAVY, "raise_score"],
      [ENDURANCE_HEAVY, "raise_score"],
      [STRENGTH_HEAVY, "strength"],
      [ENDURANCE_HEAVY, "endurance"],
    ] as const) {
      const { computed, scenarios, diagnosis } = review(input, goal);
      const primary = scenarios.find((s) => s.isPrimary)!;
      assert.ok(primary.projected, "fixture has a projectable primary");
      assert.deepEqual(diagnosis.bestFit, {
        id: primary.id,
        title: primary.title,
        description: primary.description,
        horizonWeeks: primary.horizonWeeks,
        currentHybridScore: computed.hq,
        projectedHybridScore: primary.projected.hq,
        projectedGain: primary.projected.hqDelta,
        projectedTier: primary.projected.tier,
        reachesHigherTier: diagnosis.bestFit!.reachesHigherTier,
        targets: scenarioTargets(primary, athleteFor(input)),
      });
    }
  });

  it("G. makes no projected claim when no primary scenario can be projected", () => {
    const unavailable: Scenario = {
      id: "endurance_push", title: "8-week endurance push", description: "Add an endurance time to unlock this scenario.",
      horizonWeeks: 8, available: false, projected: null, isPrimary: true,
      changes: { enduranceSecondsDelta: null, benchPct: 0, squatPct: 0, deadliftPct: 0 },
    };
    assert.equal(diagnose(stated(60, 50, 55, "STRENGTH-LEANING HYBRID"), [unavailable], NO_BENCHMARK).bestFit, null);
    assert.equal(diagnose(stated(60, 50, 55, "STRENGTH-LEANING HYBRID"), [], NO_BENCHMARK).bestFit, null);

    const r = review(STRENGTH_HEAVY);
    const html = render(response({ ...r, diagnosis: { ...r.diagnosis, bestFit: null } }));
    const top = text(diagnosisBlock(html));
    assert.match(top, /couldn’t project a score change for this profile/);
    assert.doesNotMatch(top, /→|pts\b|Estimated over/);
    assert.match(text(html), /Your best-fit training direction/);
    assert.doesNotMatch(text(html), /How to apply your best-fit scenario/);
  });
});

describe("diagnosis: next tier", () => {
  it("E. each tier points at the next one", () => {
    assert.deepEqual(nextTierFor(20), { tier: "INTERMEDIATE", threshold: 40, pointsAway: 20 });
    assert.deepEqual(nextTierFor(50), { tier: "ADVANCED", threshold: 60, pointsAway: 10 });
    assert.deepEqual(nextTierFor(70), { tier: "ELITE", threshold: 75, pointsAway: 5 });
    assert.deepEqual(nextTierFor(86), { tier: "WORLD CLASS", threshold: 90, pointsAway: 4 });
    assert.equal(nextTierFor(95), null);
  });

  it("F. boundary scores", () => {
    assert.deepEqual(nextTierFor(0), { tier: "INTERMEDIATE", threshold: 40, pointsAway: 40 });
    assert.deepEqual(nextTierFor(39), { tier: "INTERMEDIATE", threshold: 40, pointsAway: 1 });
    assert.deepEqual(nextTierFor(40), { tier: "ADVANCED", threshold: 60, pointsAway: 20 });
    assert.deepEqual(nextTierFor(59), { tier: "ADVANCED", threshold: 60, pointsAway: 1 });
    assert.deepEqual(nextTierFor(60), { tier: "ELITE", threshold: 75, pointsAway: 15 });
    assert.deepEqual(nextTierFor(74), { tier: "ELITE", threshold: 75, pointsAway: 1 });
    assert.deepEqual(nextTierFor(75), { tier: "WORLD CLASS", threshold: 90, pointsAway: 15 });
    assert.deepEqual(nextTierFor(89), { tier: "WORLD CLASS", threshold: 90, pointsAway: 1 });
    assert.equal(nextTierFor(90), null);
    assert.equal(nextTierFor(100), null);
  });

  it("WORLD CLASS shows 'Top tier reached' and no target above it", () => {
    const d = diagnose(stated(95, 92, 94, "POWER HYBRID"), [], NO_BENCHMARK);
    assert.equal(d.tier, "WORLD CLASS");
    assert.equal(d.topTierReached, true);
    assert.equal(d.nextTier, null);

    const r = review(STRENGTH_HEAVY);
    const html = render(response({ ...r, diagnosis: { ...d, bestFit: null } }));
    const top = text(diagnosisBlock(html));
    assert.match(top, /Top tier reached/);
    assert.match(top, /WORLD CLASS is the highest Strendex tier/);
    assert.doesNotMatch(top, /starts at|points? away/);
  });

  it("flags a best-fit scenario that crosses into a higher tier", () => {
    const crossing: Scenario = {
      id: "endurance_push", title: "8-week endurance push", description: "Bring it down.",
      horizonWeeks: 8, available: true, isPrimary: true,
      changes: { enduranceSecondsDelta: -120, benchPct: 0, squatPct: 0, deadliftPct: 0 },
      projected: {
        hq: 76, tier: "ELITE", strengthPercentile: 80, endurancePercentile: 72, hqDelta: 3,
        inputs: { benchKg: null, squatKg: null, deadliftKg: null, enduranceSeconds: null },
      },
    };
    const d = diagnose(stated(80, 66, 73, "STRENGTH-LEANING HYBRID"), [crossing], NO_BENCHMARK);
    assert.equal(d.bestFit?.reachesHigherTier, true);
    assert.deepEqual(d.nextTier, { tier: "ELITE", threshold: 75, pointsAway: 2 });
  });
});

describe("report renderer", () => {
  it("H. leads with the diagnosis, before any AI prose", () => {
    const html = render(response(review(STRENGTH_HEAVY)));
    const page = text(html);
    // Nothing the model wrote appears before the deterministic block ends.
    const beforeAnalysis = text(html.slice(0, html.indexOf("The numbers above come from Strendex scoring")));
    assert.ok(!beforeAnalysis.includes(REPORT.headline), "AI headline is below the diagnosis");
    assert.match(html, /<h1[^>]*>Your Athlete Review<\/h1>/);
    const order = ["Your Athlete Review", "Performance diagnosis", "What’s holding your score back", "Best-fit scenario", "Next tier", "The numbers above come from Strendex scoring", "What this means", REPORT.headline, REPORT.athleteSummary, REPORT.profileInterpretation]
      .map((m) => page.indexOf(m));
    assert.ok(order.every((i) => i >= 0), "every section present");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("H. shows the diagnosis numbers exactly as the server computed them", () => {
    const r = review(STRENGTH_HEAVY);
    const d = r.diagnosis;
    const top = text(diagnosisBlock(render(response(r))));
    assert.ok(top.includes(`${d.strengthPercentile.toFixed(1)}%`));
    assert.ok(top.includes(`${d.endurancePercentile.toFixed(1)}%`));
    assert.ok(top.includes(`Endurance is your lower side, ${d.percentileGap} percentile points behind strength.`));
    assert.ok(top.includes(`${d.bestFit!.currentHybridScore} → to ${d.bestFit!.projectedHybridScore} +${d.bestFit!.projectedGain} pts`));
    assert.equal(d.bestFit!.reachesHigherTier, false, "fixture stays in its tier");
    assert.ok(top.includes(`Estimated over ~${d.bestFit!.horizonWeeks} weeks · stays ${d.bestFit!.projectedTier}`));
    if (d.nextTier) assert.ok(top.includes(`${d.nextTier.tier} starts at ${d.nextTier.threshold}`));
  });

  it("H. the diagnosis block does not change with the AI text, only with the diagnosis", () => {
    const r = review(STRENGTH_HEAVY);
    const decoy: AthleteReviewReport = {
      ...REPORT,
      headline: "You will reach 99 and gain +40 pts in 2 weeks.",
      athleteSummary: "Your score will be 97.",
      highestLeverageMove: { ...REPORT.highestLeverageMove, title: "+25 pts guaranteed" },
    };
    const a = diagnosisBlock(render(response(r)));
    const b = diagnosisBlock(render(response(r, decoy)));
    assert.equal(a, b);
    assert.doesNotMatch(text(b), /\b99\b|\b97\b|\+40|\+25/);

    const moved = { ...r.diagnosis, bestFit: { ...r.diagnosis.bestFit!, projectedHybridScore: 77, projectedGain: 13 } };
    assert.match(text(diagnosisBlock(render(response({ ...r, diagnosis: moved })))), /77 \+13 pts/);
  });

  it("does not repeat the best-fit scenario under other scenarios", () => {
    const r = review(STRENGTH_HEAVY);
    const page = text(render(response(r)));
    const others = page.slice(page.indexOf("Other modeled scenarios"));
    assert.ok(page.includes("Other modeled scenarios"));
    assert.ok(!others.includes(r.diagnosis.bestFit!.title));
  });

  it("uses athlete-facing section names", () => {
    const page = text(render(response(review(STRENGTH_HEAVY))));
    for (const label of ["What this means", "What’s already working", "What’s getting in the way", "How to apply your best-fit scenario", "The main shift", "Keep", "Deprioritize this block", "Your priorities", "Your next training block", "Recovery and constraint guardrail", "What success looks like"]) {
      assert.ok(page.includes(label), label);
    }
    // The best fit is chosen for goal and profile fit, not as the largest gain.
    assert.doesNotMatch(page, /one change most likely to raise/i);
    assert.doesNotMatch(page, /LIMITERS|HIGHEST-LEVERAGE|Locked/i);
  });

  it("keeps the raw indices out of the headline numbers", () => {
    const html = render(response(review(STRENGTH_HEAVY)));
    assert.match(html, /<details[^>]*>[\s\S]*Underlying index values/);
  });

  it("links the disclaimer to the methodology", () => {
    const html = render(response(review(STRENGTH_HEAVY)));
    assert.match(html, /href="\/methodology"[^>]*>Read the methodology/);
  });
});

describe("prompt", () => {
  const r = review(STRENGTH_HEAVY);
  const answers = {
    primaryGoal: "raise_score", strengthSessions: 6, enduranceSessions: 3, daysAvailable: 6, mainConstraint: "time",
  } as AssessmentAnswers;
  const { system, user } = buildAthleteReviewInput({
    computed: r.computed,
    benchmark: STRENGTH_HEAVY,
    scenarios: r.scenarios,
    diagnosis: r.diagnosis,
    answers,
    unitSystem: "kg",
  });
  const data = JSON.parse(user.replace(/^DATA:\n/, ""));

  it("I. separates performance facts the model may never invent from coaching recommendations", () => {
    assert.match(system, /PERFORMANCE FACTS — never invent or recompute:/);
    assert.match(system, /Hybrid Score, score gains, percentiles, tiers, distances to a tier, run or lift performance targets, scenario horizons, and performance ratios presented as facts\. These come only from DATA\./);
    assert.match(system, /COACHING RECOMMENDATIONS — allowed, with judgement:/);
    assert.match(system, /These are recommendations, not predicted outcomes\./);
  });

  it("I. makes the deterministic best-fit scenario authoritative", () => {
    assert.match(system, /DATA\.diagnosis\.bestFit is the scenario Strendex chose for this athlete's goal and profile\. Do not choose or recommend a different one\./);
    assert.match(system, /"Hold" in a scenario means hold PERFORMANCE/);
    assert.match(system, /never say a point on the lower side is worth more/);
    assert.match(system, /If topTierReached is true, set no tier target above it/);
    assert.equal(data.diagnosis.bestFit.projectedHybridScore, r.diagnosis.bestFit!.projectedHybridScore);
    assert.deepEqual(data.diagnosis.nextTier, r.diagnosis.nextTier);
  });

  it("requires synthesis, not restatement", () => {
    assert.match(system, /must connect at least two pieces of athlete context/);
    assert.match(system, /Do not restate a number merely to prove you saw it/);
    assert.match(system, /highestLeverageMove\.deprioritize: what to deliberately stop chasing this block/);
  });

  it("favours reallocation over added workload when time or recovery is the constraint", () => {
    assert.match(system, /If the main constraint is time or recovery, or the athlete already does as many sessions as days available .* do not add total workload: reallocate the sessions they already do\./);
    assert.deepEqual(data.trainingLoad, {
      strengthSessionsPerWeek: 6,
      enduranceSessionsPerWeek: 3,
      totalSessionsPerWeek: 9,
      daysAvailable: 6,
      sessionsAtOrAboveDays: true,
    });
  });

  it("asks for one weekly line per training day, never a rest day", () => {
    assert.match(system, /one line per TRAINING day, at most DATA\.trainingLoad\.daysAvailable lines\. Never include a rest day as a line/);
  });

  it("retests the athlete's own run and lifts", () => {
    assert.match(system, /retest\.metricsToRetest: the athlete's own run distance and lifts .* never a percentile, index or score/);
  });

  it("carries no internal endurance or index values", () => {
    assert.doesNotMatch(user, /HalfMarathonEquivalent|canonical|enduranceIndex|strengthIndex|enduranceSeconds/i);
    assert.match(system, /Never mention a "half-marathon equivalent", a canonical time, or an endurance index/);
    assert.equal("description" in data.diagnosis.bestFit, false);
    for (const s of data.scoreScenarios) assert.equal("change" in s, false);
  });

  it("describes the reference baseline accurately", () => {
    assert.doesNotMatch(system, /simulated early-access/);
    assert.match(system, /current Strendex reference baseline/);
  });

  it("bumps the prompt version", () => {
    assert.equal(REPORT_PROMPT_VERSION, "ar-v3");
  });
});

describe("disclaimer and baseline wording", () => {
  it("J. no stale dataset wording, medical boundary kept", () => {
    assert.match(CANONICAL_DISCLAIMER, /is not medical advice/);
    assert.match(CANONICAL_DISCLAIMER, /current Strendex reference baseline/);
    for (const stale of [/simulated early-access/i, /as it grows/i, /as the dataset grows/i, /change as/i]) {
      assert.doesNotMatch(CANONICAL_DISCLAIMER, stale);
    }
    const view = readFileSync(new URL("../app/athlete-review/components/ReportView.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(view, /as the dataset grows|simulated/i);
  });
});
