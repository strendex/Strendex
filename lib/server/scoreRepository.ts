// Persistence boundary for canonical scoring.
//
// Everything that talks to Postgres lives behind the ScoreRepository interface,
// so the scoring service can be exercised in tests without a database and so
// there is exactly one place where result rows are written.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DatasetConfidence,
  ModerationStatus,
  Provenance,
  RunDistance,
  ScoringDatasetSnapshot,
  UnitSystem,
  VerificationStatus,
  Visibility,
} from "@/lib/scoring/core";

export type PersistResultInput = {
  idempotencyKey: string;
  publicResultId: string;
  athleteName: string;
  bodyweightKg: number;
  benchKg: number;
  squatKg: number;
  deadliftKg: number;
  totalLiftKg: number;
  strengthRatio: number;
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
  hybridScore: number;
  tier: string;
  archetype: string;
  moderationStatus: ModerationStatus;
  visibility: Visibility;
  provenance: Provenance;
  verificationStatus: VerificationStatus;
  scoreVersion: string;
  datasetVersionId: string;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
  calculatedAt: string;
  originalUnitSystem: UnitSystem;
  originalRunDistance: RunDistance;
  originalRunSeconds: number;
  canonicalEnduranceSeconds: number;
};

/** The row as it actually exists in the database after persistence. */
export type PersistedResult = {
  publicResultId: string;
  calculatedAt: string;
  hybridScore: number;
  strengthIndex: number;
  enduranceIndex: number;
  strengthPercentile: number;
  endurancePercentile: number;
  tier: string;
  archetype: string;
  moderationStatus: ModerationStatus;
  visibility: Visibility;
  provenance: Provenance;
  verificationStatus: VerificationStatus;
  scoreVersion: string;
  datasetVersionId: string;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
};

export interface ScoreRepository {
  /** The single frozen dataset usable by this score version, if any. */
  loadActiveDataset(scoreVersion: string): Promise<ScoringDatasetSnapshot | null>;

  /**
   * Insert exactly one canonical result, or return the one already stored under
   * the same idempotency key. Atomic and safe under concurrent retries.
   */
  persistResult(
    input: PersistResultInput,
  ): Promise<{ result: PersistedResult; replayed: boolean }>;

  /** Hybrid Scores of every leaderboard-eligible row in one dataset version. */
  loadEligibleScores(datasetVersionId: string): Promise<number[]>;
}

const RESULT_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford-ish

/** Opaque, non-enumerable, 120 bits of entropy. */
export function generatePublicResultId(): string {
  const bytes = randomBytes(24);
  let out = "res_";
  for (let i = 0; i < 24; i++) {
    out += RESULT_ID_ALPHABET[bytes[i] % RESULT_ID_ALPHABET.length];
  }
  return out;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
}

type DatasetRow = {
  id: string;
  label: string;
  score_version: string;
  strength_reference: unknown;
  endurance_reference: unknown;
  eligible_sample_size: unknown;
  dataset_hash: string;
  confidence: string;
};

export class RepositoryError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RepositoryError";
    this.cause = cause;
  }
}

