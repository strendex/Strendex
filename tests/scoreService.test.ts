import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_VERSION,
  ScoringError,
  type ScoringDatasetSnapshot,
} from "../lib/scoring/core";
import type {
  PersistResultInput,
  PersistedResult,
  ScoreRepository,
} from "../lib/server/scoreRepository";
import {
  SCORE_REQUEST_FIELDS,
  createCanonicalResult,
  type ScoreRequestFields,
} from "../lib/server/scoreService";

function makeDataset(
  strength: number[],
  endurance: number[],
): ScoringDatasetSnapshot {
  return {
    datasetVersionId: "33333333-3333-3333-3333-333333333333",
    label: "service test dataset",
    scoreVersion: SCORE_VERSION,
    strengthReference: strength,
    enduranceReference: endurance,
    eligibleSampleSize: Math.min(strength.length, endurance.length),
    datasetHash: "a".repeat(64),
    confidence: "provisional",
  };
}

function around(index: number, below: number, above: number): number[] {
  return [
    ...Array.from({ length: below }, () => index - 10),
    ...Array.from({ length: above }, () => index + 10),
  ];
}

/** Athlete scores 50 against this dataset (strengthIndex 66.9 / endurance 59.1). */
const MID_DATASET = makeDataset(around(66.9, 20, 20), around(59.1, 20, 20));
/** Athlete scores 100 — above the review threshold. */
const TOP_DATASET = makeDataset(around(66.9, 40, 0), around(59.1, 40, 0));

/**
 * In-memory stand-in for the Postgres uniqueness guarantee: an idempotency key
 * maps to exactly one stored result, and a replay returns the ORIGINAL row.
 */
class FakeRepository implements ScoreRepository {
  persistCalls = 0;
  leaderboardScores: number[] = [];

  private readonly rows = new Map<string, PersistedResult>();

  constructor(private readonly dataset: ScoringDatasetSnapshot | null) {}

  async loadActiveDataset(scoreVersion: string) {
    if (!this.dataset || this.dataset.scoreVersion !== scoreVersion) return null;
    return this.dataset;
  }

  async persistResult(input: PersistResultInput) {
    this.persistCalls++;

    const existing = this.rows.get(input.idempotencyKey);
    if (existing) return { result: existing, replayed: true };

    const stored: PersistedResult = {
      publicResultId: input.publicResultId,
      calculatedAt: input.calculatedAt,
      hybridScore: input.hybridScore,
      strengthIndex: input.strengthIndex,
      enduranceIndex: input.enduranceIndex,
      strengthPercentile: input.strengthPercentile,
      endurancePercentile: input.endurancePercentile,
      tier: input.tier,
      archetype: input.archetype,
      moderationStatus: input.moderationStatus,
      visibility: input.visibility,
      provenance: input.provenance,
      verificationStatus: input.verificationStatus,
      scoreVersion: input.scoreVersion,
      datasetVersionId: input.datasetVersionId,
      datasetSampleSize: input.datasetSampleSize,
      datasetConfidence: input.datasetConfidence,
    };

    this.rows.set(input.idempotencyKey, stored);
    return { result: stored, replayed: false };
  }

  async loadEligibleScores() {
    return this.leaderboardScores;
  }
}

const REQUEST: ScoreRequestFields = {
  display_name: "Ryan Woods",
  unit_system: "kg",
  bodyweight: 90,
  bench: 110,
  squat: 150,
  deadlift: 190,
  run_distance: "5k",
  run_seconds: 1500,
  idempotency_key: "idem-key-0001",
};

