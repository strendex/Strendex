import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_VERSION,
  ScoringError,
  type ScoringDatasetSnapshot,
  type ScoringErrorCode,
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
import { around, makeSnapshot } from "./helpers/dataset";

/** Athlete scores 50 against this dataset (strengthIndex 66.9 / endurance 59.1). */
const MID_DATASET = makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
  datasetVersionId: "33333333-3333-3333-3333-333333333333",
  label: "service test dataset",
});
/** Athlete scores 100 — above the review threshold. */
const TOP_DATASET = makeSnapshot(around(66.9, 40, 0), around(59.1, 40, 0));

type StoredRow = { result: PersistedResult; fingerprint: string };

/**
 * In-memory stand-in for the Postgres uniqueness guarantee and the
 * fingerprint check inside public.score_result_insert:
 *   same key + same fingerprint      -> the ORIGINAL row, replayed
 *   same key + different fingerprint -> IDEMPOTENCY_CONFLICT, nothing written
 * The stored row is never mutated.
 */
class FakeRepository implements ScoreRepository {
  persistCalls = 0;
  leaderboardScores: number[] = [];
  /**
   * Simulates another request committing this key first: our INSERT loses the
   * race, the re-read finds THEIR row, and we must return it unchanged.
   */
  concurrentWinnerResultId: string | null = null;

  private readonly rows = new Map<string, StoredRow>();

  constructor(
    private readonly dataset: ScoringDatasetSnapshot | null = MID_DATASET,
  ) {}

  async loadActiveDataset(scoreVersion: string) {
    if (!this.dataset || this.dataset.scoreVersion !== scoreVersion) return null;
    return this.dataset;
  }

  private store(input: PersistResultInput): StoredRow {
    const stored: StoredRow = {
      fingerprint: input.requestFingerprint,
      result: {
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
        datasetLabel: input.datasetLabel,
        datasetKind: input.datasetKind,
        datasetSampleSize: input.datasetSampleSize,
        datasetConfidence: input.datasetConfidence,
      },
    };
    this.rows.set(input.idempotencyKey, stored);
    return stored;
  }

  async persistResult(input: PersistResultInput) {
    this.persistCalls++;

    // The winner committed the same key, with the same request, but its own
    // opaque result id — exactly what score_result_insert's re-read returns.
    if (this.concurrentWinnerResultId && !this.rows.has(input.idempotencyKey)) {
      this.store({ ...input, publicResultId: this.concurrentWinnerResultId });
      this.concurrentWinnerResultId = null;
    }

    const existing = this.rows.get(input.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== input.requestFingerprint) {
        throw new ScoringError(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for a different submission.",
          "idempotency_key",
        );
      }
      return { result: existing.result, replayed: true };
    }

