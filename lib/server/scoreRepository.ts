// Persistence boundary for canonical scoring.
//
// Everything that talks to Postgres lives behind the ScoreRepository interface,
// so the scoring service can be exercised in tests without a database and so
// there is exactly one place where result rows are written.
//
// FAIL-CLOSED PARSING: nothing read back from the database is patched up with
// the value we tried to write. If a persisted field is missing, malformed, out
// of range, or of the wrong type, that is a RepositoryError and a 500 — never a
// quietly substituted input. The stored row is the only authority on what was
// stored.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ARCHETYPES,
  DATASET_CONFIDENCE_TIERS,
  DATASET_KINDS,
  MODERATION_STATUSES,
  PROVENANCES,
  REFERENCE_VALUE_BOUNDS,
  ScoringError,
  TIERS,
  UNIT_SYSTEMS,
  VERIFICATION_STATUSES,
  VISIBILITIES,
  isSha256Hex,
} from "@/lib/scoring/core";
import type {
  Archetype,
  DatasetConfidence,
  DatasetKind,
  ModerationStatus,
  Provenance,
  RunDistance,
  ScoringDatasetSnapshot,
  Tier,
  UnitSystem,
  VerificationStatus,
  Visibility,
} from "@/lib/scoring/core";
import { computeDatasetHash } from "./hashing";

/**
 * Sanity ceiling for a weight in the athlete's ORIGINAL unit system. It mirrors
 * the submissions_original_*_positive CHECK constraints in
 * 20260802_02_submissions_result_governance.sql and exists only to reject
 * absurd or non-real values — NOT to re-validate the athlete's numbers, which
 * VALIDATION_BOUNDS does in kilograms once the unit system is known. A kg bound
 * cannot be applied here: 198 is a valid lb bodyweight and an impossible kg one.
 */
const ORIGINAL_WEIGHT_MAX = 2000;

export type PersistResultInput = {
  idempotencyKey: string;
  requestFingerprint: string;
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
  tier: Tier;
  archetype: Archetype;
  moderationStatus: ModerationStatus;
  visibility: Visibility;
  provenance: Provenance;
  verificationStatus: VerificationStatus;
  scoreVersion: string;
  datasetVersionId: string;
  datasetLabel: string;
  datasetKind: DatasetKind;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
  calculatedAt: string;
  originalUnitSystem: UnitSystem;
  originalRunDistance: RunDistance;
  originalRunSeconds: number;
  /**
   * The weights EXACTLY as the athlete submitted them, in `originalUnitSystem`.
   * The *Kg fields above are server-derived and rounded to 2dp, so they cannot
   * reproduce these, and the request fingerprint is a one-way hash. These are
   * the only record of the raw submission — pass them through unrounded and
   * never recompute them from kilograms.
   */
  originalBodyweight: number;
  originalBench: number;
  originalSquat: number;
  originalDeadlift: number;
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
  tier: Tier;
  archetype: Archetype;
  moderationStatus: ModerationStatus;
  visibility: Visibility;
  provenance: Provenance;
  verificationStatus: VerificationStatus;
  scoreVersion: string;
  datasetVersionId: string;
  datasetLabel: string;
  datasetKind: DatasetKind;
  datasetSampleSize: number;
  datasetConfidence: DatasetConfidence;
  /**
   * Read back from the STORED row, so what was actually persisted can be proven
   * rather than assumed. Server-internal: these never reach CanonicalResultView
   * and are never returned to a browser.
   */
  originalUnitSystem: UnitSystem;
  originalBodyweight: number;
  originalBench: number;
  originalSquat: number;
  originalDeadlift: number;
};

export interface ScoreRepository {
  /** The single frozen dataset usable by this score version, if any. */
  loadActiveDataset(scoreVersion: string): Promise<ScoringDatasetSnapshot | null>;

