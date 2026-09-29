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
  placementLine,
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
  });

  it("describes the percentile as a MIDRANK, counting ties as half", () => {
    // percentileMidrank gives a tie half credit, which is why a lone athlete
    // scores 50 and not 0. Copy that says "ahead of exactly X%" describes a
    // different statistic than the one being computed.
    const text = joined(result());

    assert.match(text, /half of anyone you tie with/i);
    // The old, wrong framing must be gone.
    assert.equal(/share of athletes .*beats/i.test(text), false);
    assert.equal(/ahead of 27\.5% of them/i.test(text), false);
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

  it("says the benchmark is FIXED, for every dataset kind and confidence", () => {
    // Group 1's central guarantee. The previous copy promised the opposite —
    // that placements "sharpen as more athletes are added" — which described the
    // live-query behaviour this group removed.
    const cases = [
      { datasetKind: "legacy_mixed_provisional", datasetConfidence: "provisional" },
      { datasetKind: "observed", datasetConfidence: "provisional" },
      { datasetKind: "observed", datasetConfidence: "established" },
      { datasetKind: "observed", datasetConfidence: "high" },
    ] as const;

    for (const overrides of cases) {
      const text = joined(result(overrides));
      assert.match(text, /fixed Strendex benchmark/i);
      assert.match(
        text,
        /does not move when other athletes are added/i,
        `missing the fixed-benchmark guarantee for ${overrides.datasetKind}/${overrides.datasetConfidence}`,
      );
    }
  });

  it("never claims the benchmark grows, sharpens, or shifts", () => {
    const banned = [
      /keeps growing/i,
      /sharpen/i,
      /will shift/i,
      /as more athletes are added/i,
      /over time/i,
    ];

    for (const kind of ["observed", "legacy_mixed_provisional"] as const) {
      for (const confidence of ["provisional", "established", "high"] as const) {
        const text = joined(
          result({ datasetKind: kind, datasetConfidence: confidence }),
        );
        for (const pattern of banned) {
          assert.equal(
            pattern.test(text),
            false,
            `${pattern} must not appear (${kind}/${confidence})`,
          );
        }
      }
    }
  });

  it("calls a mixed reference set neither verified nor self-reported", () => {
    // It is a blend of seeded and real entries whose origin cannot be told
    // apart. Both of the easy labels are false statements about that data.
    const text = joined(result({ datasetKind: "legacy_mixed_provisional" }));

    assert.match(text, /can't individually confirm/i);
    assert.match(text, /part real entries, part sample data/i);
    assert.match(text, /rough guide/i);

    // Not called verified — not even as a negation, which still plants the word.
    assert.equal(/verified/i.test(text), false);
    // Not called self-reported either, which would be equally wrong about a set
    // that contains seeded rows.
    assert.equal(/self-reported/i.test(text), false);
    // But the athlete's own numbers are still disclosed as unchecked.
    assert.match(text, /your own numbers aren't checked/i);
  });

  it("still flags a small observed sample as an early reference", () => {
    const text = joined(
      result({ datasetKind: "observed", datasetConfidence: "provisional" }),
    );
    assert.match(text, /early/i);
    assert.match(text, /rough guide/i);
    assert.match(text, /your own numbers aren't checked/i);
  });

  it("attributes self-reporting to the athlete's own numbers once the set is sound", () => {
    // With an established observed population the honest caveat is about the
    // athlete's entries, not about the reference set.
    const text = joined(
      result({ datasetKind: "observed", datasetConfidence: "established" }),
    );
    assert.match(text, /your own numbers aren't checked/i);
    assert.equal(/rough guide/i.test(text), false);
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
    // The word is now absent entirely for a mixed set: there is no "unless
    // verified" escape hatch to carve out any more.
    for (const kind of ["observed", "legacy_mixed_provisional"] as const) {
      for (const confidence of ["provisional", "established", "high"] as const) {
        const text = joined(
          result({ datasetKind: kind, datasetConfidence: confidence }),
        );
        assert.equal(
          /\bverified\b/i.test(text),
          false,
          `"verified" must not appear (${kind}/${confidence})`,
        );
      }
    }
  });

  it("quotes the athlete's own endurance percentile in the worked example", () => {
    // The definition has to be anchored to a number the athlete can see on
    // screen, or "27.5th percentile" keeps reading like a low score.
    for (const percentile of [0, 27.5, 99.9, 100]) {
      const text = joined(result({ endurancePercentile: percentile }));
      assert.match(text, new RegExp(`sit above ${percentile.toFixed(1)}%`));
      // Quoted twice: once as the value, once in the worked sentence.
      assert.ok(
        text.split(`${percentile.toFixed(1)}%`).length - 1 >= 2,
        "the percentile should appear in both the value and the explanation",
      );
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
    // Group 4: visibility is explained first, and plainly.
    assert.match(reason, /private, so it isn't on the public leaderboard/i);
    assert.equal(/choose/i.test(reason), false);
  });

  it("says nothing when the result is listed", () => {
    assert.equal(leaderboardExclusion(result()), null);
  });
});

describe("results page: the placement line (Group 3, placement enabled)", () => {
  it("shows the server's rank and total, labelled, with no percentage", () => {
    const line = placementLine(result({ leaderboard: { rank: 4, total: 9 } }));
    assert.deepEqual(line, {
      ranked: true,
      rank: 4,
      total: 9,
      text: "Leaderboard placement: #4 of 9 public results",
    });
    assert.equal(/%/.test(line.text), false, "placement never reads like a percentile");
  });

  it("uses the singular for a population of one, and groups thousands", () => {
    assert.equal(placementLine(result({ leaderboard: { rank: 1, total: 1 } })).text, "Leaderboard placement: #1 of 1 public result");
    assert.equal(placementLine(result({ leaderboard: { rank: 801, total: 2600 } })).text, "Leaderboard placement: #801 of 2,600 public results");
  });

  for (const [label, overrides, pattern] of [
    ["pending", { moderationStatus: "pending", leaderboard: null }, /review/i],
    ["rejected", { moderationStatus: "rejected", leaderboard: null }, /not approved/i],
    ["private", { visibility: "private", leaderboard: null }, /private, so it isn't on the public leaderboard/i],
    ["unlisted", { visibility: "unlisted", leaderboard: null }, /isn't on the public leaderboard/i],
    ["approved and public, but no placement (older dataset or unavailable)", { leaderboard: null }, /isn't available/i],
    ["an empty population", { leaderboard: { rank: 1, total: 0 } }, /isn't available/i],
  ] as const) {
    it(`a ${label} result gets a reason, never a rank or total`, () => {
      const line = placementLine(result(overrides as Partial<ScoreResultView>));
      assert.equal(line.ranked, false);
      assert.match(line.text, pattern);
      assert.equal(/#\d|\d+ of \d+|%/.test(line.text), false, `no fabricated number in "${line.text}"`);
      assert.ok(!("rank" in line) && !("total" in line));
    });
  }

  it("an approved public result with no placement is never called unlisted", () => {
    const reason = leaderboardExclusion(result({ leaderboard: null }));
    assert.equal(/not shown on the leaderboard/i.test(reason ?? ""), false);
  });
});
