import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POUNDS_PER_KILOGRAM,
  ScoringError,
  hasOnlyAllowedKeys,
  isPlainObject,
  parseCanonicalBenchmark,
  parseDisplayName,
  parseIdempotencyKey,
  parseVisibility,
  type ScoringErrorCode,
} from "../lib/scoring/core";

type BenchmarkArgs = Parameters<typeof parseCanonicalBenchmark>[0];

const COMPLETE_KG: BenchmarkArgs = {
  unitSystem: "kg",
  bodyweight: 90,
  bench: 110,
  squat: 150,
  deadlift: 190,
  runDistance: "5k",
  runSeconds: 1500,
};

function expectCode(args: BenchmarkArgs, code: ScoringErrorCode) {
  assert.throws(
    () => parseCanonicalBenchmark(args),
    (err: unknown) => {
      assert.ok(err instanceof ScoringError, "expected a ScoringError");
      assert.equal(err.code, code);
      return true;
    },
  );
}

describe("complete benchmark requirement", () => {
  it("accepts a full benchmark", () => {
    const parsed = parseCanonicalBenchmark(COMPLETE_KG);
    assert.equal(parsed.bodyweightKg, 90);
    assert.equal(parsed.runDistance, "5k");
    assert.equal(parsed.canonicalEnduranceSeconds, 6900);
  });

  it("rejects every missing event rather than scoring it as zero", () => {
    for (const field of [
      "bodyweight",
      "bench",
      "squat",
      "deadlift",
      "runDistance",
      "runSeconds",
    ] as const) {
      expectCode({ ...COMPLETE_KG, [field]: null } as BenchmarkArgs, "MISSING_EVENT");
      expectCode(
        { ...COMPLETE_KG, [field]: undefined } as BenchmarkArgs,
        "MISSING_EVENT",
      );
    }
  });
});

describe("LB / KG equivalence", () => {
  it("produces identical canonical values from either unit system", () => {
    const lb = parseCanonicalBenchmark({
      unitSystem: "lb",
      bodyweight: 200,
      bench: 225,
      squat: 315,
      deadlift: 405,
      runDistance: "5k",
      runSeconds: 1500,
    });

    const kg = parseCanonicalBenchmark({
      unitSystem: "kg",
      bodyweight: 200 / POUNDS_PER_KILOGRAM,
      bench: 225 / POUNDS_PER_KILOGRAM,
      squat: 315 / POUNDS_PER_KILOGRAM,
      deadlift: 405 / POUNDS_PER_KILOGRAM,
      runDistance: "5k",
      runSeconds: 1500,
    });

    // Everything downstream of conversion must be bit-identical…
    assert.equal(lb.bodyweightKg, kg.bodyweightKg);
    assert.equal(lb.benchKg, kg.benchKg);
    assert.equal(lb.squatKg, kg.squatKg);
    assert.equal(lb.deadliftKg, kg.deadliftKg);
    assert.equal(lb.canonicalEnduranceSeconds, kg.canonicalEnduranceSeconds);
    assert.equal(lb.runDistance, kg.runDistance);
    assert.equal(lb.runSeconds, kg.runSeconds);
  });

  it("preserves the original pre-conversion inputs verbatim", () => {
    const lb = parseCanonicalBenchmark({
      unitSystem: "lb",
      bodyweight: 200,
      bench: 225,
      squat: 315,
      deadlift: 405,
      runDistance: "5k",
      runSeconds: 1500,
    });

    // The request fingerprint is built from these, so they must be exactly what
    // was submitted — not the converted kilograms.
    assert.equal(lb.originalBodyweight, 200);
    assert.equal(lb.originalBench, 225);
    assert.equal(lb.originalSquat, 315);
    assert.equal(lb.originalDeadlift, 405);
    assert.notEqual(lb.originalBodyweight, lb.bodyweightKg);
  });

  it("records the original unit system for provenance", () => {
    assert.equal(
      parseCanonicalBenchmark({ ...COMPLETE_KG, unitSystem: "kg" }).unitSystem,
      "kg",
    );
  });
});

