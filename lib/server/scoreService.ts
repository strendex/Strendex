// The canonical "score and persist" operation.
//
// One call: validate -> convert server-side -> load the immutable active
// dataset -> calculate -> persist exactly once -> read placement -> return the
// SAVED row. Nothing the client sent about scores, percentiles, conversions,
// tiers, archetypes, ranks, or moderation state is trusted or echoed back.
//
// This module knows nothing about HTTP. It takes a ScoreRepository, so it is
// fully testable without a database.

import { findBannedWord } from "@/lib/nameFilter";
import {
  DEFAULT_VISIBILITY,
  SCORE_VERSION,
  ScoringError,
  competitionRank,
  computeCanonicalScore,
  parseCanonicalBenchmark,
  parseDisplayName,
  parseIdempotencyKey,
  parseVisibility,
} from "@/lib/scoring/core";
import type {
  Archetype,
  DatasetConfidence,
  DatasetKind,
  ModerationStatus,
  Provenance,
  Tier,
  VerificationStatus,
  Visibility,
} from "@/lib/scoring/core";
import { computeRequestFingerprint } from "./hashing";
import {
  generatePublicResultId,
  type ScoreRepository,
} from "./scoreRepository";

/** Exactly the fields POST /api/score accepts. Anything else is rejected. */
export type ScoreRequestFields = {
  display_name?: unknown;
  unit_system?: unknown;
  bodyweight?: unknown;
  bench?: unknown;
  squat?: unknown;
  deadlift?: unknown;
  run_distance?: unknown;
  run_seconds?: unknown;
  visibility?: unknown;
  idempotency_key?: unknown;
};

export const SCORE_REQUEST_FIELDS = [
  "display_name",
  "unit_system",
  "bodyweight",
  "bench",
  "squat",
  "deadlift",
  "run_distance",
  "run_seconds",
  "visibility",
  "idempotency_key",
] as const;

/**
 * What the browser is allowed to see. Deliberately omits the athlete's raw
 * inputs — the original bodyweight and lifts are persisted for auditability and
 * stay server-side; echoing them back would put performance data in a response
 * body for no product reason.
 */
export type CanonicalResultView = {
  resultId: string;
  hybridScore: number;
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
  tier: Tier;
  archetype: Archetype;
  moderationStatus: ModerationStatus;
  verificationStatus: VerificationStatus;
  provenance: Provenance;
  visibility: Visibility;
  scoreVersion: string;
  datasetVersionId: string;
  /** Human-readable dataset name, for user-facing disclosure. */
  datasetLabel: string;
  /**
   * What the reference population is made of. Group 3 must surface
   * 'legacy_mixed_provisional' to the athlete as a provisional legacy mixed
   * benchmark. Raw reference arrays are never exposed.
   */
  datasetKind: DatasetKind;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
  calculatedAt: string;
  /** Present only for a leaderboard-eligible result. */
  leaderboard: { rank: number; total: number } | null;
};

export type CreateCanonicalResult = {
  result: CanonicalResultView;
  /** True when this request replayed an existing idempotency key. */
  replayed: boolean;
};

