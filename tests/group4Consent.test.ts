// Group 4 — opt-in publication. No database or network access.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildScoreRequestDraft,
  resolveIdempotency,
  submissionSignature,
  submissionVisibility,
  type ScoreFormValues,
} from "../lib/tool/scoreSubmission";
import {
  leaderboardExclusion,
  placementLine,
  savedStatusText,
} from "../lib/tool/resultPresentation";
import { createCanonicalResult, type ScoreRequestFields } from "../lib/server/scoreService";
import type { PersistResultInput, PersistedResult, ScoreRepository } from "../lib/server/scoreRepository";
import type { ScoreResultView } from "../lib/tool/scoreSubmission";
import { around, makeSnapshot } from "./helpers/dataset";

const ACTIVE = "8bd76e2f-4cfb-47f0-8407-e5b812a6709d";

function form(overrides: Partial<ScoreFormValues> = {}): ScoreFormValues {
  return {
    displayName: "Ryan", unitSystem: "lb", bodyweight: "195", bench: "275", squat: "365", deadlift: "425",
    runDistance: "5k", runSeconds: 1350, runTimeText: "22:30", visibility: submissionVisibility(false),
    ...overrides,
  };
}

class Repo implements ScoreRepository {
  placementCalls = 0;
  /** `low` puts the reference population well below the athlete: a 90+ score. */
  constructor(private readonly low = false) {}
  async loadActiveDataset() {
    return this.low
      ? makeSnapshot(around(20, 20, 20), around(20, 20, 20), { datasetVersionId: ACTIVE })
      : makeSnapshot(around(66.9, 20, 20), around(59.1, 20, 20), { datasetVersionId: ACTIVE });
  }
  async loadDatasetVersion() { return null; }
  async persistResult(input: PersistResultInput) {
    const result: PersistedResult = {
      publicResultId: input.publicResultId, calculatedAt: input.calculatedAt, hybridScore: input.hybridScore,
      strengthIndex: input.strengthIndex, enduranceIndex: input.enduranceIndex,
      strengthPercentile: input.strengthPercentile, endurancePercentile: input.endurancePercentile,
      tier: input.tier, archetype: input.archetype, moderationStatus: input.moderationStatus,
      visibility: input.visibility, provenance: input.provenance, verificationStatus: input.verificationStatus,
      scoreVersion: input.scoreVersion, datasetVersionId: input.datasetVersionId, datasetLabel: input.datasetLabel,
      datasetKind: input.datasetKind, datasetSampleSize: input.datasetSampleSize,
      datasetConfidence: input.datasetConfidence, originalUnitSystem: input.originalUnitSystem,
      originalBodyweight: input.originalBodyweight, originalBench: input.originalBench,
      originalSquat: input.originalSquat, originalDeadlift: input.originalDeadlift,
    };
    return { result, replayed: false };
  }
  async loadPlacement() {
    this.placementCalls++;
    return { rank: 3, total: 10 };
  }
}

function request(visibility: "public" | "private", overrides: Partial<ScoreRequestFields> = {}): ScoreRequestFields {
  return {
    display_name: "Ryan", unit_system: "kg", bodyweight: 90, bench: 110, squat: 150, deadlift: 190,
    run_distance: "5k", run_seconds: 1500, visibility, idempotency_key: `g4-consent-${visibility}-0001`,
    ...overrides,
  };
}

describe("opt-in publication: submission", () => {
  it("unticked sends private, ticked sends public", () => {
    const unticked = buildScoreRequestDraft(form());
    const ticked = buildScoreRequestDraft(form({ visibility: submissionVisibility(true) }));
    assert.ok(unticked.ok && ticked.ok);
    if (!unticked.ok || !ticked.ok) return;
    assert.equal(unticked.draft.visibility, "private");
    assert.equal(ticked.draft.visibility, "public");
  });

  it("the choice is part of the submission identity: signature and idempotency key", () => {
    const a = buildScoreRequestDraft(form());
    const b = buildScoreRequestDraft(form({ visibility: submissionVisibility(true) }));
    assert.ok(a.ok && b.ok);
    if (!a.ok || !b.ok) return;
    assert.notEqual(submissionSignature(a.draft), submissionSignature(b.draft), "toggling marks the result stale");
    let n = 0;
    const first = resolveIdempotency(null, a.draft, () => `key-${++n}`);
    const toggled = resolveIdempotency(first, b.draft, () => `key-${++n}`);
    assert.notEqual(toggled.key, first.key, "a toggled submission is a new request, never a 409");
    assert.equal(resolveIdempotency(first, a.draft, () => "unused").key, first.key, "same choice replays");
  });
});

