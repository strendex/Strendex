// Group 3 quality pass — the Athlete Review speaks in the athlete's own run and
// lifts. The run as entered reaches the server and is re-converted there; each
// scenario keeps the exact inputs it was scored on; targets are those inputs in
// the athlete's distance and unit; the written plan never schedules more
// training days than the athlete has.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportView from "../app/athlete-review/components/ReportView";
import { RECALCULATE_MESSAGE, validateBenchmark } from "../lib/athleteReview/benchmarkValidation";
import { diagnose } from "../lib/athleteReview/diagnosis";
import { CANONICAL_DISCLAIMER, REPORT_PROMPT_VERSION, isRestLine, validateReport } from "../lib/athleteReview/reportSchema";
import { computeScenarios } from "../lib/athleteReview/scenarios";
import { loadSnapshot, saveSnapshot, snapshotHasRunContext } from "../lib/athleteReview/snapshot";
import {
  describeTargets,
  formatRunTime,
  fromCanonicalEnduranceSeconds,
  scenarioTargets,
  unavailableScenarioCopy,
  type AthleteBenchmark,
} from "../lib/athleteReview/targets";
import type { AthleteReviewReport, AthleteReviewResponse, GoalOption } from "../lib/athleteReview/types";
import { computeScore, type ScoringInput } from "../lib/scoring";
import {
  RUN_DISTANCES,
  RUN_DISTANCE_IDS,
  kilogramsToPounds,
  toCanonicalEnduranceSeconds,
  toKilograms,
} from "../lib/scoring/core";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const DATASET = {
  strengthScores: Array.from({ length: 100 }, (_, i) => i),
  enduranceScores: Array.from({ length: 100 }, (_, i) => i),
};

/** A 22:10 5K, three lifts, in the athlete's chosen unit. */
function fiveKAthlete(unitSystem: "kg" | "lb") {
  const lifts = unitSystem === "lb" ? { bench: 225, squat: 315, deadlift: 405 } : { bench: 100, squat: 140, deadlift: 180 };
  const input: ScoringInput = {
    bodyweightKg: 82,
    benchKg: toKilograms(lifts.bench, unitSystem),
    squatKg: toKilograms(lifts.squat, unitSystem),
    deadliftKg: toKilograms(lifts.deadlift, unitSystem),
    enduranceSeconds: toCanonicalEnduranceSeconds(1330, "5k"),
  };
  const athlete: AthleteBenchmark = {
    unitSystem,
    benchKg: input.benchKg,
    squatKg: input.squatKg,
    deadliftKg: input.deadliftKg,
    run: { distance: "5k", seconds: 1330 },
  };
  return { input, athlete, lifts };
}

function scenariosFor(input: ScoringInput, primaryGoal: GoalOption) {
  const computed = computeScore(input, DATASET);
  return { computed, scenarios: computeScenarios({ input, dataset: DATASET, current: computed, primaryGoal }) };
}

const REPORT: AthleteReviewReport = {
  headline: "Shift capacity toward your run.",
  athleteSummary: "Summary.",
  profileInterpretation: "Interpretation.",
  strengths: [1, 2, 3].map((i) => ({ title: `S${i}`, explanation: "e", evidence: "v" })),
  limiters: [1, 2, 3].map((i) => ({ title: `L${i}`, impact: "medium" as const, explanation: "e", evidence: "v" })),
  highestLeverageMove: { title: "t", why: "w", whatToDo: "d", whatToMaintain: "m", deprioritize: "p" },
  priorities: [1, 2, 3].map((priority) => ({ priority, action: "a", reason: "r" })),
  focusPlan: { durationWeeks: 8, strengthFocus: "s", enduranceFocus: "e", recoveryFocus: "r", weeklyStructure: ["Mon — run", "Wed — lift", "Fri — run", "Sat — lift"] },
  retest: { recommendedWeeks: 8, metricsToRetest: ["5K time"], successSignal: "faster" },
  confidenceNote: "Self-reported.",
  disclaimer: CANONICAL_DISCLAIMER,
};

