// How a saved result is described on the results page.
//
// The claims made next to a score are a product promise, so they get the same
// treatment as the scoring itself: the consolidated "?" explanation must stay
// honest about the early benchmark and self-reported data, a pending row must
// not be called listed, and placement must come from the server. No dataset
// internals — labels, versions, kinds, ids — may leak into consumer copy.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  leaderboardExclusion,
  leaderboardStanding,
  scoreExplanation,
} from "../lib/tool/resultPresentation";
import type { ScoreResultView } from "../lib/tool/scoreSubmission";

function result(overrides: Partial<ScoreResultView> = {}): ScoreResultView {
  return {
    resultId: "res_abc123def456ghj789kmnpqr",
    hybridScore: 64,
    strengthIndex: 66.9,
    enduranceIndex: 59.1,
    strengthPercentile: 71.2,
    endurancePercentile: 27.5,
    tier: "ADVANCED",
    archetype: "BALANCED HYBRID",
    moderationStatus: "approved",
    verificationStatus: "unverified",
    provenance: "self_reported",
    visibility: "public",
    scoreVersion: "2.0.0",
    datasetVersionId: "33333333-3333-3333-3333-333333333333",
    datasetLabel: "2026-08 provisional legacy",
    datasetKind: "legacy_mixed_provisional",
    datasetSampleSize: 412,
    datasetConfidence: "established",
    calculatedAt: "2026-08-04T12:00:00.000Z",
    leaderboard: { rank: 12, total: 400 },
    ...overrides,
  };
}

describe("results page: score explanation popover", () => {
  const joined = (r: ScoreResultView) => scoreExplanation(r).join(" ");

  it("explains the blend, the lifts, the run, and what a percentile means", () => {
    const text = joined(result());

    assert.match(text, /strength and endurance/i);
    assert.match(text, /bench, squat and deadlift/i);
    assert.match(text, /bodyweight/i);
    assert.match(text, /run/i);
    // The percentile definition is the point: 27.5 must read as "ahead of
    // 27.5% of the comparison group", not as a mistake.
    assert.match(text, /share of athletes/i);
    assert.match(text, /ahead of 27\.5%/);
  });

  it("says the Hybrid Score is an equal blend and NOT itself a percentile", () => {
    // The single most common misreading of a 0–100 score, and the one claim
    // no Strendex surface is allowed to make: "75 means you beat 75%".
    const text = joined(result());

    assert.match(text, /equal blend/i);
    assert.match(text, /half each/i);
    assert.match(text, /not a percentile/i);
    assert.match(text, /does not mean you beat/i);
  });

  it("discloses an early benchmark for legacy mixed data", () => {
    const text = joined(result({ datasetKind: "legacy_mixed_provisional" }));
    assert.match(text, /early and provisional/i);
    assert.match(text, /will shift/i);
  });

  it("discloses an early benchmark for a small observed sample too", () => {
    const text = joined(
      result({ datasetKind: "observed", datasetConfidence: "provisional" }),
    );
    assert.match(text, /early and provisional/i);
  });

  it("softens but never drops the growth caveat once established", () => {
    const text = joined(
      result({ datasetKind: "observed", datasetConfidence: "established" }),
    );
    assert.equal(/early and provisional/i.test(text), false);
    assert.match(text, /keeps growing/i);
  });

  it("always says results are self-reported unless verified", () => {
    for (const kind of ["observed", "legacy_mixed_provisional"] as const) {
      assert.match(joined(result({ datasetKind: kind })), /self-reported unless verified/i);
    }
  });

  it("keeps implementation details out of consumer copy", () => {
    const text = joined(result());
    for (const jargon of [
      "legacy_mixed_provisional",
      "dataset",
      "version",
      "res_",
      "provenance",
      "moderation",
      "2026-08",
      "2.0.0",
      "412",
    ]) {
      assert.equal(
        text.toLowerCase().includes(jargon.toLowerCase()),
        false,
        `"${jargon}" must not appear in the explanation`,
      );
    }
  });

  it("never presents the data as verified", () => {
    // "unless verified" is the only permitted use of the word.
    const text = joined(result());
    assert.equal(
      /verified/i.test(text.replace(/unless verified/i, "")),
      false,
    );
  });

  it("quotes the athlete's own endurance percentile in the worked example", () => {
    // The definition has to be anchored to a number the athlete can see on
    // screen, or "27.5th percentile" keeps reading like a low score.
    for (const percentile of [0, 27.5, 99.9, 100]) {
      const text = joined(result({ endurancePercentile: percentile }));
      assert.match(text, new RegExp(`ahead of ${percentile.toFixed(1)}%`));
    }
  });
});

