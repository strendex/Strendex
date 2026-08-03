import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_WEIGHTS,
  STRENGTH_RATIO_THRESHOLDS,
  canonicalScoreFromPercentiles,
  competitionRank,
  computeEnduranceIndex,
  computeStrengthIndex,
  datasetConfidence,
  getArchetype,
  getTier,
  percentileMidrank,
  strengthScoreFromRatio,
} from "../lib/scoring/core";

const BENCH = STRENGTH_RATIO_THRESHOLDS.bench;

describe("piecewise strength curve", () => {
  it("anchors exactly on each threshold", () => {
    const f = (r: number) =>
      strengthScoreFromRatio(r, BENCH.mid, BENCH.strong, BENCH.elite);

    assert.equal(f(0), 0);
    assert.equal(f(-1), 0);
    assert.equal(f(BENCH.mid), 40);
    assert.equal(f(BENCH.strong), 70);
    assert.equal(f(BENCH.elite), 95);
  });

  it("interpolates linearly inside each segment", () => {
    const f = (r: number) =>
      strengthScoreFromRatio(r, BENCH.mid, BENCH.strong, BENCH.elite);

    assert.equal(f(0.375), 20);
    assert.equal(f(1.0), 55);
    assert.equal(f(1.5), 82.5);
  });

  it("caps the elite tail at 100", () => {
    const f = (r: number) =>
      strengthScoreFromRatio(r, BENCH.mid, BENCH.strong, BENCH.elite);

    assert.equal(f(BENCH.elite + 0.25), 97.5);
    assert.equal(f(BENCH.elite + 0.5), 100);
    assert.equal(f(BENCH.elite + 5), 100);
  });

  it("averages the entered lifts", () => {
    // ratios 0.75 / 1.00 / 1.25 sit on each lift's `mid` anchor -> 40 each.
    assert.equal(
      computeStrengthIndex({
        bodyweightKg: 100,
        benchKg: 75,
        squatKg: 100,
        deadliftKg: 125,
      }),
      40,
    );
  });
});

describe("endurance index", () => {
  it("anchors on the 1:10:00 and 3:00:00 bounds", () => {
    assert.equal(computeEnduranceIndex(4200), 100);
    assert.equal(computeEnduranceIndex(10800), 0);
    assert.equal(computeEnduranceIndex(7500), 50);
  });

  it("clamps outside the anchors rather than going negative", () => {
    assert.equal(computeEnduranceIndex(3000), 100);
    assert.equal(computeEnduranceIndex(20000), 0);
  });
});

describe("percentile (midrank)", () => {
  const population = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("splits ties down the middle", () => {
    assert.equal(percentileMidrank(population, 5), 45);
  });

  it("handles the extremes exactly", () => {
    assert.equal(percentileMidrank(population, 11), 100);
    assert.equal(percentileMidrank(population, 0), 0);
  });

  it("weights repeated values by their share", () => {
    assert.equal(percentileMidrank([5, 5, 5, 5], 5), 50);
    assert.equal(percentileMidrank([1, 5, 5, 9], 5), 50);
  });

  it("returns 50 for an empty population", () => {
    assert.equal(percentileMidrank([], 42), 50);
  });

  it("ignores non-finite members", () => {
    assert.equal(
      percentileMidrank([1, 2, Number.NaN, Number.POSITIVE_INFINITY, 3], 2),
      percentileMidrank([1, 2, 3], 2),
    );
  });
});

describe("Hybrid Score", () => {
  it("is an exact 50/50 blend", () => {
    assert.equal(SCORE_WEIGHTS.strength, 0.5);
    assert.equal(SCORE_WEIGHTS.endurance, 0.5);
    assert.equal(canonicalScoreFromPercentiles(80, 60), 70);
    assert.equal(canonicalScoreFromPercentiles(100, 0), 50);
    assert.equal(canonicalScoreFromPercentiles(0, 0), 0);
    assert.equal(canonicalScoreFromPercentiles(100, 100), 100);
  });

  it("never lets one axis exceed the 0-100 envelope", () => {
    assert.equal(canonicalScoreFromPercentiles(400, 100), 100);
    assert.equal(canonicalScoreFromPercentiles(-50, 0), 0);
  });
});

describe("tier boundaries", () => {
  it("switches on the documented thresholds", () => {
    assert.equal(getTier(90), "WORLD CLASS");
    assert.equal(getTier(89), "ELITE");
    assert.equal(getTier(75), "ELITE");
    assert.equal(getTier(74), "ADVANCED");
    assert.equal(getTier(60), "ADVANCED");
    assert.equal(getTier(59), "INTERMEDIATE");
    assert.equal(getTier(40), "INTERMEDIATE");
    assert.equal(getTier(39), "NOVICE");
    assert.equal(getTier(0), "NOVICE");
  });
});

describe("archetype boundaries", () => {
  it("classifies each boundary case", () => {
    assert.equal(getArchetype(9.9, 9.9), "BASE BUILDER");
    assert.equal(getArchetype(9, 11), "BALANCED HYBRID");
    assert.equal(getArchetype(75, 75), "POWER HYBRID");
    assert.equal(getArchetype(50, 30), "STRENGTH BEAST");
    assert.equal(getArchetype(30, 50), "ENDURANCE MACHINE");
    assert.equal(getArchetype(50, 42), "BALANCED HYBRID");
    assert.equal(getArchetype(50, 41), "STRENGTH-LEANING HYBRID");
    assert.equal(getArchetype(41, 50), "ENDURANCE-LEANING HYBRID");
  });

  it("prefers POWER HYBRID over a raw diff when both axes are high", () => {
    assert.equal(getArchetype(99, 75), "POWER HYBRID");
  });
});

describe("competition ranking", () => {
  it("produces 1, 2, 2, 4 for a tie", () => {
    const scores = [90, 80, 80, 70];
    assert.deepEqual(
      scores.map((s) => competitionRank(scores, s)),
      [1, 2, 2, 4],
    );
  });

  it("gives every member of a full tie first place", () => {
    const scores = [50, 50, 50];
    assert.deepEqual(
      scores.map((s) => competitionRank(scores, s)),
      [1, 1, 1],
    );
  });

  it("ranks first in an empty field", () => {
    assert.equal(competitionRank([], 42), 1);
  });

  it("ignores non-finite members", () => {
    assert.equal(competitionRank([Number.NaN, 10, 30], 20), 2);
  });
});

describe("dataset confidence", () => {
  it("steps at the documented sample sizes", () => {
    assert.equal(datasetConfidence(30), "provisional");
    assert.equal(datasetConfidence(249), "provisional");
    assert.equal(datasetConfidence(250), "established");
    assert.equal(datasetConfidence(999), "established");
    assert.equal(datasetConfidence(1000), "high");
  });
});