function renderFor(input: ScoringInput, athlete: AthleteBenchmark, goal: GoalOption) {
  const { computed, scenarios } = scenariosFor(input, goal);
  const diagnosis = diagnose(computed, scenarios, athlete);
  const result: AthleteReviewResponse = {
    report: REPORT,
    scenarios,
    computed: {
      hq: computed.hq, tier: computed.tier, archetype: computed.archetype,
      strengthIndex: computed.strengthIndex, enduranceIndex: computed.enduranceIndex,
      strengthPercentile: computed.strengthPercentile, endurancePercentile: computed.endurancePercentile,
    },
    diagnosis,
    meta: { model: "t", promptVersion: REPORT_PROMPT_VERSION, datasetVersionId: "x", scoreVersion: "y" },
  };
  return { html: renderToStaticMarkup(createElement(ReportView, { result, onRetake: () => {} })), diagnosis, scenarios };
}

// ---------------------------------------------------------------------------

describe("the run as entered reaches the server, and is re-converted there", () => {
  const base = {
    bodyweight_kg: 82, bench_kg: 100, squat_kg: 140, deadlift_kg: 180, unit_system: "kg",
    dataset_version_id: "8bd76e2f-4cfb-47f0-8407-e5b812a6709d", score_version: "2.0.0",
  };
  const canonical = toCanonicalEnduranceSeconds(1330, "5k");

  it("accepts a run that converts to the scored canonical seconds, and returns it", () => {
    const r = validateBenchmark({ ...base, endurance_seconds: canonical, run_distance: "5k", run_seconds: 1330 });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.benchmark.run, { distance: "5k", seconds: 1330 });
  });

  it("asks an older snapshot without the run to recalculate", () => {
    const r = validateBenchmark({ ...base, endurance_seconds: canonical });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.recalculate, true);
      assert.equal(r.error, RECALCULATE_MESSAGE);
    }
  });

  it("never trusts a canonical value the run doesn't produce", () => {
    for (const [d, t] of [["5k", 1331], ["10k", 1330], ["half", 1330]] as const) {
      const r = validateBenchmark({ ...base, endurance_seconds: canonical, run_distance: d, run_seconds: t });
      assert.equal(r.ok, false, `${d} ${t}`);
    }
  });

  it("checks the run against the scoring domain's per-distance window", () => {
    for (const d of RUN_DISTANCE_IDS) {
      const { minSeconds, maxSeconds } = RUN_DISTANCES[d];
      for (const t of [minSeconds - 1, maxSeconds + 1]) {
        const r = validateBenchmark({ ...base, endurance_seconds: canonical, run_distance: d, run_seconds: t });
        assert.equal(r.ok, false, `${d} ${t}`);
        if (!r.ok) assert.equal(r.error, "Run time looks out of range.");
      }
    }
    for (const bad of [1330.5, "1330", null]) {
      const r = validateBenchmark({ ...base, endurance_seconds: canonical, run_distance: "5k", run_seconds: bad });
      assert.equal(r.ok, false, String(bad));
    }
    assert.equal(validateBenchmark({ ...base, endurance_seconds: canonical, run_distance: "1mi", run_seconds: 1330 }).ok, false);
  });

  it("rejects a run with no endurance benchmark", () => {
    assert.equal(validateBenchmark({ ...base, endurance_seconds: null, run_distance: "5k", run_seconds: 1330 }).ok, false);
    assert.equal(validateBenchmark({ ...base, endurance_seconds: null }).ok, true);
  });

  it("the calculator and the review page send the run as entered", () => {
    const tool = read("../app/tool/page.tsx");
    assert.match(tool.slice(tool.indexOf("<AthleteReviewCTA")), /runSeconds: saved\.inputs\.run_seconds/);
    const page = read("../app/athlete-review/page.tsx");
    assert.match(page, /run_distance:\s*snapshot\.inputs\.enduranceSeconds === null \? null : snapshot\.inputs\.runDistance/);
    assert.match(page, /run_seconds:\s*snapshot\.inputs\.enduranceSeconds === null \? null : snapshot\.inputs\.runSeconds/);
    assert.match(page, /!snapshotHasRunContext\(snap\)/);
  });
});

