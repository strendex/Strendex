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
  datasetConfidence,
  type DatasetKind,
} from "../../lib/scoring/core";
import { computeDatasetHash } from "../../lib/server/hashing";

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
