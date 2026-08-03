import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SCORE_VERSION, ScoringError } from "../lib/scoring/core";
import { computeDatasetHash } from "../lib/server/hashing";
import {
  RepositoryError,
  createSupabaseScoreRepository,
  generatePublicResultId,
  type PersistResultInput,
} from "../lib/server/scoreRepository";

type QueryResult = { data: unknown; error: unknown };

type Chain = {
  select: () => Chain;
  eq: () => Chain;
  not: () => Chain;
  limit: () => Chain;
  maybeSingle: () => Promise<QueryResult>;
  then: <T>(onOk: (value: QueryResult) => T) => Promise<T>;
};

function chain(result: QueryResult): Chain {
  const self: Chain = {
    select: () => self,
    eq: () => self,
    not: () => self,
    limit: () => self,
    maybeSingle: async () => result,
    then: (onOk) => Promise.resolve(result).then(onOk),
  };
  return self;
}

function fakeSupabase(options: {
  table?: QueryResult;
  rpc?: QueryResult;
}): SupabaseClient {
  const stub = {
    from: () => chain(options.table ?? { data: null, error: null }),
    rpc: async () => options.rpc ?? { data: null, error: null },
  };
  return stub as unknown as SupabaseClient;
}

const DATASET_ID = "33333333-3333-3333-3333-333333333333";

const PERSIST_INPUT: PersistResultInput = {
  idempotencyKey: "idem-key-0001",
  requestFingerprint: "a".repeat(64),
  publicResultId: generatePublicResultId(),
  athleteName: "Ryan Woods",
  bodyweightKg: 90,
  benchKg: 110,
  squatKg: 150,
  deadliftKg: 190,
  totalLiftKg: 450,
  strengthRatio: 5,
  strengthIndex: 66.9,
  enduranceIndex: 59.1,
  strengthPercentile: 50,
  endurancePercentile: 50,
  hybridScore: 50,
  tier: "INTERMEDIATE",
  archetype: "BALANCED HYBRID",
  moderationStatus: "approved",
  visibility: "private",
  provenance: "self_reported",
  verificationStatus: "unverified",
  scoreVersion: SCORE_VERSION,
  datasetVersionId: DATASET_ID,
  datasetLabel: "service test dataset",
  datasetKind: "observed",
  datasetSampleSize: 40,
  datasetConfidence: "provisional",
  calculatedAt: "2026-08-02T10:00:00.000Z",
  originalUnitSystem: "kg",
  originalRunDistance: "5k",
  originalRunSeconds: 1500,
  canonicalEnduranceSeconds: 6900,
};

/** A well-formed row exactly as score_result_insert returns it. */
function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    replayed: false,
    public_result_id: "res_bbbbbbbbbbbbbbbbbbbbbbbb",
    calculated_at: "2026-08-02T10:00:00+00:00",
    hq_score: 50,
    strength_index: 66.9,
    endurance_index: 59.1,
    strength_percentile: 50,
    endurance_percentile: 50,
    tier: "INTERMEDIATE",
    archetype: "BALANCED HYBRID",
    status: "approved",
    visibility: "private",
    provenance: "self_reported",
    verification_status: "unverified",
    score_version: SCORE_VERSION,
    dataset_version_id: DATASET_ID,
    dataset_label: "service test dataset",
    dataset_kind: "observed",
    dataset_sample_size: 40,
    dataset_confidence: "provisional",
    ...overrides,
  };
}

function repoWithRpc(data: unknown, error: unknown = null) {
  return createSupabaseScoreRepository(fakeSupabase({ rpc: { data, error } }));
}