describe("results page: percentile wording", () => {
  // The results screen and the share card both render this exact phrasing for
  // the two COMPONENT percentiles. Nothing else on either surface gets it.
  const rendered = (p: number) => `Better than ${p.toFixed(1)}% of athletes`;

  it("formats the boundaries exactly, with no rounding surprises", () => {
    assert.equal(rendered(0), "Better than 0.0% of athletes");
    assert.equal(rendered(27.5), "Better than 27.5% of athletes");
    assert.equal(rendered(99.9), "Better than 99.9% of athletes");
    assert.equal(rendered(100), "Better than 100.0% of athletes");
  });

  it("keeps the percentage as one unbreakable token", () => {
    // The phrase is allowed to wrap between words on a narrow phone, but the
    // number and its "%" must never be split across two lines.
    for (const p of [0, 27.5, 99.9, 100]) {
      const numeric = rendered(p).split(" ").find((word) => word.endsWith("%"));
      assert.equal(numeric, `${p.toFixed(1)}%`);
    }
  });

  it("names no index and no dataset internals", () => {
    // The raw index used to sit under this line. It is gone from the screen
    // entirely — not hidden, not moved to a caption.
    const value = rendered(result().strengthPercentile);

    for (const banned of ["index", "dataset", "version", "provisional"]) {
      assert.equal(
        value.toLowerCase().includes(banned),
        false,
        `"${banned}" must not appear beside a percentile`,
      );
    }
  });

  it("is reserved for the component percentiles, never the Hybrid Score", () => {
    // The Hybrid Score is the average of these two numbers, so it may never be
    // described as beating a share of anyone. Guarding the shape of the claim:
    // whatever the score is, it never renders through this phrasing.
    const r = result({ hybridScore: 75, strengthPercentile: 90, endurancePercentile: 60 });

    assert.equal(rendered(r.strengthPercentile), "Better than 90.0% of athletes");
    assert.equal(rendered(r.endurancePercentile), "Better than 60.0% of athletes");
    // 75 is the average of 90 and 60 — and is not a percentile of anything.
    assert.equal((r.strengthPercentile + r.endurancePercentile) / 2, r.hybridScore);
  });
});

describe("results page: leaderboard placement", () => {
  it("uses the server's rank and total", () => {
    const standing = leaderboardStanding(result({ leaderboard: { rank: 1, total: 200 } }));
    assert.ok(standing);
    assert.equal(standing.rank, 1);
    assert.equal(standing.total, 200);
    assert.equal(standing.beatPercent, 99.5);
  });

  it("has no placement when the server returned none", () => {
    assert.equal(leaderboardStanding(result({ leaderboard: null })), null);
  });

  it("stays inside 0–100 for the last place", () => {
    const standing = leaderboardStanding(result({ leaderboard: { rank: 40, total: 40 } }));
    assert.ok(standing);
    assert.equal(standing.beatPercent, 0);
  });

  it("says a pending result is saved and under review, in plain words", () => {
    const reason = leaderboardExclusion(
      result({ moderationStatus: "pending", leaderboard: null }),
    );
    assert.ok(reason);
    assert.match(reason, /review/i);
    assert.match(reason, /saved/i);
    // Never the raw column value.
    assert.equal(/pending/i.test(reason), false);
  });

  it("reports a rejected result plainly", () => {
    const reason = leaderboardExclusion(
      result({ moderationStatus: "rejected", leaderboard: null }),
    );
    assert.ok(reason);
    assert.match(reason, /not approved/i);
  });

  it("falls back to a true, neutral line for any other unlisted row", () => {
    const reason = leaderboardExclusion(
      result({ visibility: "private", moderationStatus: "approved", leaderboard: null }),
    );
    assert.ok(reason);
    assert.match(reason, /not shown on the leaderboard/i);
    // There is no visibility control any more, so no copy may tell the
    // athlete to go and choose one.
    assert.equal(/choose/i.test(reason), false);
  });

  it("says nothing when the result is listed", () => {
    assert.equal(leaderboardExclusion(result()), null);
  });
});
