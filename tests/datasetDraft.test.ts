import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  MIN_DATASET_SIZE,
  REFERENCE_VALUE_BOUNDS,
  VALIDATION_BOUNDS,
  type DatasetKind,
} from "../lib/scoring/core";
import { computeDatasetHash } from "../lib/server/hashing";
import {
  DatasetDraftError,
  parseReferenceIndex,
  parseReferenceRow,
  prepareDraft,
} from "../scripts/lib/datasetDraft";

const VALID_SECONDS = VALIDATION_BOUNDS.canonicalEnduranceSeconds.min + 1000;

describe("reference index eligibility", () => {
  it("keeps the inclusive bounds, including exactly zero", () => {
    assert.equal(parseReferenceIndex(0), 0);
    assert.equal(parseReferenceIndex(REFERENCE_VALUE_BOUNDS.min), 0);
    assert.equal(parseReferenceIndex(100), 100);
    assert.equal(parseReferenceIndex(REFERENCE_VALUE_BOUNDS.max), 100);
    assert.equal(parseReferenceIndex(50.5), 50.5);
  });

  it("rejects values just outside the bounds", () => {
    assert.equal(parseReferenceIndex(-0.0001), null);
    assert.equal(parseReferenceIndex(-1), null);
    assert.equal(parseReferenceIndex(100.0001), null);
    assert.equal(parseReferenceIndex(101), null);
  });

  it("rejects absent values instead of coercing them to a zero index", () => {
    // Number(null) and Number("") are both 0. Now that 0 is a legitimate index,
    // these must be rejected before coercion or every incomplete row would
    // enter the population as a bottom-of-the-scale athlete.
    for (const absent of [null, undefined, "", "   ", "\n"]) {
      assert.equal(parseReferenceIndex(absent), null, `${JSON.stringify(absent)}`);
    }
  });

  it("rejects non-numeric and non-finite values", () => {
    for (const bad of [
      "abc",
      "50abc",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      true,
      false,
      [],
      [50],
      {},
      () => 50,
    ]) {
      assert.equal(parseReferenceIndex(bad), null, `${String(bad)}`);
    }
  });

  it("accepts the numeric-as-string form a driver may return", () => {
    assert.equal(parseReferenceIndex("0"), 0);
    assert.equal(parseReferenceIndex("100"), 100);
    assert.equal(parseReferenceIndex("66.9"), 66.9);
  });
});

describe("reference row eligibility", () => {
  function row(overrides: Record<string, unknown> = {}) {
    return {
      strengthIndex: 66.9,
      enduranceIndex: 59.1,
      enduranceSeconds: VALID_SECONDS,
      ...overrides,
    };
  }

  it("keeps a row whose indices are exactly zero", () => {
    assert.deepEqual(
      parseReferenceRow(row({ strengthIndex: 0, enduranceIndex: 0 })),
      { strengthIndex: 0, enduranceIndex: 0 },
    );
  });

  it("keeps a row whose indices are exactly one hundred", () => {
    assert.deepEqual(
      parseReferenceRow(row({ strengthIndex: 100, enduranceIndex: 100 })),
      { strengthIndex: 100, enduranceIndex: 100 },
    );
  });

  it("keeps a mixed zero/hundred row without transposing the two indices", () => {
    assert.deepEqual(
      parseReferenceRow(row({ strengthIndex: 0, enduranceIndex: 100 })),
      { strengthIndex: 0, enduranceIndex: 100 },
    );
  });

  it("excludes a row with either index unusable", () => {
    for (const bad of [
      { strengthIndex: null },
      { strengthIndex: -1 },
      { strengthIndex: 101 },
      { strengthIndex: Number.NaN },
      { enduranceIndex: null },
      { enduranceIndex: -0.5 },
      { enduranceIndex: 100.5 },
      { enduranceIndex: Number.POSITIVE_INFINITY },
    ]) {
      assert.equal(parseReferenceRow(row(bad)), null, JSON.stringify(bad));
    }
  });

  it("excludes a row whose endurance seconds are missing or out of range", () => {
    for (const bad of [
      { enduranceSeconds: null },
      { enduranceSeconds: undefined },
      { enduranceSeconds: "" },
      { enduranceSeconds: "fast" },
      { enduranceSeconds: 0 },
      { enduranceSeconds: Number.NaN },
      { enduranceSeconds: VALIDATION_BOUNDS.canonicalEnduranceSeconds.min - 1 },
      { enduranceSeconds: VALIDATION_BOUNDS.canonicalEnduranceSeconds.max + 1 },
    ]) {
      assert.equal(parseReferenceRow(row(bad)), null, JSON.stringify(bad));
    }
  });

  it("keeps the exact endurance-second bounds", () => {
    for (const seconds of [
      VALIDATION_BOUNDS.canonicalEnduranceSeconds.min,
      VALIDATION_BOUNDS.canonicalEnduranceSeconds.max,
    ]) {
      assert.ok(parseReferenceRow(row({ enduranceSeconds: seconds })));
    }
  });
});