  /**
   * Insert exactly one canonical result, or return the one already stored under
   * the same idempotency key WHEN it describes the same request. Atomic and safe
   * under concurrent retries. Throws a ScoringError with code
   * IDEMPOTENCY_CONFLICT if the key was reused for different inputs.
   */
  persistResult(
    input: PersistResultInput,
  ): Promise<{ result: PersistedResult; replayed: boolean }>;

  /** Hybrid Scores of every leaderboard-eligible row in one dataset version. */
  loadEligibleScores(datasetVersionId: string): Promise<number[]>;
}

export class RepositoryError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RepositoryError";
    this.cause = cause;
  }
}

const RESULT_ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford-ish
const RESULT_ID_PATTERN = /^res_[0-9abcdefghjkmnpqrstvwxyz]{24}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres error signalling that an idempotency key was reused with a different
 * request fingerprint. Raised by public.score_result_insert.
 */
const IDEMPOTENCY_CONFLICT_SQLSTATE = "P0409";
const IDEMPOTENCY_CONFLICT_TOKEN = "STRENDEX_IDEMPOTENCY_CONFLICT";

/** Opaque, non-enumerable, 120 bits of entropy. */
export function generatePublicResultId(): string {
  const bytes = randomBytes(24);
  let out = "res_";
  for (let i = 0; i < 24; i++) {
    out += RESULT_ID_ALPHABET[bytes[i] % RESULT_ID_ALPHABET.length];
  }
  return out;
}

// --- Strict readers. Each one throws rather than guessing. ---------------------

function fail(field: string, why: string): never {
  // Field name and reason only: never the offending value.
  throw new RepositoryError(`Persisted field "${field}" ${why}.`);
}

function readString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    fail(field, "is missing or not a string");
  }
  return value;
}

function readEnum<T extends string>(
  row: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = readString(row, field);
  if (!(allowed as readonly string[]).includes(value)) {
    fail(field, "is not a recognised value");
  }
  return value as T;
}

function readBoundedNumber(
  row: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const raw = row[field];
  if (typeof raw !== "number" && typeof raw !== "string") {
    fail(field, "is missing or not numeric");
  }
  // Number("") and Number("   ") are 0, which would turn a blank column into a
  // perfectly valid-looking zero. Reject before coercion.
  if (typeof raw === "string" && raw.trim().length === 0) {
    fail(field, "is missing or not numeric");
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(field, "is not a finite number");
  if (value < min || value > max) fail(field, "is outside its valid range");
  return value;
}

/** A quantity that must be strictly greater than zero, e.g. a lifted weight. */
function readPositiveNumber(
  row: Record<string, unknown>,
  field: string,
  max: number,
): number {
  const value = readBoundedNumber(row, field, 0, max);
  if (value <= 0) fail(field, "is not greater than zero");
  return value;
}

function readInteger(
  row: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const value = readBoundedNumber(row, field, min, max);
  if (!Number.isInteger(value)) fail(field, "is not an integer");
  return value;
}

function readTimestamp(row: Record<string, unknown>, field: string): string {
  const value = readString(row, field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(field, "is not a valid timestamp");
  return new Date(parsed).toISOString();
}

function readUuid(row: Record<string, unknown>, field: string): string {
  const value = readString(row, field);
  if (!UUID_PATTERN.test(value)) fail(field, "is not a valid UUID");
  return value.toLowerCase();
}

function readBoolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") fail(field, "is missing or not a boolean");
  return value;
}

/**
 * A dataset that cannot be read is a corrupt dataset, not a server bug: it maps
 * to DATASET_CORRUPT / 503 so the caller learns scoring is unavailable rather
 * than getting an opaque 500.
 */
function datasetCorrupt(detail: string): never {
  throw new ScoringError(
    "DATASET_CORRUPT",
    `The active scoring dataset failed its integrity check (${detail}).`,
    "dataset",
  );
}

function readReferenceArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) datasetCorrupt(`${field} is not an array`);

  // No filtering: a single bad member invalidates the whole population.
  return value.map((raw) => {
    const n =
      typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
    if (
      !Number.isFinite(n) ||
      n < REFERENCE_VALUE_BOUNDS.min ||
      n > REFERENCE_VALUE_BOUNDS.max
    ) {
      datasetCorrupt(`${field} contains an invalid value`);
    }
    return n;
  });
}