describe("snapshot carries the run as entered", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  const display = {
    hybridScore: 50, strengthPercentile: 50, endurancePercentile: 50, strengthIndex: 60, enduranceIndex: 60,
    tier: "INTERMEDIATE", archetype: "BALANCED HYBRID", rank: null, totalAthletes: null, betterThanPercent: null,
  };
  const inputs = {
    bodyweightKg: 82, benchKg: 100, squatKg: 140, deadliftKg: 180,
    enduranceSeconds: toCanonicalEnduranceSeconds(1330, "5k"),
    runDistance: "5k", runTimeText: "22:10", runSeconds: 1330, unitSystem: "kg" as const,
  };

  it("round-trips runSeconds", () => {
    saveSnapshot({ inputs, display, benchmark: { datasetVersionId: null, scoreVersion: null } });
    const snap = loadSnapshot()!;
    assert.equal(snap.inputs.runSeconds, 1330);
    assert.equal(snapshotHasRunContext(snap), true);
  });

  it("flags an older snapshot without it", () => {
    const { runSeconds: _omit, ...older } = inputs;
    void _omit;
    store.set("strendex_ar_snapshot_v1", JSON.stringify({ v: 1, savedAt: Date.now(), inputs: older, display }));
    const snap = loadSnapshot()!;
    assert.equal(snap.inputs.runSeconds, null);
    assert.equal(snapshotHasRunContext(snap), false);
  });
});

describe("converting a canonical time back to the athlete's distance", () => {
  it("round-trips every distance across its window to within a second", () => {
    for (const d of RUN_DISTANCE_IDS) {
      const { minSeconds, maxSeconds } = RUN_DISTANCES[d];
      for (let t = minSeconds; t <= maxSeconds; t += Math.max(1, Math.floor((maxSeconds - minSeconds) / 400))) {
        const canonical = toCanonicalEnduranceSeconds(t, d);
        const back = fromCanonicalEnduranceSeconds(canonical, d);
        assert.ok(Math.abs(back - t) <= 1, `${d} ${t}s → ${back}s`);
      }
    }
  });

  it("is the identity for the canonical distance itself", () => {
    assert.equal(fromCanonicalEnduranceSeconds(6900, "half"), 6900);
  });

  it("formats run times", () => {
    assert.equal(formatRunTime(1330), "22:10");
    assert.equal(formatRunTime(6900), "1:55:00");
    assert.equal(formatRunTime(605), "10:05");
  });
});

describe("scenarios keep the exact inputs they were scored on", () => {
  it("re-scoring projected.inputs reproduces every projected Hybrid Score", () => {
    for (const unit of ["kg", "lb"] as const) {
      const { input } = fiveKAthlete(unit);
      for (const goal of ["raise_score", "strength", "endurance", "balance"] as GoalOption[]) {
        const { scenarios } = scenariosFor(input, goal);
        for (const s of scenarios) {
          if (!s.projected) continue;
          const rescored = computeScore({ bodyweightKg: input.bodyweightKg, ...s.projected.inputs }, DATASET);
          assert.equal(rescored.hq, s.projected.hq, `${unit} ${goal} ${s.id}`);
        }
      }
    }
  });
});

