import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POUNDS_PER_KILOGRAM,
  RIEGEL_EXPONENT,
  RUN_DISTANCE_IDS,
  ScoringError,
  isRunDistance,
  kilogramsToPounds,
  poundsToKilograms,
  toCanonicalEnduranceSeconds,
  toKilograms,
} from "../lib/scoring/core";

describe("weight conversion", () => {
  it("uses the exact pound definition", () => {
    assert.equal(POUNDS_PER_KILOGRAM, 2.2046226218);
  });

  it("round-trips lb -> kg -> lb", () => {
    for (const lb of [45, 135, 225, 315, 405, 700]) {
      assert.ok(Math.abs(kilogramsToPounds(poundsToKilograms(lb)) - lb) < 1e-9);
    }
  });

  it("treats kg input as already canonical", () => {
    assert.equal(toKilograms(100, "kg"), 100);
    assert.equal(toKilograms(100, "lb"), 100 / POUNDS_PER_KILOGRAM);
  });

  it("rejects non-finite weights instead of clamping", () => {
    assert.throws(() => poundsToKilograms(Number.NaN), ScoringError);
    assert.throws(() => poundsToKilograms(Number.POSITIVE_INFINITY), ScoringError);
  });
});

describe("run distance conversion", () => {
  it("supports exactly the five calculator distances", () => {
    assert.deepEqual([...RUN_DISTANCE_IDS], [
      "3mi",
      "5k",
      "10k",
      "half",
      "marathon",
    ]);
    assert.equal(isRunDistance("5k"), true);
    assert.equal(isRunDistance("1mi"), false);
    assert.equal(isRunDistance(5), false);
  });

  it("preserves the Riegel exponent of 1.06", () => {
    assert.equal(RIEGEL_EXPONENT, 1.06);
  });

  it("is the identity for the canonical distance", () => {
    assert.equal(toCanonicalEnduranceSeconds(5400, "half"), 5400);
    assert.equal(toCanonicalEnduranceSeconds(4200, "half"), 4200);
  });

  // Locked-in regression values: any change to the exponent, the distance
  // metres, or the rounding will move these.
  it("converts each supported distance to half-marathon-equivalent seconds", () => {
    assert.equal(toCanonicalEnduranceSeconds(1200, "3mi"), 5729);
    assert.equal(toCanonicalEnduranceSeconds(1500, "5k"), 6900);
    assert.equal(toCanonicalEnduranceSeconds(3000, "10k"), 6619);
    assert.equal(toCanonicalEnduranceSeconds(5400, "half"), 5400);
    assert.equal(toCanonicalEnduranceSeconds(12000, "marathon"), 5756);
  });

  it("scales monotonically: a shorter distance implies a slower equivalent", () => {
    const seconds = 1800;
    const converted = RUN_DISTANCE_IDS.map((d) =>
      toCanonicalEnduranceSeconds(seconds, d),
    );
    for (let i = 1; i < converted.length; i++) {
      assert.ok(
        converted[i] < converted[i - 1],
        `${RUN_DISTANCE_IDS[i]} should convert lower than ${RUN_DISTANCE_IDS[i - 1]}`,
      );
    }
  });

  it("rejects malformed times and unknown distances", () => {
    assert.throws(() => toCanonicalEnduranceSeconds(0, "5k"), ScoringError);
    assert.throws(() => toCanonicalEnduranceSeconds(-1, "5k"), ScoringError);
    assert.throws(() => toCanonicalEnduranceSeconds(Number.NaN, "5k"), ScoringError);
    assert.throws(
      () =>
        toCanonicalEnduranceSeconds(
          1500,
          "1mi" as unknown as (typeof RUN_DISTANCE_IDS)[number],
        ),
      ScoringError,
    );
  });
});
