// Group 3 — calculator placement follows the shared leaderboard rule, and the
// legacy routes are retired. No database or network access.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { SCORE_VERSION } from "../lib/scoring/core";
import { placementFor, type LeaderboardScope } from "../lib/leaderboard";
import {
  createCanonicalResult,
  type ScoreRequestFields,
} from "../lib/server/scoreService";
import type {
  PersistResultInput,
  PersistedResult,
  ScoreRepository,
} from "../lib/server/scoreRepository";
import { RETIRED_ROUTE_MESSAGE } from "../lib/server/retiredRoute";
import * as submitRoute from "../app/api/submit/route";
import * as rankRoute from "../app/api/rank/route";
import { around, makeSnapshot } from "./helpers/dataset";

const ACTIVE = "8bd76e2f-4cfb-47f0-8407-e5b812a6709d";
const OLDER = "11111111-2222-3333-4444-555555555555";

class PlacementRepository implements ScoreRepository {
  scopes: LeaderboardScope[] = [];
  constructor(
    private readonly override: Partial<PersistedResult> = {},
    private readonly scores: number[] = [95, 70, 50, 50, 30],
  ) {}
  async loadActiveDataset() {
    return makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), { datasetVersionId: ACTIVE });
  }
  async loadDatasetVersion() {
    return null;
  }
  async persistResult(input: PersistResultInput) {
    const result: PersistedResult = {
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
      originalUnitSystem: input.originalUnitSystem,
      originalBodyweight: input.originalBodyweight,
      originalBench: input.originalBench,
      originalSquat: input.originalSquat,
      originalDeadlift: input.originalDeadlift,
      ...this.override,
    };
    return { result, replayed: Object.keys(this.override).length > 0 };
  }
  async loadPlacement(scope: LeaderboardScope, score: number) {
    this.scopes.push(scope);
    return placementFor(this.scores, score);
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
  visibility: "public",
  idempotency_key: "group3-placement-0001",
};

describe("calculator placement uses the shared leaderboard rule", () => {
  it("an approved public result is ranked within the active dataset AND score version", async () => {
    const repo = new PlacementRepository();
    const { result } = await createCanonicalResult(repo, REQUEST);
    assert.deepEqual(repo.scopes, [{ datasetVersionId: ACTIVE, scoreVersion: SCORE_VERSION }]);
    // Score 50 among [95, 70, 50, 50, 30]: two score higher -> #3 of 5, tie shared.
    assert.equal(result.hybridScore, 50);
    assert.deepEqual(result.leaderboard, { rank: 3, total: 5 });
  });

  for (const [label, override] of [
    ["private", { visibility: "private" }],
    ["unlisted", { visibility: "unlisted" }],
    ["pending", { moderationStatus: "pending" }],
    ["rejected", { moderationStatus: "rejected" }],
    ["scored against an inactive dataset (replay)", { datasetVersionId: OLDER }],
    ["another score version (replay)", { scoreVersion: "1.9.0" }],
  ] as const) {
    it(`a ${label} result receives no placement`, async () => {
      const repo = new PlacementRepository(override as Partial<PersistedResult>);
      const { result } = await createCanonicalResult(repo, REQUEST);
      assert.equal(result.leaderboard, null);
      assert.equal(repo.scopes.length, 0, "the population is not even read");
    });
  }

  it("a placement failure leaves the saved result intact, with no placement", async () => {
    const repo = new PlacementRepository();
    repo.loadPlacement = async () => {
      throw new Error("function public.leaderboard_placement does not exist");
    };
    const { result } = await createCanonicalResult(repo, REQUEST);
    assert.equal(result.hybridScore, 50);
    assert.equal(result.leaderboard, null);
  });

  it("the calculator shows placement only as the server returned it", () => {
    const source = readFileSync(new URL("../app/tool/page.tsx", import.meta.url), "utf8");
    // Enabled after staging verification (docs/group-3-leaderboard-moderation.md).
    assert.match(source, /const LEADERBOARD_PLACEMENT_AVAILABLE = true as const;/);
    // The results line is the tested pure helper, not ad-hoc formatting.
    assert.match(source, /\{placementLine\(result\)\.text\}/);
    // The share card shows a rank only when the server returned one.
    assert.match(source, /LEADERBOARD_PLACEMENT_AVAILABLE && result\?\.leaderboard\s*\?\s*`#\$\{result\.leaderboard\.rank\} \/ \$\{result\.leaderboard\.total\}`\s*:\s*"CAN YOU BEAT THIS\?"/);
    // The review snapshot gets the server's values or null — never a default.
    assert.match(source, /rank=\{LEADERBOARD_PLACEMENT_AVAILABLE \? \(saved\.result\.leaderboard\?\.rank \?\? null\) : null\}/);
    assert.match(source, /totalAthletes=\{LEADERBOARD_PLACEMENT_AVAILABLE \? \(saved\.result\.leaderboard\?\.total \?\? null\) : null\}/);
    // No placement-derived percentage anywhere on the page.
    assert.match(source, /betterThanPercent=\{null\}/);
    assert.equal(/beatPercent/.test(source), false);
  });
});

describe("retired legacy routes", () => {
  for (const [name, route] of [
    ["/api/submit", submitRoute],
    ["/api/rank", rankRoute],
  ] as const) {
    for (const method of ["POST", "GET"] as const) {
      it(`${method} ${name} returns 410 with a refresh message`, async () => {
        const res = await route[method]();
        assert.equal(res.status, 410);
        assert.equal(res.headers.get("cache-control"), "no-store");
        const body = await res.json();
        assert.equal(body.code, "ENDPOINT_RETIRED");
        assert.equal(body.error, RETIRED_ROUTE_MESSAGE);
        assert.match(body.error, /refresh the page/);
      });
    }

    it(`${name} no longer touches the database or scoring`, () => {
      const file = name === "/api/submit" ? "submit" : "rank";
      const source = readFileSync(new URL(`../app/api/${file}/route.ts`, import.meta.url), "utf8");
      for (const banned of ["supabase", "createClient", "computeScore", "insert(", "from("]) {
        assert.ok(!source.includes(banned), `${name} still references ${banned}`);
      }
    });
  }

  it("nothing in the app calls the retired routes", () => {
    for (const file of ["../app/tool/page.tsx", "../lib/tool/scoreSubmission.ts", "../app/rankings/RankingsView.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.ok(!/["'`]\/api\/(submit|rank)["'`]/.test(source), file);
    }
  });
});