describe("targets are the scenario's inputs in the athlete's own terms", () => {
  it("an endurance push becomes a faster time at the distance they entered", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const { scenarios } = scenariosFor(input, "endurance");
    const push = scenarios.find((s) => s.id === "endurance_push")!;
    const t = scenarioTargets(push, athlete)!;
    assert.equal(t.run!.label, "5K");
    assert.equal(t.run!.current, "22:10");
    const expected = fromCanonicalEnduranceSeconds(push.projected!.inputs.enduranceSeconds!, "5k");
    assert.equal(t.run!.target, formatRunTime(expected));
    assert.ok(expected < 1330);
    assert.ok(t.lifts.every((l) => l.target === null), "lifts are held");
    assert.deepEqual(describeTargets(t), [`5K: 22:10 → ~${formatRunTime(expected)}`, "Lifts: hold current performance (Bench 100 kg, Squat 140 kg, Deadlift 180 kg)"]);
  });

  it("a strength push becomes lift targets from the exact projected kilograms", () => {
    for (const unit of ["kg", "lb"] as const) {
      const { input, athlete, lifts } = fiveKAthlete(unit);
      const { scenarios } = scenariosFor(input, "strength");
      const push = scenarios.find((s) => s.id === "strength_push")!;
      const t = scenarioTargets(push, athlete)!;
      assert.equal(t.unit, unit);
      assert.equal(t.run!.target, null, "the run is held");
      for (const l of t.lifts) {
        const kg = push.projected!.inputs[`${l.lift}Kg`]!;
        const expected = unit === "lb" ? Math.round(kilogramsToPounds(kg)) : Math.round(kg * 2) / 2;
        assert.equal(l.current, lifts[l.lift], `${unit} ${l.lift} current as entered`);
        assert.equal(l.target, expected, `${unit} ${l.lift}`);
        assert.ok(l.target! > l.current, `${unit} ${l.lift} goes up`);
      }
    }
  });

  it("a balanced build moves both the run and the lifts", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const { scenarios } = scenariosFor(input, "balance");
    const t = scenarioTargets(scenarios.find((s) => s.id === "balanced")!, athlete)!;
    assert.ok(t.run!.target !== null);
    assert.ok(t.lifts.every((l) => l.target !== null));
  });

  it("has no targets for a scenario with no projection", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const { scenarios } = scenariosFor(input, "raise_score");
    assert.equal(scenarioTargets({ ...scenarios[0], available: false, projected: null }, athlete), null);
  });
});

