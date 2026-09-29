/**
 * Shared draft-dataset creation used by both dataset tools.
 *
 * Having exactly one implementation is the point: the observed builder and the
 * legacy bootstrap must produce byte-identical hashes for byte-identical
 * populations, and must apply the same integrity rules before anything is
 * written.
 *
 * This module NEVER updates, reclassifies, publishes, or deletes a submission,
 * and never activates a dataset. It inserts one `draft` row or nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MIN_DATASET_SIZE,
  REFERENCE_VALUE_BOUNDS,
  SCORE_VERSION,
  VALIDATION_BOUNDS,
  datasetConfidence,
  type DatasetKind,
} from "../../lib/scoring/core";
import { computeDatasetHash } from "../../lib/server/hashing";

/**
 * One reference index, or null when the row must be excluded as corrupt.
 *
 * The valid range is REFERENCE_VALUE_BOUNDS — 0 to 100 INCLUSIVE. An index of
 * exactly 0 is a real result (an athlete at the bottom of the scale), and the
 * scorer, the migration CHECK constraints, and prepareDraft below all already
 * accept it; excluding it here would silently bias every reference population
 * upward.
 *
 * That makes the order of these checks load-bearing. `Number(null)` is 0 and
 * `Number("")` is 0, so a missing index coerces to a perfectly valid-looking
 * zero. Null, undefined, blanks, and non-numeric types are therefore rejected
 * BEFORE any coercion — otherwise "accept exactly 0" would quietly become
 * "accept every incomplete row as a zero".
 */
export function parseReferenceIndex(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim().length === 0) return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (
    value < REFERENCE_VALUE_BOUNDS.min ||
    value > REFERENCE_VALUE_BOUNDS.max
  ) {
    return null;
  }
  return value;
}

export type ReferencePair = { strengthIndex: number; enduranceIndex: number };

/**
 * The shared per-row integrity gate, applied by BOTH builders after each has run
 * its own moderation, provenance, visibility, and completeness filters. Having
 * one implementation is what keeps `observed` and `legacy_mixed_provisional`
 * populations comparable: the same row must be eligible, or not, under either
 * tool. Returns null for a row to exclude as corrupt — it never repairs a value.
 *
 * `enduranceSeconds` is passed in because the two builders read it from
 * different columns (canonical_endurance_seconds vs the legacy
 * endurance_seconds); the bound applied to it is identical either way.
 */
export function parseReferenceRow(row: {
  strengthIndex: unknown;
  enduranceIndex: unknown;
  enduranceSeconds: unknown;
}): ReferencePair | null {
  const strengthIndex = parseReferenceIndex(row.strengthIndex);
  const enduranceIndex = parseReferenceIndex(row.enduranceIndex);
  if (strengthIndex === null || enduranceIndex === null) return null;

  const seconds =
    typeof row.enduranceSeconds === "number" ||
    (typeof row.enduranceSeconds === "string" &&
      row.enduranceSeconds.trim().length > 0)
      ? Number(row.enduranceSeconds)
      : Number.NaN;

  if (
    !Number.isFinite(seconds) ||
    seconds < VALIDATION_BOUNDS.canonicalEnduranceSeconds.min ||
    seconds > VALIDATION_BOUNDS.canonicalEnduranceSeconds.max
  ) {
    return null;
  }

  return { strengthIndex, enduranceIndex };
}

export type DraftDatasetCandidate = {
  label: string;
  kind: DatasetKind;
  strengthReference: number[];
  enduranceReference: number[];
  sourceCounts: Record<string, number>;
};

export type PreparedDraft = {
  label: string;
  kind: DatasetKind;
  scoreVersion: string;
  strengthReference: number[];
  enduranceReference: number[];
  eligibleSampleSize: number;
  confidence: ReturnType<typeof datasetConfidence>;
  datasetHash: string;
  sourceCounts: Record<string, number>;
};

export class DatasetDraftError extends Error {}

/**
 * Apply every integrity rule the database and the scorer will later enforce,
 * then compute the canonical hash. Throws rather than repairing.
 */
export function prepareDraft(
  candidate: DraftDatasetCandidate,
): PreparedDraft {
  const { strengthReference, enduranceReference } = candidate;

  if (strengthReference.length !== enduranceReference.length) {
    throw new DatasetDraftError(
      `Reference arrays differ in length (${strengthReference.length} vs ${enduranceReference.length}).`,
    );
  }

  for (const value of [...strengthReference, ...enduranceReference]) {
    if (
      !Number.isFinite(value) ||
      value < REFERENCE_VALUE_BOUNDS.min ||
      value > REFERENCE_VALUE_BOUNDS.max
    ) {
      throw new DatasetDraftError(
        "A reference value is not a finite number between 0 and 100.",
      );
    }
  }

  const eligibleSampleSize = strengthReference.length;

  if (eligibleSampleSize < MIN_DATASET_SIZE) {
    throw new DatasetDraftError(
      `${eligibleSampleSize} eligible records is below the minimum of ${MIN_DATASET_SIZE}.`,
    );
  }

  const confidence = datasetConfidence(eligibleSampleSize);

  const datasetHash = computeDatasetHash({
    scoreVersion: SCORE_VERSION,
    datasetKind: candidate.kind,
    eligibleSampleSize,
    strengthReference,
    enduranceReference,
  });

  return {
    label: candidate.label,
    kind: candidate.kind,
    scoreVersion: SCORE_VERSION,
    strengthReference,
    enduranceReference,
    eligibleSampleSize,
    confidence,
    datasetHash,
    sourceCounts: candidate.sourceCounts,
  };
}

export function printDraftSummary(
  draft: PreparedDraft,
  scanned: number,
  excluded: Record<string, number>,
): void {
  console.log("");
  console.log("Scoring dataset candidate");
  console.log("─────────────────────────────────────────────");
  console.log(`  label            ${draft.label}`);
  console.log(`  kind             ${draft.kind}`);
  console.log(`  score version    ${draft.scoreVersion}`);
  console.log(`  rows scanned     ${scanned}`);
  console.log(`  eligible sample  ${draft.eligibleSampleSize}`);
  console.log(`  confidence       ${draft.confidence}`);
  console.log(`  dataset hash     ${draft.datasetHash}`);
  console.log("");
  console.log("  eligible by provenance");
  for (const [key, count] of Object.entries(draft.sourceCounts)) {
    console.log(`    ${key.padEnd(16)} ${count}`);
  }
  console.log("");
  console.log("  excluded");
  for (const [key, count] of Object.entries(excluded)) {
    console.log(`    ${key.padEnd(16)} ${count}`);
  }
  console.log("");
}

/** Inserts exactly one DRAFT row. Never activates, never freezes. */
export async function insertDraft(
  supabase: SupabaseClient,
  draft: PreparedDraft,
): Promise<string> {
  const { data, error } = await supabase
    .from("scoring_dataset_versions")
    .insert({
      label: draft.label,
      kind: draft.kind,
      score_version: draft.scoreVersion,
      lifecycle: "draft",
      frozen: false,
      strength_reference: draft.strengthReference,
      endurance_reference: draft.enduranceReference,
      eligible_sample_size: draft.eligibleSampleSize,
      source_counts: draft.sourceCounts,
      dataset_hash: draft.datasetHash,
      confidence: draft.confidence,
    })
    .select("id")
    .single();

  if (error) {
    throw new DatasetDraftError(`Could not create draft dataset: ${error.message}`);
  }

  return String(data?.id ?? "");
}