function parsePersistedResult(row: Record<string, unknown>): PersistedResult {
  const publicResultId = readString(row, "public_result_id");
  if (!RESULT_ID_PATTERN.test(publicResultId)) {
    fail("public_result_id", "does not match the expected opaque id format");
  }

  return {
    publicResultId,
    calculatedAt: readTimestamp(row, "calculated_at"),
    hybridScore: readBoundedNumber(row, "hq_score", 0, 100),
    strengthIndex: readBoundedNumber(row, "strength_index", 0, 100),
    enduranceIndex: readBoundedNumber(row, "endurance_index", 0, 100),
    strengthPercentile: readBoundedNumber(row, "strength_percentile", 0, 100),
    endurancePercentile: readBoundedNumber(row, "endurance_percentile", 0, 100),
    // Checked against the central allowlists at RUNTIME. A cast at the call site
    // would only assert the type to the compiler; an unrecognised tier or
    // archetype coming back from Postgres is corrupt data and must fail closed.
    tier: readEnum(row, "tier", TIERS),
    archetype: readEnum(row, "archetype", ARCHETYPES),
    moderationStatus: readEnum(row, "status", MODERATION_STATUSES),
    visibility: readEnum(row, "visibility", VISIBILITIES),
    provenance: readEnum(row, "provenance", PROVENANCES),
    verificationStatus: readEnum(
      row,
      "verification_status",
      VERIFICATION_STATUSES,
    ),
    scoreVersion: readString(row, "score_version"),
    datasetVersionId: readUuid(row, "dataset_version_id"),
    datasetLabel: readString(row, "dataset_label"),
    datasetKind: readEnum(row, "dataset_kind", DATASET_KINDS),
    datasetSampleSize: readInteger(row, "dataset_sample_size", 0, 100_000_000),
    datasetConfidence: readEnum(
      row,
      "dataset_confidence",
      DATASET_CONFIDENCE_TIERS,
    ),
    // Read back from the stored row, not echoed from the attempted write, so a
    // caller can prove the raw submission was persisted intact. Bounded only by
    // ORIGINAL_WEIGHT_MAX: the unit system decides what a plausible range is.
    originalUnitSystem: readEnum(row, "original_unit_system", UNIT_SYSTEMS),
    originalBodyweight: readPositiveNumber(
      row,
      "original_bodyweight",
      ORIGINAL_WEIGHT_MAX,
    ),
    originalBench: readPositiveNumber(row, "original_bench", ORIGINAL_WEIGHT_MAX),
    originalSquat: readPositiveNumber(row, "original_squat", ORIGINAL_WEIGHT_MAX),
    originalDeadlift: readPositiveNumber(
      row,
      "original_deadlift",
      ORIGINAL_WEIGHT_MAX,
    ),
  };
}

function isIdempotencyConflict(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return (
    error.code === IDEMPOTENCY_CONFLICT_SQLSTATE ||
    (typeof error.message === "string" &&
      error.message.includes(IDEMPOTENCY_CONFLICT_TOKEN))
  );
}