describe("the report speaks in the athlete's units and distance", () => {
  it("lb athletes see lb, kg athletes see kg", () => {
    for (const unit of ["kg", "lb"] as const) {
      const { input, athlete } = fiveKAthlete(unit);
      const page = text(renderFor(input, athlete, "strength").html);
      const other = unit === "lb" ? "kg" : "lb";
      assert.match(page, new RegExp(`~\\d+(\\.5)? ${unit}\\b`), unit);
      assert.doesNotMatch(page, new RegExp(`\\d ${other}\\b`), `${unit} report shows no ${other}`);
    }
  });

  it("a 5K athlete's report never mentions a half marathon or an internal time", () => {
    const { input, athlete } = fiveKAthlete("kg");
    for (const goal of ["raise_score", "endurance", "strength", "balance"] as GoalOption[]) {
      const { html, diagnosis } = renderFor(input, athlete, goal);
      const page = text(html);
      assert.doesNotMatch(page, /half[- ]marathon|canonical|benchmark down by/i, goal);
      if (diagnosis.bestFit?.targets.run) assert.match(page, /5K/);
    }
  });

  it("a half-marathon athlete's report names the half they entered", () => {
    const input: ScoringInput = { bodyweightKg: 82, benchKg: 100, squatKg: 140, deadliftKg: 180, enduranceSeconds: 6900 };
    const athlete: AthleteBenchmark = { unitSystem: "kg", benchKg: 100, squatKg: 140, deadliftKg: 180, run: { distance: "half", seconds: 6900 } };
    const page = text(renderFor(input, athlete, "endurance").html);
    assert.match(page, /Half marathon 1:55:00 → to ~1:5\d:\d\d/);
  });

  it("the best fit leads with the athlete's numbers, then the Hybrid Score", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const { html, diagnosis } = renderFor(input, athlete, "endurance");
    const page = text(html);
    const bf = diagnosis.bestFit!;
    const order = ["Best-fit scenario", "What this would mean in your numbers", `5K 22:10 → to ~${bf.targets.run!.target}`, "Lifts Hold current performance", `${bf.currentHybridScore} → to ${bf.projectedHybridScore}`]
      .map((m) => page.indexOf(m));
    assert.ok(order.every((i) => i >= 0), JSON.stringify(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("success is described in the athlete's run and lifts, not percentiles", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const { html, diagnosis } = renderFor(input, athlete, "endurance");
    const page = text(html);
    const success = page.slice(page.indexOf("What success looks like"));
    assert.match(success, new RegExp(`5K 22:10 → to ~${diagnosis.bestFit!.targets.run!.target}`));
    assert.match(success, /Modeled Hybrid Score/);
    assert.match(success, /not a promised result/);
    assert.doesNotMatch(success, /percentile/i);
  });
});

describe("the weekly plan respects the athlete's training days", () => {
  function reportWith(lines: string[]) {
    return { ...REPORT, focusPlan: { ...REPORT.focusPlan, weeklyStructure: lines } };
  }
  const training = (n: number) => Array.from({ length: n }, (_, i) => `Day ${i + 1}: session`);

  for (const days of [4, 5, 6, 7]) {
    it(`${days} days available: up to ${days} training days, never more`, () => {
      const ok = validateReport(reportWith(training(days)), { daysAvailable: days });
      assert.equal(ok.ok, true);
      if (ok.ok) assert.equal(ok.report.focusPlan.weeklyStructure.length, days);
      assert.equal(validateReport(reportWith(training(days - 1)), { daysAvailable: days }).ok, true);
      if (days < 7) {
        const over = validateReport(reportWith(training(days + 1)), { daysAvailable: days });
        assert.equal(over.ok, false);
      }
    });
  }

  it("drops rest-day lines instead of counting them as training days", () => {
    const r = validateReport(reportWith([...training(6), "Day 7: Rest"]), { daysAvailable: 6 });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.report.focusPlan.weeklyStructure, training(6));
  });

  it("recognises rest lines, and only rest lines", () => {
    for (const rest of ["Day 7: Rest", "Sunday — rest and mobility", "Rest day", "Sat - Off", "Thursday: full rest", "Day 4 – active rest"]) {
      assert.equal(isRestLine(rest), true, rest);
    }
    for (const work of ["Day 2: Rest-pause bench sets", "Monday — easy run, then rest", "Wed — lower body", "Day 5: tempo run"]) {
      assert.equal(isRestLine(work), false, work);
    }
  });

  it("the rendered plan states how many training days it uses", () => {
    const { input, athlete } = fiveKAthlete("kg");
    const page = text(renderFor(input, athlete, "endurance").html);
    assert.match(page, /The next 8 weeks · 4 training days a week/);
    assert.match(page, /Rest or easy recovery on the other days\./);
  });
});

describe("AI reports may not use internal scoring terms", () => {
  const PHRASES = [
    "half-marathon equivalent",
    "half marathon equivalent",
    "canonical endurance",
    "canonical time",
    "endurance index",
    "strength index",
  ];

  it("a normal report passes", () => {
    const r = validateReport(REPORT, { daysAvailable: 4 });
    assert.equal(r.ok, true);
    // Ordinary words around the terms are fine.
    const plain = { ...REPORT, athleteSummary: "Your endurance work and your strength sessions both matter; the index finger is fine." };
    assert.equal(validateReport(plain, { daysAvailable: 4 }).ok, true);
  });

  for (const phrase of PHRASES) {
    it(`rejects "${phrase}" wherever the model writes it`, () => {
      const placements: AthleteReviewReport[] = [
        { ...REPORT, headline: `Your ${phrase} is the gap.` },
        { ...REPORT, limiters: REPORT.limiters.map((l, i) => (i === 2 ? { ...l, evidence: `Your ${phrase} of 6900.` } : l)) },
        { ...REPORT, highestLeverageMove: { ...REPORT.highestLeverageMove, deprioritize: `Chasing ${phrase}.` } },
        { ...REPORT, focusPlan: { ...REPORT.focusPlan, weeklyStructure: [...REPORT.focusPlan.weeklyStructure.slice(0, 3), `Sat — ${phrase} work`] } },
        { ...REPORT, retest: { ...REPORT.retest, metricsToRetest: [phrase] } },
      ];
      for (const report of placements) {
        const r = validateReport(report, { daysAvailable: 4 });
        assert.equal(r.ok, false, phrase);
        if (!r.ok) assert.equal(r.error, "internal terminology in report");
      }
    });
  }

  it("matches case-insensitively, hyphenated or not", () => {
    for (const variant of ["HALF-MARATHON EQUIVALENT", "Half Marathon Equivalent", "Canonical Time", "ENDURANCE INDEX", "Strength-Index", "canonical-endurance"]) {
      const r = validateReport({ ...REPORT, profileInterpretation: `About your ${variant}.` }, { daysAvailable: 4 });
      assert.equal(r.ok, false, variant);
    }
  });

  it("a rejected report takes the route's existing unusable-result path", () => {
    const route = read("../app/api/athlete-review/route.ts");
    assert.match(
      route,
      /if \(!reportResult\.ok\) \{\s*logError\("openai output unusable", \{ route: ROUTE, code: "report_invalid" \}\);\s*return NextResponse\.json\(\{ error: AI_UNAVAILABLE_MESSAGE \}, \{ status: 502 \}\);/,
    );
  });
});

describe("an endurance-capped athlete reads about their own run", () => {
  // A 15:00 5K already earns the maximum endurance score.
  const capped: ScoringInput = {
    bodyweightKg: 70, benchKg: 70, squatKg: 100, deadliftKg: 120,
    enduranceSeconds: toCanonicalEnduranceSeconds(900, "5k"),
  };
  const athlete: AthleteBenchmark = {
    unitSystem: "kg", benchKg: 70, squatKg: 100, deadliftKg: 120, run: { distance: "5k", seconds: 900 },
  };

  it("the engine marks the cap with a typed reason, its own text unchanged", () => {
    const { scenarios } = scenariosFor(capped, "raise_score");
    for (const id of ["endurance_push", "balanced"]) {
      const s = scenarios.find((x) => x.id === id)!;
      assert.equal(s.available, false, id);
      assert.equal(s.unavailableReason, "endurance_at_cap", id);
      assert.match(s.description, /maximum endurance index/, "engine copy is untouched");
    }
  });

  it("words the cap from the distance the athlete entered", () => {
    const cap = { description: "engine text", unavailableReason: "endurance_at_cap" as const };
    const expected = {
      "3mi": "Your current 3 mi time",
      "5k": "Your current 5K",
      "10k": "Your current 10K",
      half: "Your current half marathon",
      marathon: "Your current marathon",
    } as const;
    for (const d of RUN_DISTANCE_IDS) {
      assert.equal(
        unavailableScenarioCopy(cap, d),
        `${expected[d]} is already at the top of Strendex’s endurance scale, so a faster time would not raise your Hybrid Score.`,
      );
    }
    // Any other unavailable scenario keeps its own description.
    assert.equal(unavailableScenarioCopy({ description: "Add at least one lift to unlock this scenario." }, "5k"), "Add at least one lift to unlock this scenario.");
  });

  it("the rendered report says it in the athlete's terms, with no internal names", () => {
    const page = text(renderFor(capped, athlete, "raise_score").html);
    assert.match(page, /Your current 5K is already at the top of Strendex’s endurance scale, so a faster time would not raise your Hybrid Score\./);
    assert.doesNotMatch(page, /maximum endurance index|half[- ]marathon|canonical/i);
  });
});