describe("canonical score service", () => {
  it("returns the saved canonical result", async () => {
    const repo = new FakeRepository(MID_DATASET);
    const { result, replayed } = await createCanonicalResult(repo, REQUEST);

    assert.equal(replayed, false);
    assert.match(result.resultId, /^res_[0-9a-z]{24}$/);
    assert.equal(result.hybridScore, 50);
    assert.equal(result.strengthIndex, 66.9);
    assert.equal(result.enduranceIndex, 59.1);
    assert.equal(result.strengthPercentile, 50);
    assert.equal(result.endurancePercentile, 50);
    assert.equal(result.tier, "INTERMEDIATE");
    assert.equal(result.moderationStatus, "approved");
    assert.equal(result.scoreVersion, SCORE_VERSION);
    assert.equal(result.datasetVersionId, MID_DATASET.datasetVersionId);
    assert.equal(result.datasetSampleSize, 40);
    assert.equal(result.datasetConfidence, "provisional");
  });

  it("marks new results self-reported, unverified, and private", async () => {
    const repo = new FakeRepository(MID_DATASET);
    const { result } = await createCanonicalResult(repo, REQUEST);

    assert.equal(result.provenance, "self_reported");
    assert.equal(result.verificationStatus, "unverified");
    assert.equal(result.visibility, "private");
    // Private results are not placed on the leaderboard.
    assert.equal(result.leaderboard, null);
  });

  it("applies the >= 90 review rule server-side", async () => {
    const repo = new FakeRepository(TOP_DATASET);
    const { result } = await createCanonicalResult(repo, {
      ...REQUEST,
      visibility: "public",
    });

    assert.equal(result.hybridScore, 100);
    assert.equal(result.moderationStatus, "pending");
    // Pending is not eligible for placement, public or not.
    assert.equal(result.leaderboard, null);
  });

  it("places eligible public results with competition ranking", async () => {
    const repo = new FakeRepository(MID_DATASET);
    repo.leaderboardScores = [95, 80, 80, 50];

    const { result } = await createCanonicalResult(repo, {
      ...REQUEST,
      visibility: "public",
    });

    assert.equal(result.moderationStatus, "approved");
    assert.deepEqual(result.leaderboard, { rank: 4, total: 4 });
  });

  it("is idempotent: a retry returns the original saved result", async () => {
    const repo = new FakeRepository(MID_DATASET);

    const first = await createCanonicalResult(repo, REQUEST);
    const second = await createCanonicalResult(repo, REQUEST);

    assert.equal(repo.persistCalls, 2);
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(second.result.resultId, first.result.resultId);
    assert.deepEqual(second.result, first.result);
  });

  it("treats a different idempotency key as a new result", async () => {
    const repo = new FakeRepository(MID_DATASET);

    const first = await createCanonicalResult(repo, REQUEST);
    const second = await createCanonicalResult(repo, {
      ...REQUEST,
      idempotency_key: "idem-key-0002",
    });

    assert.notEqual(second.result.resultId, first.result.resultId);
    assert.equal(second.replayed, false);
  });

  it("ignores client-supplied calculated fields", async () => {
    const repo = new FakeRepository(MID_DATASET);
    const baseline = await createCanonicalResult(repo, {
      ...REQUEST,
      idempotency_key: "idem-baseline-1",
    });

    const spoofed = await createCanonicalResult(repo, {
      ...REQUEST,
      idempotency_key: "idem-spoofed-01",
      // None of these are read: the service only touches allowlisted fields.
      hq_score: 100,
      hybrid_score: 100,
      strength_percentile: 100,
      endurance_percentile: 100,
      tier: "WORLD CLASS",
      archetype: "POWER HYBRID",
      status: "approved",
      provenance: "verified",
      rank: 1,
      bodyweight_kg: 45,
    } as ScoreRequestFields);

    assert.equal(spoofed.result.hybridScore, baseline.result.hybridScore);
    assert.equal(spoofed.result.tier, baseline.result.tier);
    assert.equal(spoofed.result.archetype, baseline.result.archetype);
    assert.equal(spoofed.result.provenance, "self_reported");
    assert.equal(spoofed.result.moderationStatus, "approved");
  });

  it("accepts only the documented request fields", () => {
    assert.deepEqual([...SCORE_REQUEST_FIELDS], [
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
    ]);
  });

  it("refuses to score when no active dataset exists", async () => {
    const repo = new FakeRepository(null);

    await assert.rejects(
      () => createCanonicalResult(repo, REQUEST),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "DATASET_UNAVAILABLE");
        return true;
      },
    );
    assert.equal(repo.persistCalls, 0);
  });

  it("validates before it persists", async () => {
    const repo = new FakeRepository(MID_DATASET);

    await assert.rejects(
      () => createCanonicalResult(repo, { ...REQUEST, deadlift: null }),
      ScoringError,
    );
    await assert.rejects(
      () => createCanonicalResult(repo, { ...REQUEST, idempotency_key: "x" }),
      ScoringError,
    );
    assert.equal(repo.persistCalls, 0);
  });
});