export function createSupabaseScoreRepository(
  supabase: SupabaseClient,
): ScoreRepository {
  return {
    async loadActiveDataset(scoreVersion) {
      const { data, error } = await supabase
        .from("scoring_dataset_versions")
        .select(
          "id,label,kind,score_version,strength_reference,endurance_reference,eligible_sample_size,dataset_hash,confidence",
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

      const row = data as Record<string, unknown>;

      // Every structural failure below is a corrupt dataset (503), not an
      // internal error (500) — including a row that simply cannot be read.
      let snapshot: ScoringDatasetSnapshot;
      try {
        const datasetHash = readString(row, "dataset_hash");
        if (!isSha256Hex(datasetHash)) {
          datasetCorrupt("malformed dataset hash");
        }

        snapshot = {
          datasetVersionId: readUuid(row, "id"),
          label: readString(row, "label"),
          kind: readEnum(row, "kind", DATASET_KINDS),
          scoreVersion: readString(row, "score_version"),
          strengthReference: readReferenceArray(
            row.strength_reference,
            "strength_reference",
          ),
          enduranceReference: readReferenceArray(
            row.endurance_reference,
            "endurance_reference",
          ),
          eligibleSampleSize: readInteger(
            row,
            "eligible_sample_size",
            0,
            100_000_000,
          ),
          datasetHash,
          confidence: readEnum(row, "confidence", DATASET_CONFIDENCE_TIERS),
        };
      } catch (err) {
        if (err instanceof ScoringError) throw err;
        datasetCorrupt("malformed dataset row");
      }

      // Content verification: proves the stored population has not drifted
      // since it was frozen. Structural checks run in assertDatasetIntegrity.
      const expected = computeDatasetHash({
        scoreVersion: snapshot.scoreVersion,
        datasetKind: snapshot.kind,
        eligibleSampleSize: snapshot.eligibleSampleSize,
        strengthReference: snapshot.strengthReference,
        enduranceReference: snapshot.enduranceReference,
      });

      if (expected !== snapshot.datasetHash) {
        throw new ScoringError(
          "DATASET_CORRUPT",
          "The active scoring dataset failed its integrity check (hash mismatch).",
          "dataset",
        );
      }

      return snapshot;
    },

    async persistResult(input) {
      const { data, error } = await supabase.rpc("score_result_insert", {
        p_payload: {
          idempotency_key: input.idempotencyKey,
          request_fingerprint: input.requestFingerprint,
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
          dataset_label: input.datasetLabel,
          dataset_kind: input.datasetKind,
          dataset_sample_size: input.datasetSampleSize,
          dataset_confidence: input.datasetConfidence,
          calculated_at: input.calculatedAt,
          original_unit_system: input.originalUnitSystem,
          original_run_distance: input.originalRunDistance,
          original_run_seconds: input.originalRunSeconds,
          // Verbatim, in the athlete's own unit system. Not converted, not
          // rounded, and never derived from the *_kg fields above.
          original_bodyweight: input.originalBodyweight,
          original_bench: input.originalBench,
          original_squat: input.originalSquat,
          original_deadlift: input.originalDeadlift,
          canonical_endurance_seconds: input.canonicalEnduranceSeconds,
          endurance_seconds: input.canonicalEnduranceSeconds,
        },
      });

      if (error) {
        if (isIdempotencyConflict(error)) {
          throw new ScoringError(
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key was already used for a different submission.",
            "idempotency_key",
          );
        }
        throw new RepositoryError("Failed to persist result.", error);
      }

      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new RepositoryError("Persisted result was not returned.");
      }

      const row = data as Record<string, unknown>;

      // The saved row is authoritative. On a replay this is the ORIGINAL
      // result, not the one we just tried to write.
      return {
        result: parsePersistedResult(row),
        replayed: readBoolean(row, "replayed"),
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

      // FAIL CLOSED. Every row the eligibility filters selected must yield a
      // usable score. Dropping a malformed one would silently shrink `total`
      // and shift every athlete's rank with nothing to show for it, so a single
      // unreadable score invalidates the whole placement rather than quietly
      // producing a plausible wrong answer. Nothing is filtered and nothing is
      // clamped; 0 and 100 are legitimate scores and are preserved exactly.
      return ((data ?? []) as Record<string, unknown>[]).map((row) =>
        readBoundedNumber(row, "hq_score", 0, 100),
      );
    },
  };
}