describe("opt-in publication: scoring is identical", () => {
  it("private and public results get the same score, percentiles, tier and archetype", async () => {
    const pub = await createCanonicalResult(new Repo(), request("public"));
    const priv = await createCanonicalResult(new Repo(), request("private"));
    for (const k of ["hybridScore", "strengthIndex", "enduranceIndex", "strengthPercentile", "endurancePercentile",
      "tier", "archetype", "moderationStatus", "datasetVersionId", "scoreVersion"] as const) {
      assert.equal(priv.result[k], pub.result[k], k);
    }
    assert.equal(pub.result.visibility, "public");
    assert.equal(priv.result.visibility, "private");
  });

  it("a private result receives no placement, and placement is not even computed", async () => {
    const repo = new Repo();
    const priv = await createCanonicalResult(repo, request("private"));
    assert.equal(priv.result.leaderboard, null);
    assert.equal(repo.placementCalls, 0);
    const pubRepo = new Repo();
    const pub = await createCanonicalResult(pubRepo, request("public"));
    assert.deepEqual(pub.result.leaderboard, { rank: 3, total: 10 });
  });

  it("a private 90+ result is still moderated as pending, and still unranked", async () => {
    const priv = await createCanonicalResult(new Repo(true), request("private"));
    assert.ok(priv.result.hybridScore >= 90, `score ${priv.result.hybridScore}`);
    assert.equal(priv.result.moderationStatus, "pending");
    assert.equal(priv.result.leaderboard, null);
  });
});

function view(overrides: Partial<ScoreResultView>): ScoreResultView {
  return {
    resultId: "res_abc123def456ghj789kmnpqr", hybridScore: 64, strengthIndex: 66.9, enduranceIndex: 59.1,
    strengthPercentile: 71.2, endurancePercentile: 27.5, tier: "ADVANCED", archetype: "BALANCED HYBRID",
    moderationStatus: "approved", verificationStatus: "unverified", provenance: "self_reported", visibility: "public",
    scoreVersion: "2.0.0", datasetVersionId: ACTIVE, datasetLabel: "x", datasetKind: "legacy_mixed_provisional",
    datasetSampleSize: 412, datasetConfidence: "established", calculatedAt: "2026-09-29T12:00:00.000Z",
    leaderboard: { rank: 12, total: 400 }, ...overrides,
  };
}

describe("opt-in publication: explaining the result", () => {
  it("checks visibility BEFORE moderation", () => {
    const privatePending = view({ visibility: "private", moderationStatus: "pending", leaderboard: null });
    assert.match(leaderboardExclusion(privatePending)!, /private/i);
    assert.doesNotMatch(leaderboardExclusion(privatePending)!, /review/i, "a private result is not awaiting leaderboard review");
    assert.match(placementLine(privatePending).text, /private/i);
    assert.match(savedStatusText(privatePending, false), /privately/i);
    assert.doesNotMatch(savedStatusText(privatePending, false), /review/i);
  });

  it("status text for every combination", () => {
    assert.equal(savedStatusText(view({ visibility: "private", leaderboard: null }), false), "Saved privately — it isn't on the public leaderboard.");
    assert.equal(savedStatusText(view({ visibility: "private", leaderboard: null }), true), "Already saved privately — showing your existing result.");
    assert.match(savedStatusText(view({ moderationStatus: "pending", leaderboard: null }), false), /quick review/);
    assert.equal(savedStatusText(view({}), false), "Saved.");
    assert.equal(savedStatusText(view({}), true), "Already saved — showing your existing result.");
  });

  it("a public pending result is still told about review", () => {
    assert.match(leaderboardExclusion(view({ moderationStatus: "pending", leaderboard: null }))!, /review/i);
  });
});

describe("opt-in publication: calculator wiring", () => {
  const source = readFileSync(new URL("../app/tool/page.tsx", import.meta.url), "utf8");

  it("the checkbox starts unticked and sends the choice", () => {
    assert.match(source, /useState<boolean>\(false\)/);
    assert.match(source, /const \[publishToLeaderboard, setPublishToLeaderboard\] = useState<boolean>\(false\);/);
    assert.match(source, /Add my result to the public leaderboard/);
    assert.match(source, /checked=\{publishToLeaderboard\}/);
    assert.match(source, /visibility: submissionVisibility\(publishToLeaderboard\)/);
  });

  it("the choice is in the staleness dependency list", () => {
    assert.match(source, /runTimeText, publishToLeaderboard\],/);
  });

  it("says the choice affects the next calculation only", () => {
    assert.match(source, /Applies to your next calculation\. Unticking it later won&apos;t remove a result you&apos;ve already published\./);
  });

  it("Reset returns the checkbox to unticked", () => {
    const start = source.indexOf("function resetForm()");
    assert.ok(start >= 0, "resetForm exists");
    const reset = source.slice(start, source.indexOf("goToStep(1);", start));
    assert.match(reset, /setPublishToLeaderboard\(false\)/);
    // …and it is what the Reset button runs.
    assert.match(source, /onClick=\{resetForm\}\s*className=\{BTN_SECONDARY\}\s*>\s*Reset\s*</);
  });

  it("no hardcoded public publication remains", () => {
    assert.equal(/SUBMISSION_VISIBILITY/.test(source), false);
    assert.equal(/Your result is published to the public leaderboard\./.test(source), false);
  });
});