describe("persisted result parsing (fail closed)", () => {
  it("returns exactly what the database stored", async () => {
    const repo = repoWithRpc(rpcRow());
    const { result, replayed } = await repo.persistResult(PERSIST_INPUT);

    assert.equal(replayed, false);
    // NOT the id we attempted to write — the one the database reports.
    assert.equal(result.publicResultId, "res_bbbbbbbbbbbbbbbbbbbbbbbb");
    assert.notEqual(result.publicResultId, PERSIST_INPUT.publicResultId);
    assert.equal(result.calculatedAt, "2026-08-02T10:00:00.000Z");
    assert.equal(result.datasetKind, "observed");
    assert.equal(result.datasetLabel, "service test dataset");
  });

  it("accepts numeric columns delivered as strings", async () => {
    const repo = repoWithRpc(
      rpcRow({ hq_score: "50", strength_index: "66.9", dataset_sample_size: "40" }),
    );
    const { result } = await repo.persistResult(PERSIST_INPUT);

    assert.equal(result.hybridScore, 50);
    assert.equal(result.strengthIndex, 66.9);
    assert.equal(result.datasetSampleSize, 40);
  });

  it("reports the replay flag from the database, not from the id", async () => {
    const repo = repoWithRpc(rpcRow({ replayed: true }));
    const { replayed } = await repo.persistResult(PERSIST_INPUT);
    assert.equal(replayed, true);
  });

  it("throws rather than substituting an attempted input value", async () => {
    const cases: Record<string, unknown>[] = [
      { public_result_id: undefined },
      { public_result_id: "not-an-opaque-id" },
      { calculated_at: undefined },
      { calculated_at: "definitely not a date" },
      { hq_score: undefined },
      { hq_score: "abc" },
      { hq_score: 150 },
      { hq_score: -1 },
      { strength_index: null },
      { endurance_percentile: Number.NaN },
      { tier: undefined },
      { tier: "" },
      { archetype: undefined },
      { status: "weird" },
      { visibility: "everyone" },
      { provenance: "trustworthy" },
      { verification_status: "probably" },
      { score_version: undefined },
      { dataset_version_id: "not-a-uuid" },
      { dataset_version_id: undefined },
      { dataset_label: undefined },
      { dataset_kind: "made_up" },
      { dataset_sample_size: 12.5 },
      { dataset_confidence: "vibes" },
      { replayed: undefined },
      { replayed: "true" },
    ];

    for (const override of cases) {
      const repo = repoWithRpc(rpcRow(override));
      await assert.rejects(
        () => repo.persistResult(PERSIST_INPUT),
        RepositoryError,
        `expected a RepositoryError for ${Object.keys(override)[0]}`,
      );
    }
  });

  it("rejects a non-object RPC response", async () => {
    for (const bad of [null, undefined, [], "ok", 42]) {
      const repo = repoWithRpc(bad);
      await assert.rejects(
        () => repo.persistResult(PERSIST_INPUT),
        RepositoryError,
      );
    }
  });

  it("never leaks a submitted value in the error message", async () => {
    const repo = repoWithRpc(rpcRow({ hq_score: 150 }));
    await assert.rejects(
      () => repo.persistResult(PERSIST_INPUT),
      (err: unknown) => {
        assert.ok(err instanceof RepositoryError);
        assert.equal(err.message.includes("150"), false);
        assert.equal(err.message.includes("Ryan"), false);
        return true;
      },
    );
  });

  it("maps the idempotency-conflict SQLSTATE to a typed 409 error", async () => {
    for (const error of [
      { code: "P0409", message: "whatever" },
      { code: "P0001", message: "STRENDEX_IDEMPOTENCY_CONFLICT: reused" },
    ]) {
      const repo = repoWithRpc(null, error);
      await assert.rejects(
        () => repo.persistResult(PERSIST_INPUT),
        (err: unknown) => {
          assert.ok(err instanceof ScoringError);
          assert.equal(err.code, "IDEMPOTENCY_CONFLICT");
          return true;
        },
      );
    }
  });

  it("maps any other database error to an opaque RepositoryError", async () => {
    const repo = repoWithRpc(null, {
      code: "23505",
      message: 'duplicate key value violates unique constraint "secret_idx"',
    });
    await assert.rejects(
      () => repo.persistResult(PERSIST_INPUT),
      (err: unknown) => {
        assert.ok(err instanceof RepositoryError);
        assert.equal(err.message.includes("secret_idx"), false);
        return true;
      },
    );
  });
});

