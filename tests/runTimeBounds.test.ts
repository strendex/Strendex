// Group 2 — per-distance run-time validation.
//
// Every boundary here is exercised through the real conversion
// (toCanonicalEnduranceSeconds, with its Math.round) and the real validator,
// one second either side. Nothing is recomputed with a test-local formula.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ENDURANCE_INDEX_MAX_SEC,
  ENDURANCE_INDEX_MIN_SEC,
  RUN_DISTANCES,
  RUN_DISTANCE_IDS,
  SCORE_VERSION,
  SUBMISSION_CANONICAL_ENDURANCE_SECONDS,
  ScoringError,
  VALIDATION_BOUNDS,
  computeCanonicalScore,
  computeEnduranceIndex,
  parseCanonicalBenchmark,
  toCanonicalEnduranceSeconds,
  type RunDistance,
} from "../lib/scoring/core";
import {
  submissionVisibility,
  buildScoreRequestDraft,
  describeScoringFailure,
  parseRunTime,
  runTimeRangeText,
  type ScoreFormValues,
} from "../lib/tool/scoreSubmission";
import { makeSnapshot } from "./helpers/dataset";

const ATHLETE = {
  unitSystem: "kg" as const,
  bodyweight: 90,
  bench: 110,
  squat: 150,
  deadlift: 190,
};

function benchmark(runDistance: RunDistance, runSeconds: number) {
  return parseCanonicalBenchmark({ ...ATHLETE, runDistance, runSeconds });
}

function rejects(runDistance: RunDistance, runSeconds: number) {
  assert.throws(
    () => benchmark(runDistance, runSeconds),
    (err: unknown) => {
      assert.ok(err instanceof ScoringError);
      assert.equal(err.code, "OUT_OF_RANGE");
      assert.equal(err.field, "run_seconds");
      return true;
    },
    `${runDistance} ${runSeconds}s must be rejected`,
  );
}

/**
 * Entered-time window per distance, and what each end converts to.
 * min/max are inclusive whole seconds.
 */
const EXPECTED: Record<
  RunDistance,
  { min: number; max: number; canonAtMin: number; canonAtMax: number }
> = {
  "3mi": { min: 660, max: 6032, canonAtMin: 3151, canonAtMax: 28797 },
  "5k": { min: 700, max: 6260, canonAtMin: 3220, canonAtMax: 28797 },
  "10k": { min: 1500, max: 13053, canonAtMin: 3310, canonAtMax: 28800 },
  half: { min: 3300, max: 28800, canonAtMin: 3300, canonAtMax: 28800 },
  marathon: { min: 6900, max: 43200, canonAtMin: 3309, canonAtMax: 20720 },
};

describe("run-time windows: exact integer-second boundaries", () => {
  for (const d of RUN_DISTANCE_IDS) {
    const e = EXPECTED[d];

    it(`${d}: accepts ${e.min}–${e.max}s and rejects one second outside`, () => {
      assert.equal(RUN_DISTANCES[d].minSeconds, e.min);
      assert.equal(RUN_DISTANCES[d].maxSeconds, e.max);

      assert.equal(benchmark(d, e.min).canonicalEnduranceSeconds, e.canonAtMin);
      assert.equal(benchmark(d, e.max).canonicalEnduranceSeconds, e.canonAtMax);
      rejects(d, e.min - 1);
      rejects(d, e.max + 1);
    });
  }

  it("3mi, 5K and 10K maximums are the last second inside the 28800 s ceiling", () => {
    for (const d of ["3mi", "5k", "10k"] as const) {
      const max = RUN_DISTANCES[d].maxSeconds;
      assert.ok(toCanonicalEnduranceSeconds(max, d) <= 28800);
      assert.ok(
        toCanonicalEnduranceSeconds(max + 1, d) > 28800,
        `${d}: one second more must convert past the ceiling`,
      );
    }
  });

  it("the submission canonical bounds are exactly the converted span of the windows", () => {
    const converted = RUN_DISTANCE_IDS.flatMap((d) => [
      toCanonicalEnduranceSeconds(RUN_DISTANCES[d].minSeconds, d),
      toCanonicalEnduranceSeconds(RUN_DISTANCES[d].maxSeconds, d),
    ]);
    assert.deepEqual(SUBMISSION_CANONICAL_ENDURANCE_SECONDS, {
      min: Math.min(...converted),
      max: Math.max(...converted),
    });
    assert.deepEqual(SUBMISSION_CANONICAL_ENDURANCE_SECONDS, { min: 3151, max: 28800 });
  });

  it("every second inside every window passes the canonical backstop", () => {
    for (const d of RUN_DISTANCE_IDS) {
      for (let t = RUN_DISTANCES[d].minSeconds; t <= RUN_DISTANCES[d].maxSeconds; t++) {
        const c = toCanonicalEnduranceSeconds(t, d);
        assert.ok(
          c >= SUBMISSION_CANONICAL_ENDURANCE_SECONDS.min &&
            c <= SUBMISSION_CANONICAL_ENDURANCE_SECONDS.max,
          `${d} ${t}s -> ${c}`,
        );
      }
    }
  });
});

