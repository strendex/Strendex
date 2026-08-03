import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_VERSION,
  buildDatasetHashPayload,
  buildRequestFingerprintPayload,
  isSha256Hex,
  stableStringify,
  type RequestFingerprintInput,
} from "../lib/scoring/core";
import {
  computeDatasetHash,
  computeRequestFingerprint,
  sha256Hex,
} from "../lib/server/hashing";

const REQUEST: RequestFingerprintInput = {
  scoreVersion: SCORE_VERSION,
  displayName: "Ryan Woods",
  unitSystem: "kg",
  bodyweight: 90,
  bench: 110,
  squat: 150,
  deadlift: 190,
  runDistance: "5k",
  runSeconds: 1500,
  visibility: "private",
};

describe("stable stringify", () => {
  it("is independent of key order at every depth", () => {
    assert.equal(
      stableStringify({ b: 1, a: { d: 2, c: 3 } }),
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it("preserves array order", () => {
    assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
  });

  it("distinguishes types that would otherwise collide", () => {
    assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: "1" }));
    assert.notEqual(stableStringify(null), stableStringify("null"));
  });
});

describe("sha256 helpers", () => {
  it("produces 64 lowercase hex characters", () => {
    const digest = sha256Hex("strendex");
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.equal(isSha256Hex(digest), true);
  });

  it("recognises malformed digests", () => {
    assert.equal(isSha256Hex(""), false);
    assert.equal(isSha256Hex("A".repeat(64)), false);
    assert.equal(isSha256Hex("0".repeat(63)), false);
    assert.equal(isSha256Hex("0".repeat(65)), false);
    assert.equal(isSha256Hex(123), false);
    assert.equal(isSha256Hex(null), false);
  });
});

describe("request fingerprint", () => {
  it("is deterministic for identical inputs", () => {
    assert.equal(
      computeRequestFingerprint(REQUEST),
      computeRequestFingerprint({ ...REQUEST }),
    );
  });

  it("changes when any covered input changes", () => {
    const base = computeRequestFingerprint(REQUEST);

    const variants: Partial<RequestFingerprintInput>[] = [
      { displayName: "Someone Else" },
      { unitSystem: "lb" },
      { bodyweight: 90.5 },
      { bench: 111 },
      { squat: 151 },
      { deadlift: 191 },
      { runDistance: "10k" },
      { runSeconds: 1501 },
      { visibility: "public" },
      { scoreVersion: "9.9.9" },
    ];

    for (const variant of variants) {
      assert.notEqual(
        computeRequestFingerprint({ ...REQUEST, ...variant }),
        base,
        `expected ${Object.keys(variant)[0]} to change the fingerprint`,
      );
    }
  });

  it("covers no calculated value and no dataset id", () => {
    const payload = buildRequestFingerprintPayload(REQUEST);

    for (const forbidden of [
      "hybridScore",
      "strengthIndex",
      "enduranceIndex",
      "strengthPercentile",
      "endurancePercentile",
      "tier",
      "archetype",
      "datasetVersionId",
      "datasetHash",
    ]) {
      assert.equal(
        payload.includes(forbidden),
        false,
        `fingerprint payload must not contain ${forbidden}`,
      );
    }
  });
});

describe("dataset hash", () => {
  const strength = [10, 20, 30];
  const endurance = [40, 50, 60];
  const input = {
    scoreVersion: SCORE_VERSION,
    datasetKind: "observed" as const,
    eligibleSampleSize: 3,
    strengthReference: strength,
    enduranceReference: endurance,
  };

  it("is independent of row order", () => {
    assert.equal(
      computeDatasetHash(input),
      computeDatasetHash({
        ...input,
        strengthReference: [30, 10, 20],
        enduranceReference: [60, 40, 50],
      }),
    );
  });

  it("does not mutate the caller's arrays", () => {
    const unsorted = [30, 10, 20];
    computeDatasetHash({ ...input, strengthReference: unsorted });
    assert.deepEqual(unsorted, [30, 10, 20]);
  });

  it("changes with score version, kind, sample size, and content", () => {
    const base = computeDatasetHash(input);

    assert.notEqual(computeDatasetHash({ ...input, scoreVersion: "9.9.9" }), base);
    assert.notEqual(
      computeDatasetHash({ ...input, datasetKind: "legacy_mixed_provisional" }),
      base,
    );
    assert.notEqual(computeDatasetHash({ ...input, eligibleSampleSize: 4 }), base);
    assert.notEqual(
      computeDatasetHash({ ...input, strengthReference: [10, 20, 31] }),
      base,
    );
  });

  it("cannot collide with a request fingerprint payload", () => {
    assert.notEqual(
      buildDatasetHashPayload(input),
      buildRequestFingerprintPayload(REQUEST),
    );
    assert.ok(buildDatasetHashPayload(input).includes("strendex.dataset"));
    assert.ok(
      buildRequestFingerprintPayload(REQUEST).includes("strendex.request"),
    );
  });
});