describe("active dataset loading", () => {
  const strength = [40, 45, 50];
  const endurance = [55, 60, 65];

  function datasetRow(overrides: Record<string, unknown> = {}) {
    const kind = (overrides.kind as string) ?? "observed";
    return {
      id: DATASET_ID,
      label: "service test dataset",
      kind,
      score_version: SCORE_VERSION,
      strength_reference: strength,
      endurance_reference: endurance,
      eligible_sample_size: 3,
      confidence: "provisional",
      dataset_hash: computeDatasetHash({
        scoreVersion: SCORE_VERSION,
        datasetKind: "observed",
        eligibleSampleSize: 3,
        strengthReference: strength,
        enduranceReference: endurance,
      }),
      ...overrides,
    };
  }

  function repoWithDataset(data: unknown) {
    return createSupabaseScoreRepository(
      fakeSupabase({ table: { data, error: null } }),
    );
  }

  it("returns null when no dataset is active", async () => {
    assert.equal(await repoWithDataset(null).loadActiveDataset(SCORE_VERSION), null);
  });

  it("loads and verifies a well-formed dataset", async () => {
    const snapshot = await repoWithDataset(datasetRow()).loadActiveDataset(
      SCORE_VERSION,
    );

    assert.ok(snapshot);
    assert.equal(snapshot.datasetVersionId, DATASET_ID);
    assert.equal(snapshot.kind, "observed");
    assert.deepEqual(snapshot.strengthReference, strength);
  });

  it("rejects a tampered population whose hash no longer matches", async () => {
    const repo = repoWithDataset(datasetRow({ strength_reference: [40, 45, 51] }));

    await assert.rejects(
      () => repo.loadActiveDataset(SCORE_VERSION),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "DATASET_CORRUPT");
        return true;
      },
    );
  });

  it("rejects a dataset whose kind was switched after hashing", async () => {
    const repo = repoWithDataset(datasetRow({ kind: "legacy_mixed_provisional" }));

    await assert.rejects(
      () => repo.loadActiveDataset(SCORE_VERSION),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "DATASET_CORRUPT");
        return true;
      },
    );
  });

  it("rejects malformed reference arrays without filtering them", async () => {
    for (const bad of [
      { strength_reference: "not an array" },
      { strength_reference: [40, null, 50] },
      { strength_reference: [40, 45, 101] },
      { endurance_reference: [55, -1, 65] },
      { endurance_reference: [55, "abc", 65] },
    ]) {
      const repo = repoWithDataset(datasetRow(bad));
      await assert.rejects(
        () => repo.loadActiveDataset(SCORE_VERSION),
        (err: unknown) => {
          assert.ok(err instanceof ScoringError);
          assert.equal(err.code, "DATASET_CORRUPT");
          return true;
        },
      );
    }
  });

  it("rejects a malformed dataset hash", async () => {
    const repo = repoWithDataset(datasetRow({ dataset_hash: "nope" }));

    await assert.rejects(
      () => repo.loadActiveDataset(SCORE_VERSION),
      (err: unknown) => {
        assert.ok(err instanceof ScoringError);
        assert.equal(err.code, "DATASET_CORRUPT");
        return true;
      },
    );
  });

  it("reports an unreadable dataset row as corrupt, not as a 500", async () => {
    for (const bad of [
      { id: "not-a-uuid" },
      { id: undefined },
      { label: "" },
      { label: undefined },
      { kind: "invented" },
      { kind: undefined },
      { score_version: undefined },
      { eligible_sample_size: 3.5 },
      { eligible_sample_size: "many" },
      { confidence: "vibes" },
      { dataset_hash: undefined },
    ]) {
      const repo = repoWithDataset(datasetRow(bad));
      await assert.rejects(
        () => repo.loadActiveDataset(SCORE_VERSION),
        (err: unknown) => {
          assert.ok(
            err instanceof ScoringError,
            `expected a ScoringError for ${Object.keys(bad)[0]}`,
          );
          assert.equal(err.code, "DATASET_CORRUPT");
          return true;
        },
      );
    }
  });
});