describe("fast runners", () => {
  it("are accepted at each distance's floor and score the capped endurance index", () => {
    for (const d of RUN_DISTANCE_IDS) {
      const parsed = benchmark(d, RUN_DISTANCES[d].minSeconds);
      assert.ok(parsed.canonicalEnduranceSeconds < 4200, `${d} floor is a fast-runner time`);
      assert.equal(computeEnduranceIndex(parsed.canonicalEnduranceSeconds), 100);
    }
  });

  it("a 15:00 5K — refused before Group 2 — is accepted", () => {
    assert.equal(benchmark("5k", 900).canonicalEnduranceSeconds, 4140);
  });
});

describe("unchanged: dataset eligibility, formulas and score version", () => {
  it("keeps the dataset builder's 4200–28800 eligibility bound", () => {
    assert.deepEqual(VALIDATION_BOUNDS.canonicalEnduranceSeconds, { min: 4200, max: 28800 });
  });

  it("keeps the endurance index anchors and score version", () => {
    assert.equal(ENDURANCE_INDEX_MIN_SEC, 4200);
    assert.equal(ENDURANCE_INDEX_MAX_SEC, 10800);
    assert.equal(SCORE_VERSION, "2.0.0");
  });

  // Golden values produced by the PRE-Group-2 validator and scorer, at the old
  // accepted edges and between them, for every distance and both unit systems.
  // Row: distance, seconds, unit, canonical s, strength idx, endurance idx,
  //      strength pct, endurance pct, Hybrid Score, tier, archetype.
  const GOLDEN: ReadonlyArray<
    readonly [RunDistance, number, "kg" | "lb", number, number, number, number, number, number, string, string]
  > = [
  ["3mi", 880, "kg", 4201, 66.9, 100, 68, 100, 84, "ELITE", "ENDURANCE MACHINE"],
  ["3mi", 880, "lb", 4201, 73.3, 100, 74, 100, 87, "ELITE", "ENDURANCE MACHINE"],
  ["3mi", 1395, "kg", 6660, 66.9, 62.7, 68, 64, 66, "ADVANCED", "BALANCED HYBRID"],
  ["3mi", 1395, "lb", 6660, 73.3, 62.7, 74, 64, 69, "ADVANCED", "STRENGTH-LEANING HYBRID"],
  ["3mi", 3456, "kg", 16499, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["3mi", 3456, "lb", 16499, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["3mi", 6032, "kg", 28797, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["3mi", 6032, "lb", 28797, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["5k", 913, "kg", 4200, 66.9, 100, 68, 100, 84, "ELITE", "ENDURANCE MACHINE"],
  ["5k", 913, "lb", 4200, 73.3, 100, 74, 100, 87, "ELITE", "ENDURANCE MACHINE"],
  ["5k", 1448, "kg", 6661, 66.9, 62.7, 68, 64, 66, "ADVANCED", "BALANCED HYBRID"],
  ["5k", 1448, "lb", 6661, 73.3, 62.7, 74, 64, 69, "ADVANCED", "STRENGTH-LEANING HYBRID"],
  ["5k", 3587, "kg", 16501, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["5k", 3587, "lb", 16501, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["5k", 6260, "kg", 28797, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["5k", 6260, "lb", 28797, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["10k", 1904, "kg", 4201, 66.9, 100, 68, 100, 84, "ELITE", "ENDURANCE MACHINE"],
  ["10k", 1904, "lb", 4201, 73.3, 100, 74, 100, 87, "ELITE", "ENDURANCE MACHINE"],
  ["10k", 3019, "kg", 6661, 66.9, 62.7, 68, 64, 66, "ADVANCED", "BALANCED HYBRID"],
  ["10k", 3019, "lb", 6661, 73.3, 62.7, 74, 64, 69, "ADVANCED", "STRENGTH-LEANING HYBRID"],
  ["10k", 7479, "kg", 16502, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["10k", 7479, "lb", 16502, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["10k", 13053, "kg", 28800, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["10k", 13053, "lb", 28800, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["half", 4200, "kg", 4200, 66.9, 100, 68, 100, 84, "ELITE", "ENDURANCE MACHINE"],
  ["half", 4200, "lb", 4200, 73.3, 100, 74, 100, 87, "ELITE", "ENDURANCE MACHINE"],
  ["half", 6660, "kg", 6660, 66.9, 62.7, 68, 64, 66, "ADVANCED", "BALANCED HYBRID"],
  ["half", 6660, "lb", 6660, 73.3, 62.7, 74, 64, 69, "ADVANCED", "STRENGTH-LEANING HYBRID"],
  ["half", 16500, "kg", 16500, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["half", 16500, "lb", 16500, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["half", 28800, "kg", 28800, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["half", 28800, "lb", 28800, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["marathon", 8756, "kg", 4200, 66.9, 100, 68, 100, 84, "ELITE", "ENDURANCE MACHINE"],
  ["marathon", 8756, "lb", 4200, 73.3, 100, 74, 100, 87, "ELITE", "ENDURANCE MACHINE"],
  ["marathon", 12200, "kg", 5852, 66.9, 75, 68, 76, 72, "ADVANCED", "BALANCED HYBRID"],
  ["marathon", 12200, "lb", 5852, 73.3, 75, 74, 76, 75, "ELITE", "BALANCED HYBRID"],
  ["marathon", 25978, "kg", 12460, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["marathon", 25978, "lb", 12460, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ["marathon", 43200, "kg", 20720, 66.9, 0, 68, 0, 34, "NOVICE", "STRENGTH BEAST"],
  ["marathon", 43200, "lb", 20720, 73.3, 0, 74, 0, 37, "NOVICE", "STRENGTH BEAST"],
  ];

  const LIFTS = {
    kg: { bodyweight: 90, bench: 110, squat: 150, deadlift: 190 },
    lb: { bodyweight: 195, bench: 275, squat: 365, deadlift: 425 },
  } as const;
  const REFERENCE = Array.from({ length: 50 }, (_, i) => i * 2 + 0.5);

  it("scores every previously accepted input exactly as before", () => {
    const dataset = makeSnapshot(REFERENCE, REFERENCE);
    for (const [d, t, u, canon, si, ei, sp, ep, hybrid, tier, archetype] of GOLDEN) {
      const parsed = parseCanonicalBenchmark({
        unitSystem: u,
        ...LIFTS[u],
        runDistance: d,
        runSeconds: t,
      });
      const score = computeCanonicalScore(parsed, dataset);
      const label = `${d} ${t}s ${u}`;
      assert.equal(parsed.canonicalEnduranceSeconds, canon, label);
      assert.deepEqual(
        [
          score.strengthIndex,
          score.enduranceIndex,
          score.strengthPercentile,
          score.endurancePercentile,
          score.hybridScore,
          score.tier,
          score.archetype,
        ],
        [si, ei, sp, ep, hybrid, tier, archetype],
        label,
      );
    }
  });
});

// --- calculator pre-flight ---------------------------------------------------

function form(overrides: Partial<ScoreFormValues> = {}): ScoreFormValues {
  return {
    displayName: "Ryan",
    unitSystem: "lb",
    bodyweight: "195",
    bench: "275",
    squat: "365",
    deadlift: "425",
    runDistance: "5k",
    runSeconds: 1350,
    runTimeText: "22:30",
    visibility: submissionVisibility(true),
    ...overrides,
  };
}

describe("run-time field parsing", () => {
  it("parses m:ss and h:mm:ss", () => {
    assert.deepEqual(parseRunTime("22:30"), { ok: true, seconds: 1350 });
    assert.deepEqual(parseRunTime(" 1:05:09 "), { ok: true, seconds: 3909 });
    assert.deepEqual(parseRunTime("90:00"), { ok: true, seconds: 5400 });
  });

  for (const [text, fragment] of [
    ["22:75", "Seconds must be between 00 and 59"],
    ["22:60", "Seconds must be between 00 and 59"],
    ["1:05:60", "Seconds must be between 00 and 59"],
    ["1:75:00", "Minutes must be between 00 and 59"],
    ["0:00", "greater than zero"],
    ["22", "mm:ss or hh:mm:ss"],
    ["22:3a", "mm:ss or hh:mm:ss"],
    ["1:2:3:4", "mm:ss or hh:mm:ss"],
    ["22.5:00", "mm:ss or hh:mm:ss"],
  ] as const) {
    it(`rejects "${text}" instead of correcting it`, () => {
      const r = parseRunTime(text);
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.error.field, "run_seconds");
      assert.equal(r.error.canRetry, false);
      assert.match(r.error.message, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  }

  it("treats an empty field as missing, not malformed", () => {
    const r = parseRunTime("   ");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "MISSING_EVENT");
  });

  it("a malformed time blocks the submission with that reason", () => {
    const built = buildScoreRequestDraft(form({ runSeconds: null, runTimeText: "22:75" }));
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.equal(built.error.code, "INVALID_NUMBER");
    assert.equal(built.error.field, "run_seconds");
    assert.match(built.error.message, /Seconds must be between 00 and 59/);
  });
});

describe("missing required inputs never produce a ranked submission", () => {
  it("client pre-flight refuses each missing event", () => {
    for (const field of ["bodyweight", "bench", "squat", "deadlift"] as const) {
      const built = buildScoreRequestDraft(form({ [field]: "  " }));
      assert.equal(built.ok, false, field);
      if (!built.ok) assert.equal(built.error.code, "MISSING_EVENT", field);
    }
    for (const runTimeText of [undefined, ""]) {
      const built = buildScoreRequestDraft(form({ runSeconds: null, runTimeText }));
      assert.equal(built.ok, false);
      if (!built.ok) {
        assert.equal(built.error.code, "MISSING_EVENT");
        assert.equal(built.error.field, "run_seconds");
      }
    }
  });

  it("the server validator refuses each missing event", () => {
    const complete = { ...ATHLETE, runDistance: "5k", runSeconds: 1350 };
    for (const field of Object.keys(complete) as Array<keyof typeof complete>) {
      if (field === "unitSystem") continue;
      assert.throws(
        () => parseCanonicalBenchmark({ ...complete, [field]: undefined }),
        (err: unknown) =>
          err instanceof ScoringError && err.code === "MISSING_EVENT",
        field,
      );
    }
  });
});

describe("distance-specific range messages", () => {
  it("names the accepted window for each distance", () => {
    assert.equal(runTimeRangeText("3mi"), "3-mile: 11:00–1:40:32");
    assert.equal(runTimeRangeText("5k"), "5K: 11:40–1:44:20");
    assert.equal(runTimeRangeText("10k"), "10K: 25:00–3:37:33");
    assert.equal(runTimeRangeText("half"), "Half marathon: 55:00–8:00:00");
    assert.equal(runTimeRangeText("marathon"), "Marathon: 1:55:00–12:00:00");
  });

  it("an out-of-range time in pre-flight shows that distance's range", () => {
    const tooFast = buildScoreRequestDraft(form({ runSeconds: 699, runTimeText: "11:39" }));
    assert.equal(tooFast.ok, false);
    if (!tooFast.ok) {
      assert.equal(tooFast.error.code, "OUT_OF_RANGE");
      assert.equal(tooFast.error.message, "5K time must be between 11:40 and 1:44:20.");
    }

    const tooSlow = buildScoreRequestDraft(
      form({ runDistance: "10k", runSeconds: 13054, runTimeText: "3:37:34" }),
    );
    assert.equal(tooSlow.ok, false);
    if (!tooSlow.ok) {
      assert.equal(tooSlow.error.message, "10K time must be between 25:00 and 3:37:33.");
    }
  });

  it("a server OUT_OF_RANGE on run_seconds is described with the same range", () => {
    const e = describeScoringFailure("OUT_OF_RANGE", "", "run_seconds", "kg", "marathon");
    assert.equal(e.message, "Marathon time must be between 1:55:00 and 12:00:00.");
    assert.equal(e.canRetry, false);
  });
});
