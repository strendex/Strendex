import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHETYPES, SCORE_VERSION, ScoringError, TIERS } from "../lib/scoring/core";
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
  /** Receives the payload the repository actually sent to score_result_insert. */
  onRpc?: (args: Record<string, unknown>) => void;
}): SupabaseClient {
  const stub = {
    from: () => chain(options.table ?? { data: null, error: null }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      options.onRpc?.(args);
      return options.rpc ?? { data: null, error: null };
    },
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
  originalUnitSystem: "lb",
  originalRunDistance: "5k",
  originalRunSeconds: 1500,
  // Pounds, at a precision the rounded kg columns above cannot represent.
  originalBodyweight: 198.4,
  originalBench: 242.5,
  originalSquat: 330.75,
  originalDeadlift: 419.25,
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
    original_unit_system: "lb",
    original_bodyweight: 198.4,
    original_bench: 242.5,
    original_squat: 330.75,
    original_deadlift: 419.25,
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
      { tier: "LEGENDARY" },
      { tier: "intermediate" },
      { tier: 3 },
      { archetype: undefined },
      { archetype: "" },
      { archetype: "GYM BRO" },
      { archetype: "balanced hybrid" },
      { original_unit_system: undefined },
      { original_unit_system: "stone" },
      { original_bodyweight: undefined },
      { original_bodyweight: null },
      { original_bodyweight: "" },
      { original_bodyweight: "heavy" },
      { original_bodyweight: 0 },
      { original_bodyweight: -198.4 },
      { original_bodyweight: Number.NaN },
      { original_bodyweight: Number.POSITIVE_INFINITY },
      { original_bench: undefined },
      { original_bench: 0 },
      { original_squat: undefined },
      { original_squat: -1 },
      { original_deadlift: undefined },
      { original_deadlift: 99_999 },
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

describe("tier and archetype allowlists", () => {
  it("accepts every tier the scorer can produce", async () => {
    for (const tier of TIERS) {
      const repo = repoWithRpc(rpcRow({ tier }));
      const { result } = await repo.persistResult(PERSIST_INPUT);
      assert.equal(result.tier, tier);
    }
  });

  it("accepts every archetype the scorer can produce", async () => {
    for (const archetype of ARCHETYPES) {
      const repo = repoWithRpc(rpcRow({ archetype }));
      const { result } = await repo.persistResult(PERSIST_INPUT);
      assert.equal(result.archetype, archetype);
    }
  });

  it("never names the rejected value in the error", async () => {
    for (const override of [
      { tier: "SUPREME OVERLORD" },
      { archetype: "CARDIO GOBLIN" },
    ]) {
      const repo = repoWithRpc(rpcRow(override));
      await assert.rejects(
        () => repo.persistResult(PERSIST_INPUT),
        (err: unknown) => {
          assert.ok(err instanceof RepositoryError);
          assert.equal(err.message.includes("SUPREME"), false);
          assert.equal(err.message.includes("GOBLIN"), false);
          return true;
        },
      );
    }
  });
});

describe("original submitted weights", () => {
  it("sends the originals to the RPC unrounded and unconverted", async () => {
    let payload: Record<string, unknown> | null = null;
    const repo = createSupabaseScoreRepository(
      fakeSupabase({
        rpc: { data: rpcRow(), error: null },
        onRpc: (args) => {
          payload = args.p_payload as Record<string, unknown>;
        },
      }),
    );

    await repo.persistResult(PERSIST_INPUT);

    assert.ok(payload, "expected the RPC to be called");
    const sent = payload as Record<string, unknown>;
    assert.equal(sent.original_bodyweight, 198.4);
    assert.equal(sent.original_bench, 242.5);
    assert.equal(sent.original_squat, 330.75);
    assert.equal(sent.original_deadlift, 419.25);
    assert.equal(sent.original_unit_system, "lb");

    // The kg columns travel separately and are NOT the source of the above.
    assert.equal(sent.bodyweight, 90);
    assert.notEqual(sent.bodyweight, sent.original_bodyweight);
  });

  it("reads the originals back from the stored row", async () => {
    const repo = repoWithRpc(rpcRow());
    const { result } = await repo.persistResult(PERSIST_INPUT);

    assert.equal(result.originalUnitSystem, "lb");
    assert.equal(result.originalBodyweight, 198.4);
    assert.equal(result.originalBench, 242.5);
    assert.equal(result.originalSquat, 330.75);
    assert.equal(result.originalDeadlift, 419.25);
  });

  it("returns what was stored, not what was attempted", async () => {
    // A replay returns the ORIGINAL submission, which may differ from the
    // values this particular request tried to write.
    const repo = repoWithRpc(
      rpcRow({ replayed: true, original_bodyweight: 201.6 }),
    );
    const { result } = await repo.persistResult(PERSIST_INPUT);

    assert.equal(result.originalBodyweight, 201.6);
    assert.notEqual(result.originalBodyweight, PERSIST_INPUT.originalBodyweight);
  });

  it("accepts originals delivered as numeric strings", async () => {
    const repo = repoWithRpc(rpcRow({ original_bodyweight: "198.4" }));
    const { result } = await repo.persistResult(PERSIST_INPUT);
    assert.equal(result.originalBodyweight, 198.4);
  });
});

describe("leaderboard score loading (fail closed)", () => {
  function repoWithScores(data: unknown, error: unknown = null) {
    return createSupabaseScoreRepository(
      fakeSupabase({ table: { data, error } }),
    );
  }

  it("returns every eligible score", async () => {
    const scores = await repoWithScores([
      { hq_score: 95 },
      { hq_score: 80 },
      { hq_score: 50.5 },
    ]).loadEligibleScores(DATASET_ID);

    assert.deepEqual(scores, [95, 80, 50.5]);
  });

  it("accepts the numeric-as-string form PostgREST may return", async () => {
    const scores = await repoWithScores([
      { hq_score: "95" },
      { hq_score: "50.5" },
    ]).loadEligibleScores(DATASET_ID);

    assert.deepEqual(scores, [95, 50.5]);
  });

  it("preserves the boundary scores exactly", async () => {
    const scores = await repoWithScores([
      { hq_score: 0 },
      { hq_score: 100 },
      { hq_score: "0" },
      { hq_score: "100" },
    ]).loadEligibleScores(DATASET_ID);

    assert.deepEqual(scores, [0, 100, 0, 100]);
  });

  it("returns an empty leaderboard for an empty result set", async () => {
    assert.deepEqual(await repoWithScores([]).loadEligibleScores(DATASET_ID), []);
    assert.deepEqual(await repoWithScores(null).loadEligibleScores(DATASET_ID), []);
  });

  it("throws rather than dropping a malformed eligible row", async () => {
    for (const bad of [
      { hq_score: null },
      {},
      { hq_score: "" },
      { hq_score: "  " },
      { hq_score: "not a score" },
      { hq_score: Number.NaN },
      { hq_score: Number.POSITIVE_INFINITY },
      { hq_score: Number.NEGATIVE_INFINITY },
      { hq_score: -0.01 },
      { hq_score: -1 },
      { hq_score: 100.01 },
      { hq_score: 101 },
      { hq_score: true },
      { hq_score: [50] },
      { hq_score: { value: 50 } },
    ]) {
      await assert.rejects(
        () => repoWithScores([bad]).loadEligibleScores(DATASET_ID),
        RepositoryError,
        `expected a RepositoryError for ${JSON.stringify(bad)}`,
      );
    }
  });

  it("fails the whole load when one row among many is malformed", async () => {
    // Silently dropping this row would shrink `total` and shift every rank.
    const repo = repoWithScores([
      { hq_score: 95 },
      { hq_score: 80 },
      { hq_score: "corrupt" },
      { hq_score: 50 },
    ]);

    await assert.rejects(() => repo.loadEligibleScores(DATASET_ID), RepositoryError);
  });

  it("does not echo the offending value", async () => {
    const repo = repoWithScores([{ hq_score: 9999 }]);
    await assert.rejects(
      () => repo.loadEligibleScores(DATASET_ID),
      (err: unknown) => {
        assert.ok(err instanceof RepositoryError);
        assert.equal(err.message.includes("9999"), false);
        return true;
      },
    );
  });

  it("surfaces a query error as a RepositoryError", async () => {
    const repo = repoWithScores(null, {
      code: "42501",
      message: 'permission denied for table "submissions"',
    });

    await assert.rejects(
      () => repo.loadEligibleScores(DATASET_ID),
      (err: unknown) => {
        assert.ok(err instanceof RepositoryError);
        assert.equal(err.message.includes("permission denied"), false);
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