describe("boundary and malformed input", () => {
  it("accepts the exact validation bounds", () => {
    assert.ok(parseCanonicalBenchmark({ ...COMPLETE_KG, bodyweight: 36, bench: 20, squat: 20, deadlift: 20 }));
    assert.ok(
      parseCanonicalBenchmark({
        ...COMPLETE_KG,
        bodyweight: 181,
        bench: 318,
        squat: 409,
        deadlift: 454,
      }),
    );
  });

  it("rejects values just outside the bounds instead of clamping", () => {
    expectCode({ ...COMPLETE_KG, bodyweight: 35.9 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, bodyweight: 181.1 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, bench: 19.9 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, bench: 318.1 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, squat: 409.1 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, deadlift: 454.1 }, "OUT_OF_RANGE");
  });

  it("rejects NaN, Infinity, negatives, and non-numbers", () => {
    expectCode({ ...COMPLETE_KG, bench: Number.NaN }, "INVALID_NUMBER");
    expectCode(
      { ...COMPLETE_KG, bench: Number.POSITIVE_INFINITY },
      "INVALID_NUMBER",
    );
    expectCode({ ...COMPLETE_KG, bench: "110" }, "INVALID_NUMBER");
    expectCode({ ...COMPLETE_KG, bench: -110 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, bench: 0 }, "OUT_OF_RANGE");
  });

  it("rejects implausible lift-to-bodyweight ratios", () => {
    expectCode({ ...COMPLETE_KG, bodyweight: 50, bench: 200 }, "IMPLAUSIBLE_RATIO");
    expectCode({ ...COMPLETE_KG, bodyweight: 50, squat: 250 }, "IMPLAUSIBLE_RATIO");
    expectCode(
      { ...COMPLETE_KG, bodyweight: 50, deadlift: 300 },
      "IMPLAUSIBLE_RATIO",
    );
  });

  it("rejects unsupported units and distances", () => {
    expectCode({ ...COMPLETE_KG, unitSystem: "stone" }, "UNSUPPORTED_UNIT_SYSTEM");
    expectCode({ ...COMPLETE_KG, unitSystem: null }, "UNSUPPORTED_UNIT_SYSTEM");
    expectCode({ ...COMPLETE_KG, runDistance: "1mi" }, "UNSUPPORTED_DISTANCE");
  });

  it("rejects run times outside the canonical endurance window", () => {
    // 800s over 5K converts to ~3680s equivalent — faster than the 4200s floor.
    expectCode({ ...COMPLETE_KG, runSeconds: 800 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, runSeconds: 9000 }, "OUT_OF_RANGE");
    expectCode({ ...COMPLETE_KG, runSeconds: 1500.5 }, "INVALID_NUMBER");
  });
});

describe("request field parsing", () => {
  it("defaults visibility to private", () => {
    assert.equal(parseVisibility(undefined, "private"), "private");
    assert.equal(parseVisibility(null, "private"), "private");
    assert.equal(parseVisibility("public", "private"), "public");
    assert.equal(parseVisibility("unlisted", "private"), "unlisted");
    assert.throws(() => parseVisibility("everyone", "private"), ScoringError);
  });

  it("requires a well-formed idempotency key", () => {
    assert.equal(parseIdempotencyKey("  abcd1234  "), "abcd1234");
    assert.throws(() => parseIdempotencyKey("short"), ScoringError);
    assert.throws(() => parseIdempotencyKey("has spaces!"), ScoringError);
    assert.throws(() => parseIdempotencyKey(12345678), ScoringError);
    assert.throws(() => parseIdempotencyKey("x".repeat(129)), ScoringError);
  });

  it("normalises display names and falls back safely", () => {
    assert.equal(parseDisplayName("  Ryan   Woods "), "Ryan Woods");
    assert.equal(parseDisplayName(""), "Anonymous Athlete");
    assert.equal(parseDisplayName(null), "Anonymous Athlete");
    assert.equal(parseDisplayName("x".repeat(200)).length, 60);
    assert.throws(() => parseDisplayName("R"), ScoringError);
    assert.throws(() => parseDisplayName(42), ScoringError);
  });

  it("recognises plain objects and unexpected keys", () => {
    assert.equal(isPlainObject({}), true);
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(hasOnlyAllowedKeys({ a: 1 }, ["a", "b"]), true);
    assert.equal(hasOnlyAllowedKeys({ a: 1, c: 1 }, ["a", "b"]), false);
  });
});