describe("draft construction with boundary values", () => {
  /** A population of exactly MIN_DATASET_SIZE that includes 0 and 100. */
  function population(): { strength: number[]; endurance: number[] } {
    const filler = MIN_DATASET_SIZE - 2;
    return {
      strength: [0, 100, ...Array.from({ length: filler }, (_, i) => i + 1)],
      endurance: [0, 100, ...Array.from({ length: filler }, (_, i) => i + 2)],
    };
  }

  for (const kind of ["observed", "legacy_mixed_provisional"] as DatasetKind[]) {
    it(`retains a zero index in a ${kind} population`, () => {
      const { strength, endurance } = population();

      const draft = prepareDraft({
        label: `${kind} boundary population`,
        kind,
        strengthReference: strength,
        enduranceReference: endurance,
        sourceCounts: {},
      });

      assert.equal(draft.kind, kind);
      assert.equal(draft.eligibleSampleSize, MIN_DATASET_SIZE);
      assert.ok(draft.strengthReference.includes(0), "zero was dropped");
      assert.ok(draft.enduranceReference.includes(0), "zero was dropped");
      assert.ok(draft.strengthReference.includes(100));
      assert.ok(draft.enduranceReference.includes(100));
    });

    it(`hashes a ${kind} population containing zero deterministically`, () => {
      const { strength, endurance } = population();

      const draft = prepareDraft({
        label: `${kind} boundary population`,
        kind,
        strengthReference: strength,
        enduranceReference: endurance,
        sourceCounts: {},
      });

      assert.equal(
        draft.datasetHash,
        computeDatasetHash({
          scoreVersion: draft.scoreVersion,
          datasetKind: kind,
          eligibleSampleSize: MIN_DATASET_SIZE,
          strengthReference: strength,
          enduranceReference: endurance,
        }),
      );
    });
  }

  it("changes the hash when a previously excluded zero joins the population", () => {
    // The whole point of the fix: a population that kept its zeros is a
    // different population, and must hash differently, from one that dropped
    // them. Zeros are not cosmetic.
    const withoutZero = Array.from({ length: MIN_DATASET_SIZE }, (_, i) => i + 1);
    const withZero = [0, ...withoutZero.slice(1)];

    const a = prepareDraft({
      label: "a",
      kind: "observed",
      strengthReference: withoutZero,
      enduranceReference: withoutZero,
      sourceCounts: {},
    });
    const b = prepareDraft({
      label: "b",
      kind: "observed",
      strengthReference: withZero,
      enduranceReference: withZero,
      sourceCounts: {},
    });

    assert.notEqual(a.datasetHash, b.datasetHash);
  });

  it("still refuses a population below the minimum or out of bounds", () => {
    assert.throws(
      () =>
        prepareDraft({
          label: "too small",
          kind: "observed",
          strengthReference: [0, 1, 2],
          enduranceReference: [0, 1, 2],
          sourceCounts: {},
        }),
      DatasetDraftError,
    );

    assert.throws(
      () =>
        prepareDraft({
          label: "out of bounds",
          kind: "observed",
          strengthReference: Array.from({ length: MIN_DATASET_SIZE }, () => 101),
          enduranceReference: Array.from({ length: MIN_DATASET_SIZE }, () => 50),
          sourceCounts: {},
        }),
      DatasetDraftError,
    );
  });
});

describe("both builders share the eligibility gate", () => {
  // A regression guard: the zero-exclusion bug existed independently in two
  // copies of the same predicate. If either builder grows its own again, this
  // fails before the datasets silently diverge.
  const BUILDERS = [
    "scripts/createScoringDatasetVersion.ts",
    "scripts/bootstrapLegacyDatasetVersion.ts",
  ];

  for (const path of BUILDERS) {
    it(`${path} uses the shared gate and no local index predicate`, () => {
      const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

      assert.ok(
        source.includes("parseReferenceRow"),
        "builder must use the shared eligibility gate",
      );
      assert.equal(
        /isValidIndex/.test(source),
        false,
        "builder must not reintroduce a local index predicate",
      );
      assert.equal(
        /\bn\s*>\s*0\b/.test(source),
        false,
        "builder must not reintroduce a zero-excluding bound",
      );
    });
  }
});
