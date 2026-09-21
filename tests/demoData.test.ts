import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalScoreFromPercentiles,
  computeEnduranceIndex,
  computeStrengthIndex,
  getArchetype,
  getTier,
  toCanonicalEnduranceSeconds,
} from "../lib/scoring/core";
import {
  DEMO,
  DEMO_INPUTS,
  DEMO_LEADERBOARD,
  DEMO_LIMITER,
} from "../components/home/demo-data";

/**
 * The homepage's worked example is a marketing constant, deliberately free of
 * any runtime dependency on the scoring engine (see the header of
 * components/home/demo-data.ts). This test is what keeps that safe: every
 * figure the engine CAN derive is re-derived here and compared.
 *
 * It exists because the two drifted in production — the page showed a Hybrid
 * Score of 64 against percentiles that produce 65.
 */

const lift = (label: string) => {
  const row = DEMO_INPUTS.strength.find((s) => s.label === label);
  assert.ok(row, `missing demo lift: ${label}`);
  return Number(row.value);
};

describe("homepage demo athlete matches the scoring engine", () => {
  it("derives the strength index from the demo lifts", () => {
    assert.equal(
      computeStrengthIndex({
        bodyweightKg: DEMO_INPUTS.bodyweightKg,
        benchKg: lift("Bench"),
        squatKg: lift("Squat"),
        deadliftKg: lift("Deadlift"),
      }),
      DEMO.strengthIndex,
    );
  });

  it("derives the endurance index from the demo 5K", () => {
    const [minutes, seconds] = DEMO_INPUTS.endurance[0].value
      .split(":")
      .map(Number);
    const canonical = toCanonicalEnduranceSeconds(minutes * 60 + seconds, "5k");

    assert.equal(computeEnduranceIndex(canonical), DEMO.enduranceIndex);
  });

  it("derives the Hybrid Score, tier and archetype from the percentiles", () => {
    assert.equal(
      canonicalScoreFromPercentiles(
        DEMO.strengthPercentile,
        DEMO.endurancePercentile,
      ),
      DEMO.hybridScore,
    );
    assert.equal(getTier(DEMO.hybridScore), DEMO.tier);
    assert.equal(
      getArchetype(DEMO.strengthPercentile, DEMO.endurancePercentile),
      DEMO.archetype,
    );
  });

  it("keeps the sentence-case profile label in step with the archetype", () => {
    assert.equal(DEMO.profile.toUpperCase(), DEMO.archetype);
  });

  it("names the lower-percentile side as the limiter", () => {
    const enduranceIsLower =
      DEMO.endurancePercentile < DEMO.strengthPercentile;

    assert.equal(DEMO_LIMITER.side, enduranceIsLower ? "Endurance" : "Strength");
    assert.equal(
      DEMO_LIMITER.gap,
      Math.abs(DEMO.strengthPercentile - DEMO.endurancePercentile),
    );
  });

  it("maps the lean position linearly onto the percentile gap", () => {
    assert.equal(
      DEMO.lean,
      50 + (DEMO.strengthPercentile - DEMO.endurancePercentile) / 2,
    );
  });

  it("places the example athlete consistently in the demo standings", () => {
    const rows = [...DEMO_LEADERBOARD];
    const you = rows.find((r) => "isYou" in r && r.isYou);
    assert.ok(you, "demo standings must contain the example athlete");
    assert.equal(you.score, DEMO.hybridScore);

    const sorted = [...rows].sort((a, b) => b.score - a.score);
    assert.deepEqual(
      rows.map((r) => r.score),
      sorted.map((r) => r.score),
      "demo standings must be ordered by score",
    );
  });
});
