// Deterministic hash payloads.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies, and no
// crypto: this file defines exactly WHAT gets hashed, in exactly what byte
// order. The SHA-256 itself lives in lib/server/hashing.ts so the domain stays
// runtime-agnostic and so there is precisely one canonical payload format.
//
// Two payloads exist and they must never be confused:
//
//   request fingerprint — identifies the INPUTS of a scoring request, so a
//     replayed idempotency key can be proven to describe the same submission.
//     Deliberately excludes every calculated value and the dataset id: the same
//     inputs must fingerprint identically no matter what they score.
//
//   dataset hash — identifies the CONTENT of a reference population, so a
//     stored dataset can be proven not to have drifted since it was frozen.

import { SHA256_HEX_PATTERN } from "./constants";
import type { DatasetKind, RunDistance, UnitSystem, Visibility } from "./types";

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_PATTERN.test(value);
}

/**
 * JSON with object keys emitted in sorted order at every depth, so two
 * structurally equal values always serialise to the same string.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return `{${entries.join(",")}}`;
}

export type RequestFingerprintInput = {
  scoreVersion: string;
  displayName: string;
  unitSystem: UnitSystem;
  /** Original, pre-conversion values exactly as submitted. */
  bodyweight: number;
  bench: number;
  squat: number;
  deadlift: number;
  runDistance: RunDistance;
  runSeconds: number;
  visibility: Visibility;
};

/**
 * Canonical payload for a request fingerprint.
 *
 * Contains the normalised display name, the ORIGINAL unit system and inputs,
 * the run distance and time, the requested visibility, and the score version.
 * Contains no percentile, index, Hybrid Score, tier, archetype, or dataset id —
 * a fingerprint describes what was asked for, never what came back.
 */
export function buildRequestFingerprintPayload(
  input: RequestFingerprintInput,
): string {
  return stableStringify({
    v: 1,
    kind: "strendex.request",
    scoreVersion: input.scoreVersion,
    displayName: input.displayName,
    unitSystem: input.unitSystem,
    bodyweight: input.bodyweight,
    bench: input.bench,
    squat: input.squat,
    deadlift: input.deadlift,
    runDistance: input.runDistance,
    runSeconds: input.runSeconds,
    visibility: input.visibility,
  });
}

export type DatasetHashInput = {
  scoreVersion: string;
  datasetKind: DatasetKind;
  eligibleSampleSize: number;
  strengthReference: number[];
  enduranceReference: number[];
};

/**
 * Canonical payload for a dataset hash: scoring version, dataset kind, eligible
 * sample size, and BOTH reference arrays sorted ascending. Sorting makes the
 * hash independent of row order, so the same eligible population always hashes
 * the same way.
 */
export function buildDatasetHashPayload(input: DatasetHashInput): string {
  return stableStringify({
    v: 1,
    kind: "strendex.dataset",
    scoreVersion: input.scoreVersion,
    datasetKind: input.datasetKind,
    eligibleSampleSize: input.eligibleSampleSize,
    strength: [...input.strengthReference].sort((a, b) => a - b),
    endurance: [...input.enduranceReference].sort((a, b) => a - b),
  });
}