    return { result: this.store(input).result, replayed: false };
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

async function expectCode(
  run: () => Promise<unknown>,
  code: ScoringErrorCode,
) {
  await assert.rejects(run, (err: unknown) => {
    assert.ok(err instanceof ScoringError, "expected a ScoringError");
    assert.equal(err.code, code);
    return true;
  });
}

describe("canonical score service", () => {
  it("returns the saved canonical result", async () => {
    const repo = new FakeRepository();
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

  it("discloses the dataset kind and label for the UI", async () => {
    const repo = new FakeRepository(
      makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), {
        label: "2026-08 provisional legacy",
        kind: "legacy_mixed_provisional",
      }),
    );
    const { result } = await createCanonicalResult(repo, REQUEST);

    assert.equal(result.datasetKind, "legacy_mixed_provisional");
    assert.equal(result.datasetLabel, "2026-08 provisional legacy");
    // Raw reference arrays are never exposed.
    assert.equal("strengthReference" in result, false);
    assert.equal("enduranceReference" in result, false);
  });

  it("marks new results self-reported, unverified, and private", async () => {
    const repo = new FakeRepository();
    const { result } = await createCanonicalResult(repo, REQUEST);

    assert.equal(result.provenance, "self_reported");
    assert.equal(result.verificationStatus, "unverified");
    assert.equal(result.visibility, "private");
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
    assert.equal(result.leaderboard, null);
  });

  it("places eligible public results with competition ranking", async () => {
    const repo = new FakeRepository();
    repo.leaderboardScores = [95, 80, 80, 50];

    const { result } = await createCanonicalResult(repo, {
      ...REQUEST,
      visibility: "public",
    });

    assert.equal(result.moderationStatus, "approved");
    assert.deepEqual(result.leaderboard, { rank: 4, total: 4 });
  });
});

describe("idempotency", () => {
  it("returns the original saved result for an identical replay", async () => {
    const repo = new FakeRepository();

    const first = await createCanonicalResult(repo, REQUEST);
    const second = await createCanonicalResult(repo, REQUEST);

    assert.equal(repo.persistCalls, 2);
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(second.result.resultId, first.result.resultId);
    assert.deepEqual(second.result, first.result);
  });

  it("ignores irrelevant ordering — the fingerprint covers inputs, not key order", async () => {
    const repo = new FakeRepository();

    const first = await createCanonicalResult(repo, REQUEST);
    const reordered: ScoreRequestFields = {
      idempotency_key: REQUEST.idempotency_key,
      run_seconds: REQUEST.run_seconds,
      run_distance: REQUEST.run_distance,
      deadlift: REQUEST.deadlift,
      squat: REQUEST.squat,
      bench: REQUEST.bench,
      bodyweight: REQUEST.bodyweight,
      unit_system: REQUEST.unit_system,
      display_name: REQUEST.display_name,
    };
    const second = await createCanonicalResult(repo, reordered);

    assert.equal(second.replayed, true);
    assert.equal(second.result.resultId, first.result.resultId);
  });

  it("rejects the same key reused with different inputs", async () => {
    const repo = new FakeRepository();
    const first = await createCanonicalResult(repo, REQUEST);

    for (const different of [
      { bench: 111 },
      { bodyweight: 91 },
      { squat: 151 },
      { deadlift: 191 },
      { run_seconds: 1501 },
      // 3mi at 25:00 stays inside the canonical endurance window, so this
      // reaches the fingerprint check rather than failing validation first.
      { run_distance: "3mi" },
      { display_name: "Someone Else" },
      { visibility: "public" },
      { unit_system: "lb", bodyweight: 198, bench: 242, squat: 330, deadlift: 419 },
    ]) {
      await expectCode(
        () => createCanonicalResult(repo, { ...REQUEST, ...different }),
        "IDEMPOTENCY_CONFLICT",
      );
    }

    // The original is untouched and still replays cleanly.
    const replay = await createCanonicalResult(repo, REQUEST);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.result, first.result);
  });

  it("is concurrency-safe: a losing writer receives the winner's row", async () => {
    const winnerResultId = "res_aaaaaaaaaaaaaaaaaaaaaaaa";
    const repo = new FakeRepository();
    repo.concurrentWinnerResultId = winnerResultId;

    const loser = await createCanonicalResult(repo, REQUEST);

    assert.equal(loser.replayed, true);
    assert.equal(
      loser.result.resultId,
      winnerResultId,
      "the loser must return the winner's persisted row, not its own",
    );

    // And a later honest retry still sees that same single row.
    const retry = await createCanonicalResult(repo, REQUEST);
    assert.equal(retry.replayed, true);
    assert.equal(retry.result.resultId, winnerResultId);
  });

  it("treats a different idempotency key as a new result", async () => {
    const repo = new FakeRepository();

    const first = await createCanonicalResult(repo, REQUEST);
    const second = await createCanonicalResult(repo, {
      ...REQUEST,
      idempotency_key: "idem-key-0002",
    });

    assert.notEqual(second.result.resultId, first.result.resultId);
    assert.equal(second.replayed, false);
  });
});

describe("client-supplied values", () => {
  it("ignores client-supplied calculated fields", async () => {
    const repo = new FakeRepository();
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
      request_fingerprint: "f".repeat(64),
      dataset_kind: "observed",
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
});

describe("dataset availability", () => {
  it("refuses to score when no active dataset exists", async () => {
    const repo = new FakeRepository(null);

    await expectCode(
      () => createCanonicalResult(repo, REQUEST),
      "DATASET_UNAVAILABLE",
    );
    assert.equal(repo.persistCalls, 0);
  });

  it("refuses to persist against a corrupt dataset", async () => {
    const repo = new FakeRepository(
      makeSnapshot(around(66.9, 40, 0), around(59.1, 40, 0), {
        eligibleSampleSize: 39,
      }),
    );

    await expectCode(
      () => createCanonicalResult(repo, REQUEST),
      "DATASET_CORRUPT",
    );
    assert.equal(repo.persistCalls, 0);
  });

  it("validates before it persists", async () => {
    const repo = new FakeRepository();

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