export async function createCanonicalResult(
  repository: ScoreRepository,
  fields: ScoreRequestFields,
): Promise<CreateCanonicalResult> {
  const idempotencyKey = parseIdempotencyKey(fields.idempotency_key);
  const visibility = parseVisibility(fields.visibility, DEFAULT_VISIBILITY);

  const displayName = parseDisplayName(fields.display_name);
  if (findBannedWord(displayName)) {
    throw new ScoringError(
      "INVALID_DISPLAY_NAME",
      "Please choose a different display name.",
      "display_name",
    );
  }

  const benchmark = parseCanonicalBenchmark({
    unitSystem: fields.unit_system,
    bodyweight: fields.bodyweight,
    bench: fields.bench,
    squat: fields.squat,
    deadlift: fields.deadlift,
    runDistance: fields.run_distance,
    runSeconds: fields.run_seconds,
  });

  // Fingerprint of the request's INPUTS, computed server-side from the values
  // we validated — not from anything the client labelled as a fingerprint.
  // Reusing one idempotency key for two different submissions is a conflict,
  // not a retry, and must never return the wrong athlete's result.
  const requestFingerprint = computeRequestFingerprint({
    scoreVersion: SCORE_VERSION,
    displayName,
    unitSystem: benchmark.unitSystem,
    bodyweight: benchmark.originalBodyweight,
    bench: benchmark.originalBench,
    squat: benchmark.originalSquat,
    deadlift: benchmark.originalDeadlift,
    runDistance: benchmark.runDistance,
    runSeconds: benchmark.runSeconds,
    visibility,
  });

  const dataset = await repository.loadActiveDataset(SCORE_VERSION);
  if (!dataset) {
    throw new ScoringError(
      "DATASET_UNAVAILABLE",
      "Scoring is temporarily unavailable: no active dataset.",
      "dataset",
    );
  }

  const score = computeCanonicalScore(benchmark, dataset);

  const totalLiftKg = Number(
    (benchmark.benchKg + benchmark.squatKg + benchmark.deadliftKg).toFixed(2),
  );

  const { result: saved, replayed } = await repository.persistResult({
    idempotencyKey,
    requestFingerprint,
    publicResultId: generatePublicResultId(),
    athleteName: displayName,
    bodyweightKg: Number(benchmark.bodyweightKg.toFixed(2)),
    benchKg: Number(benchmark.benchKg.toFixed(2)),
    squatKg: Number(benchmark.squatKg.toFixed(2)),
    deadliftKg: Number(benchmark.deadliftKg.toFixed(2)),
    totalLiftKg,
    strengthRatio: Number((totalLiftKg / benchmark.bodyweightKg).toFixed(2)),
    strengthIndex: score.strengthIndex,
    enduranceIndex: score.enduranceIndex,
    strengthPercentile: score.strengthPercentile,
    endurancePercentile: score.endurancePercentile,
    hybridScore: score.hybridScore,
    tier: score.tier,
    archetype: score.archetype,
    // Server-owned: the >= 90 review rule, never anything the client asked for.
    moderationStatus: score.moderationStatus,
    visibility,
    // New results are self-reported. Only a real verification process may
    // promote a row to 'reviewed' or 'verified'.
    provenance: "self_reported",
    verificationStatus: "unverified",
    scoreVersion: score.scoreVersion,
    datasetVersionId: score.datasetVersionId,
    datasetLabel: score.datasetLabel,
    datasetKind: score.datasetKind,
    datasetSampleSize: score.datasetSampleSize,
    datasetConfidence: score.datasetConfidence,
    calculatedAt: new Date().toISOString(),
    originalUnitSystem: benchmark.unitSystem,
    originalRunDistance: benchmark.runDistance,
    originalRunSeconds: benchmark.runSeconds,
    // The validated originals, straight from the canonical benchmark. NOT
    // rounded, NOT converted, and NOT read back off `fields` — after validation
    // the raw request is no longer the authority on what the athlete entered.
    // The *Kg values above are rounded for storage and cannot reproduce these.
    originalBodyweight: benchmark.originalBodyweight,
    originalBench: benchmark.originalBench,
    originalSquat: benchmark.originalSquat,
    originalDeadlift: benchmark.originalDeadlift,
    canonicalEnduranceSeconds: benchmark.canonicalEnduranceSeconds,
  });

  // Placement is derived from the SAVED row, and only when it is actually
  // eligible to appear: approved moderation plus public visibility.
  const eligible =
    saved.moderationStatus === "approved" && saved.visibility === "public";

  let leaderboard: { rank: number; total: number } | null = null;
  if (eligible) {
    const scores = await repository.loadEligibleScores(saved.datasetVersionId);
    leaderboard = {
      rank: competitionRank(scores, saved.hybridScore),
      total: scores.length,
    };
  }

  return {
    replayed,
    result: {
      resultId: saved.publicResultId,
      hybridScore: saved.hybridScore,
      strengthIndex: saved.strengthIndex,
      enduranceIndex: saved.enduranceIndex,
      strengthPercentile: saved.strengthPercentile,
      endurancePercentile: saved.endurancePercentile,
      // Already validated against TIERS / ARCHETYPES when the saved row was
      // parsed, so no cast is needed to reach the domain types.
      tier: saved.tier,
      archetype: saved.archetype,
      moderationStatus: saved.moderationStatus,
      verificationStatus: saved.verificationStatus,
      provenance: saved.provenance,
      visibility: saved.visibility,
      scoreVersion: saved.scoreVersion,
      datasetVersionId: saved.datasetVersionId,
      // Disclosure comes from the SAVED row, so a replayed result reports the
      // dataset it was actually scored against, not today's active one.
      datasetLabel: saved.datasetLabel,
      datasetKind: saved.datasetKind,
      datasetSampleSize: saved.datasetSampleSize,
      datasetConfidence: saved.datasetConfidence,
      calculatedAt: saved.calculatedAt,
      leaderboard,
    },
  };
}
