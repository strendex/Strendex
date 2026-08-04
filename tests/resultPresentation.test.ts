// How a saved result is described on the results page.
//
// The claims made next to a score are a product promise, so they get the same
// treatment as the scoring itself: a provisional dataset must be called
// provisional, an unverified row must never read as verified, a private result
// must never be described as listed, and placement must come from the server.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_VISIBILITY, REVIEW_THRESHOLD, VISIBILITIES } from "../lib/scoring/core";
import {
  VISIBILITY_OPTIONS,
  datasetDisclosure,
  leaderboardExclusion,
  leaderboardStanding,
  moderationLabel,
  moderationNotice,
  provenanceLabel,
  verificationNotice,
  visibilityOption,
} from "../lib/tool/resultPresentation";
import type { ScoreResultView } from "../lib/tool/scoreSubmission";

function result(overrides: Partial<ScoreResultView> = {}): ScoreResultView {
  return {
    resultId: "res_abc123def456ghj789kmnpqr",
    hybridScore: 64,
    strengthIndex: 66.9,
    enduranceIndex: 59.1,
    strengthPercentile: 71.2,
    endurancePercentile: 56.8,
    tier: "ADVANCED",
    archetype: "BALANCED HYBRID",
    moderationStatus: "approved",
    verificationStatus: "unverified",
    provenance: "self_reported",
    visibility: "public",
    scoreVersion: "2.0.0",
    datasetVersionId: "33333333-3333-3333-3333-333333333333",
    datasetLabel: "2026-08 baseline",
    datasetKind: "observed",
    datasetSampleSize: 412,
    datasetConfidence: "established",
    calculatedAt: "2026-08-04T12:00:00.000Z",
    leaderboard: { rank: 12, total: 400 },
    ...overrides,
  };
}

describe("results page: visibility choices", () => {
  it("offers every visibility the API accepts, private first", () => {
    assert.deepEqual(
      VISIBILITY_OPTIONS.map((option) => option.value),
      [...VISIBILITIES],
    );
    assert.equal(VISIBILITY_OPTIONS[0].value, DEFAULT_VISIBILITY);
  });

  it("explains each choice distinctly", () => {
    const summaries = new Set(VISIBILITY_OPTIONS.map((o) => o.summary));
    const details = new Set(VISIBILITY_OPTIONS.map((o) => o.detail));

    assert.equal(summaries.size, VISIBILITY_OPTIONS.length);
    assert.equal(details.size, VISIBILITY_OPTIONS.length);

    for (const option of VISIBILITY_OPTIONS) {
      assert.ok(option.label.length > 0);
      assert.ok(option.detail.length > 40, `${option.value} needs a real explanation`);
    }
  });

  it("does not promise link sharing that does not exist yet", () => {
    const unlisted = visibilityOption("unlisted");
    assert.match(unlisted.detail, /no result link to share yet/i);
    assert.match(unlisted.detail, /off the leaderboard/i);

    // The one-line summary is what most athletes will read, so it must not
    // advertise a feature that has not been built.
    assert.equal(
      /shareable|share it|send the link/i.test(unlisted.summary),
      false,
      "the summary must not promise link sharing",
    );
  });

  it("warns the public choice that high scores are reviewed first", () => {
    assert.match(
      visibilityOption("public").detail,
      new RegExp(`${REVIEW_THRESHOLD}`),
    );
    assert.match(visibilityOption("public").detail, /leaderboard/i);
  });

  it("falls back to private for an unrecognised value", () => {
    assert.equal(
      visibilityOption("nonsense" as never).value,
      DEFAULT_VISIBILITY,
    );
  });
});