export function createSupabaseScoreRepository(
  supabase: SupabaseClient,
): ScoreRepository {
  return {
    async loadActiveDataset(scoreVersion) {
      const { data, error } = await supabase
        .from("scoring_dataset_versions")
        .select(
          "id,label,score_version,strength_reference,endurance_reference,eligible_sample_size,dataset_hash,confidence",
        )
        .eq("score_version", scoreVersion)
        .eq("lifecycle", "active")
        .eq("frozen", true)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new RepositoryError("Failed to load active dataset.", error);
      }
      if (!data) return null;

      const row = data as DatasetRow;

      const snapshot: ScoringDatasetSnapshot = {
        datasetVersionId: row.id,
        label: row.label,
        scoreVersion: row.score_version,
        strengthReference: toNumberArray(row.strength_reference),
        enduranceReference: toNumberArray(row.endurance_reference),
        eligibleSampleSize: toFiniteNumber(row.eligible_sample_size, 0),
        datasetHash: row.dataset_hash,
        confidence: row.confidence as DatasetConfidence,
      };

      return snapshot;
    },

    async persistResult(input) {
      const { data, error } = await supabase.rpc("score_result_insert", {
        p_payload: {
          idempotency_key: input.idempotencyKey,
          public_result_id: input.publicResultId,
          athlete_name: input.athleteName,
          bodyweight: input.bodyweightKg,
          bench: input.benchKg,
          squat: input.squatKg,
          deadlift: input.deadliftKg,
          total_lift: input.totalLiftKg,
          strength_ratio: input.strengthRatio,
          strength_index: input.strengthIndex,
          endurance_index: input.enduranceIndex,
          strength_percentile: input.strengthPercentile,
          endurance_percentile: input.endurancePercentile,
          hq_score: input.hybridScore,
          tier: input.tier,
          archetype: input.archetype,
          status: input.moderationStatus,
          visibility: input.visibility,
          provenance: input.provenance,
          verification_status: input.verificationStatus,
          score_version: input.scoreVersion,
          dataset_version_id: input.datasetVersionId,
          dataset_sample_size: input.datasetSampleSize,
          dataset_confidence: input.datasetConfidence,
          calculated_at: input.calculatedAt,
          original_unit_system: input.originalUnitSystem,
          original_run_distance: input.originalRunDistance,
          original_run_seconds: input.originalRunSeconds,
          canonical_endurance_seconds: input.canonicalEnduranceSeconds,
          endurance_seconds: input.canonicalEnduranceSeconds,
        },
      });

      if (error) {
        throw new RepositoryError("Failed to persist result.", error);
      }

      const row = (data ?? null) as Record<string, unknown> | null;
      if (!row || typeof row.public_result_id !== "string") {
        throw new RepositoryError("Persisted result was not returned.");
      }

      // The saved row is authoritative. If the key already existed, what comes
      // back is the ORIGINAL result, not the one we just tried to write.
      const result: PersistedResult = {
        publicResultId: row.public_result_id,
        calculatedAt: String(row.calculated_at ?? input.calculatedAt),
        hybridScore: toFiniteNumber(row.hq_score, input.hybridScore),
        strengthIndex: toFiniteNumber(row.strength_index, input.strengthIndex),
        enduranceIndex: toFiniteNumber(row.endurance_index, input.enduranceIndex),
        strengthPercentile: toFiniteNumber(
          row.strength_percentile,
          input.strengthPercentile,
        ),
        endurancePercentile: toFiniteNumber(
          row.endurance_percentile,
          input.endurancePercentile,
        ),
        tier: String(row.tier ?? input.tier),
        archetype: String(row.archetype ?? input.archetype),
        moderationStatus: (row.status ?? input.moderationStatus) as ModerationStatus,
        visibility: (row.visibility ?? input.visibility) as Visibility,
        provenance: (row.provenance ?? input.provenance) as Provenance,
        verificationStatus: (row.verification_status ??
          input.verificationStatus) as VerificationStatus,
        scoreVersion: String(row.score_version ?? input.scoreVersion),
        datasetVersionId: String(row.dataset_version_id ?? input.datasetVersionId),
        datasetSampleSize: toFiniteNumber(
          row.dataset_sample_size,
          input.datasetSampleSize,
        ),
        datasetConfidence: (row.dataset_confidence ??
          input.datasetConfidence) as DatasetConfidence,
      };

      return {
        result,
        replayed: result.publicResultId !== input.publicResultId,
      };
    },

    async loadEligibleScores(datasetVersionId) {
      const { data, error } = await supabase
        .from("submissions")
        .select("hq_score")
        .eq("dataset_version_id", datasetVersionId)
        .eq("status", "approved")
        .eq("visibility", "public")
        .not("hq_score", "is", null);

      if (error) {
        throw new RepositoryError("Failed to load leaderboard scores.", error);
      }

      return ((data ?? []) as { hq_score: unknown }[])
        .map((r) => Number(r.hq_score))
        .filter((n) => Number.isFinite(n));
    },
  };
}