describe("results page: dataset disclosure", () => {
  it("discloses a legacy mixed dataset as provisional", () => {
    const disclosure = datasetDisclosure(
      result({
        datasetKind: "legacy_mixed_provisional",
        datasetLabel: "2026-08 provisional legacy",
        datasetSampleSize: 412,
      }),
    );

    assert.equal(disclosure.provisional, true);
    assert.match(disclosure.headline, /provisional/i);
    assert.match(disclosure.body, /2026-08 provisional legacy/);
    assert.match(disclosure.body, /412/);
    // The population mixes simulated athletes with early self-entered numbers,
    // and the athlete has to be told so.
    assert.match(disclosure.body, /simulated/i);
    assert.equal(/\bverified\b(?!\s|$)/i.test(disclosure.headline), false);
  });

  it("flags a small observed sample as provisional too", () => {
    const disclosure = datasetDisclosure(
      result({ datasetKind: "observed", datasetConfidence: "provisional" }),
    );

    assert.equal(disclosure.provisional, true);
    assert.match(disclosure.body, /sample is still small/i);
  });

  it("stops flagging once the reference set is established", () => {
    for (const confidence of ["established", "high"] as const) {
      const disclosure = datasetDisclosure(
        result({ datasetKind: "observed", datasetConfidence: confidence }),
      );
      assert.equal(disclosure.provisional, false);
      assert.match(disclosure.body, new RegExp(confidence));
    }
  });

  it("names the dataset the result was actually scored against", () => {
    const disclosure = datasetDisclosure(result({ datasetLabel: "some other set" }));
    assert.match(disclosure.body, /some other set/);
  });
});

describe("results page: moderation and verification", () => {
  it("says a high score is held for review", () => {
    const notice = moderationNotice(result({ moderationStatus: "pending" }));
    assert.ok(notice);
    assert.match(notice.label, /review/i);
    assert.match(notice.body, new RegExp(`${REVIEW_THRESHOLD}`));
  });

  it("says nothing when the result is approved", () => {
    assert.equal(moderationNotice(result({ moderationStatus: "approved" })), null);
  });

  it("reports a rejected result plainly", () => {
    const notice = moderationNotice(result({ moderationStatus: "rejected" }));
    assert.ok(notice);
    assert.match(notice.label, /not approved/i);
  });

  it("never presents an approved result as verified", () => {
    const notice = verificationNotice(
      result({ moderationStatus: "approved", verificationStatus: "unverified" }),
    );
    assert.equal(notice.label, "Unverified");
    assert.match(notice.body, /self-entered/i);
  });

  it("reports provenance as stored, never inferred from the score", () => {
    assert.equal(provenanceLabel(result({ provenance: "self_reported" })), "Self-reported");
    assert.equal(provenanceLabel(result({ provenance: "simulated" })), "Simulated");
    assert.equal(provenanceLabel(result({ provenance: "verified" })), "Verified");
    assert.match(
      provenanceLabel(result({ provenance: "legacy_unknown" })),
      /unknown/i,
    );

    // A top score is still self-reported.
    assert.equal(
      provenanceLabel(result({ hybridScore: 99, provenance: "self_reported" })),
      "Self-reported",
    );
  });

  it("never shows a raw column value for moderation", () => {
    for (const status of ["approved", "pending", "rejected"] as const) {
      const label = moderationLabel(result({ moderationStatus: status }));
      assert.notEqual(label, status, "the raw enum must not reach the UI");
      assert.match(label, /^[A-Z]/);
    }
    assert.equal(moderationLabel(result({ moderationStatus: "pending" })), "Held for review");
  });

  it("reports the verification state the row actually carries", () => {
    assert.equal(
      verificationNotice(result({ verificationStatus: "verified" })).label,
      "Verified",
    );
    assert.equal(
      verificationNotice(result({ verificationStatus: "in_review" })).label,
      "In review",
    );
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

  for (const visibility of ["private", "unlisted"] as const) {
    it(`explains why a ${visibility} result is not listed`, () => {
      const reason = leaderboardExclusion(result({ visibility, leaderboard: null }));
      assert.ok(reason);
      assert.match(reason, new RegExp(visibility));
      assert.match(reason, /Public/);
    });
  }

  it("explains a pending public result", () => {
    const reason = leaderboardExclusion(
      result({ visibility: "public", moderationStatus: "pending", leaderboard: null }),
    );
    assert.ok(reason);
    assert.match(reason, new RegExp(`${REVIEW_THRESHOLD}`));
  });

  it("says nothing when the result is listed", () => {
    assert.equal(leaderboardExclusion(result()), null);
  });
});
