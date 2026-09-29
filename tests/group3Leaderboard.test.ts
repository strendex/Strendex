// Group 3 — one leaderboard rule for /rankings and calculator placement.
//
// No network or database: Supabase is a recording fake. Nothing here calls
// OpenAI.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LEADERBOARD_PAGE_SIZE,
  compareLeaderboardRows,
  isLeaderboardEligible,
  leaderboardCountText,
  placementFor,
  placementFromCounts,
  rankLeaderboard,
  sortLeaderboard,
  type LeaderboardScope,
  type LeaderboardSourceRow,
} from "../lib/leaderboard";
import {
  REVIEW_THRESHOLD,
  SCORE_VERSION,
  competitionRank,
  datasetConfidence,
} from "../lib/scoring/core";
import { computeDatasetHash } from "../lib/server/hashing";
import { loadRankings } from "../lib/server/rankings";
import {
  createSupabaseScoreRepository,
  loadLeaderboardPage,
} from "../lib/server/scoreRepository";
import RankingsView from "../app/rankings/RankingsView";

const ACTIVE = "8bd76e2f-4cfb-47f0-8407-e5b812a6709d";
const OTHER = "11111111-2222-3333-4444-555555555555";
const SCOPE: LeaderboardScope = { datasetVersionId: ACTIVE, scoreVersion: SCORE_VERSION };

// --- a recording Supabase fake ---------------------------------------------------

type Call = { table: string; method: string; args: unknown[] };

function fakeSupabase(tables: Record<string, { data: unknown; error?: unknown; count?: number | null }>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null, count: 0 };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "not", "in", "order", "limit", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
        const isSingle = calls.some((c) => c.table === table && c.method === "maybeSingle");
        const data =
          isSingle && Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
        return Promise.resolve({
          data,
          error: result.error ?? null,
          count: result.count ?? null,
        }).then(onOk, onErr);
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function row(i: number, score: number, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    athlete_name: `Athlete ${i}`,
    hq_score: score,
    tier: "ADVANCED",
    archetype: "BALANCED HYBRID",
    created_at: createdAt,
    ...extra,
  };
}

function datasetRow(id = ACTIVE) {
  const strength = Array.from({ length: 40 }, (_, i) => i * 2.5);
  const endurance = Array.from({ length: 40 }, (_, i) => 100 - i * 2.5);
  return {
    id,
    label: "test",
    kind: "legacy_mixed_provisional",
    score_version: SCORE_VERSION,
    strength_reference: strength,
    endurance_reference: endurance,
    eligible_sample_size: 40,
    confidence: datasetConfidence(40),
    dataset_hash: computeDatasetHash({
      scoreVersion: SCORE_VERSION,
      datasetKind: "legacy_mixed_provisional",
      eligibleSampleSize: 40,
      strengthReference: strength,
      enduranceReference: endurance,
    }),
  };
}

// --- eligibility -----------------------------------------------------------------

describe("leaderboard eligibility (shared by /rankings and placement)", () => {
  const base = {
    moderationStatus: "approved",
    visibility: "public",
    datasetVersionId: ACTIVE,
    scoreVersion: SCORE_VERSION,
  };

  it("admits only approved, public results of the active dataset AND score version", () => {
    assert.equal(isLeaderboardEligible(base, SCOPE), true);
    for (const [label, change] of [
      ["pending", { moderationStatus: "pending" }],
      ["rejected", { moderationStatus: "rejected" }],
      ["private", { visibility: "private" }],
      ["unlisted", { visibility: "unlisted" }],
      ["inactive dataset", { datasetVersionId: OTHER }],
      ["legacy (no dataset)", { datasetVersionId: null }],
      ["other score version", { scoreVersion: "2.1.0" }],
      ["legacy (no score version)", { scoreVersion: null }],
    ] as const) {
      assert.equal(isLeaderboardEligible({ ...base, ...change }, SCOPE), false, label);
    }
  });

  it("writes the same rule as the query /rankings and placement run", async () => {
    const { client, calls } = fakeSupabase({ submissions: { data: [], count: 0 } });
    await loadLeaderboardPage(client, SCOPE);
    const eqs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    assert.deepEqual(eqs, [
      ["dataset_version_id", ACTIVE],
      ["score_version", SCORE_VERSION],
      ["status", "approved"],
      ["visibility", "public"],
    ]);
    assert.deepEqual(
      calls.filter((c) => c.method === "not").map((c) => c.args),
      [["hq_score", "is", null]],
    );
  });

  it("selects only the public display fields, with an exact count", async () => {
    const { client, calls } = fakeSupabase({ submissions: { data: [], count: 0 } });
    await loadLeaderboardPage(client, SCOPE);
    const select = calls.find((c) => c.method === "select")!;
    assert.equal(select.args[0], "id,athlete_name,hq_score,tier,archetype,created_at");
    assert.deepEqual(select.args[1], { count: "exact" });
    for (const secret of ["original_", "idempotency", "fingerprint", "moderat", "status", "visibility"]) {
      assert.ok(!String(select.args[0]).includes(secret), secret);
    }
  });

  it("orders by score, then earliest, then id, and pages at 200", async () => {
    const { client, calls } = fakeSupabase({ submissions: { data: [], count: 0 } });
    await loadLeaderboardPage(client, SCOPE);
    assert.deepEqual(
      calls.filter((c) => c.method === "order").map((c) => c.args),
      [
        ["hq_score", { ascending: false }],
        ["created_at", { ascending: true }],
        ["id", { ascending: true }],
      ],
    );
    assert.deepEqual(calls.find((c) => c.method === "limit")!.args, [LEADERBOARD_PAGE_SIZE]);
    assert.equal(LEADERBOARD_PAGE_SIZE, 200);
  });
});

// --- ranking -----------------------------------------------------------------------

describe("competition ranks and ties", () => {
  const rows: LeaderboardSourceRow[] = [
    { id: "b", name: "Late tie", score: 80, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-02T00:00:00Z" },
    { id: "d", name: "Last", score: 70, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-01T00:00:00Z" },
    { id: "a", name: "Top", score: 90, tier: "ELITE", archetype: "X", createdAt: "2026-09-05T00:00:00Z" },
    { id: "c", name: "Early tie", score: 80, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-01T00:00:00Z" },
    { id: "e", name: "Same-time tie, id e", score: 80, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-01T00:00:00Z" },
  ];

  it("ties share a rank: 1, 2, 2, 2, 5", () => {
    const ranked = rankLeaderboard(rows);
    assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 2, 2, 5]);
  });

  it("orders ties by created_at, then id", () => {
    assert.deepEqual(
      rankLeaderboard(rows).map((r) => r.name),
      ["Top", "Early tie", "Same-time tie, id e", "Late tie", "Last"],
    );
    assert.ok(compareLeaderboardRows(rows[3], rows[4]) < 0, "same time: id c before id e");
  });

  it("gives every row exactly the rank calculator placement would", () => {
    const scores = rows.map((r) => r.score);
    for (const entry of rankLeaderboard(rows)) {
      assert.equal(entry.rank, competitionRank(scores, entry.score));
      assert.equal(entry.rank, placementFor(scores, entry.score).rank);
    }
    assert.deepEqual(placementFor(scores, 80), { rank: 2, total: 5 });
  });

  it("never passes the row id to the page", () => {
    for (const entry of rankLeaderboard(rows)) assert.ok(!("id" in entry));
  });

  it("sorting by name or newest keeps the score rank", () => {
    const ranked = rankLeaderboard(rows);
    const rankOf = new Map(ranked.map((e) => [e.name, e.rank]));
    for (const sort of ["NAME_ASC", "NEWEST", "SCORE_DESC"] as const) {
      for (const e of sortLeaderboard(ranked, sort)) assert.equal(e.rank, rankOf.get(e.name), sort);
    }
    assert.equal(sortLeaderboard(ranked, "NAME_ASC")[0].name, "Early tie");
    assert.equal(sortLeaderboard(ranked, "NAME_ASC")[0].rank, 2, "first by name is still #2");
    assert.equal(sortLeaderboard(ranked, "NEWEST")[0].name, "Top");
  });
});

// --- counts beyond the page ---------------------------------------------------------

describe("counts cover the whole eligible population", () => {
  it("reports the full count when more than 200 results are eligible", async () => {
    const page = Array.from({ length: 200 }, (_, i) =>
      row(i, 95 - Math.floor(i / 10), `2026-09-01T00:${String(i % 60).padStart(2, "0")}:00Z`),
    );
    const { client } = fakeSupabase({ submissions: { data: page, count: 1234 } });
    const result = await loadLeaderboardPage(client, SCOPE);
    assert.equal(result.total, 1234);
    assert.equal(result.rows.length, 200);
    assert.equal(
      leaderboardCountText(result.rows.length, result.total),
      "Showing the top 200 of 1,234 ranked results",
    );
  });

  it("calls rows results, not athletes", () => {
    assert.equal(leaderboardCountText(1, 1), "1 ranked result");
    assert.equal(leaderboardCountText(7, 7), "7 ranked results");
    assert.equal(leaderboardCountText(0, 0), "0 ranked results");
  });

  it("fails closed when the count is missing or smaller than the page", async () => {
    const missing = fakeSupabase({ submissions: { data: [row(1, 80, "2026-09-01T00:00:00Z")], count: null } });
    await assert.rejects(() => loadLeaderboardPage(missing.client, SCOPE), /count/);
    const short = fakeSupabase({
      submissions: { data: [row(1, 80, "2026-09-01T00:00:00Z"), row(2, 70, "2026-09-01T00:00:00Z")], count: 1 },
    });
    await assert.rejects(() => loadLeaderboardPage(short.client, SCOPE), /count/);
  });

  it("fails closed on an unreadable row rather than dropping it", async () => {
    const { client } = fakeSupabase({
      submissions: { data: [row(1, 80, "2026-09-01T00:00:00Z", { tier: "LEGEND" })], count: 1 },
    });
    await assert.rejects(() => loadLeaderboardPage(client, SCOPE));
  });
});

// --- /rankings data and states ---------------------------------------------------------

describe("/rankings data", () => {
  it("scopes to the ACTIVE dataset and current score version", async () => {
    const { client, calls } = fakeSupabase({
      scoring_dataset_versions: { data: [datasetRow()] },
      submissions: { data: [row(1, 81, "2026-09-28T22:13:16Z")], count: 1 },
    });
    const data = await loadRankings(client);
    assert.equal(data.status, "ok");
    if (data.status !== "ok") return;
    assert.equal(data.total, 1);
    assert.deepEqual(Object.keys(data.entries[0]).sort(), ["archetype", "createdAt", "name", "rank", "score", "tier"]);
    const dsCalls = calls.filter((c) => c.table === "scoring_dataset_versions" && c.method === "eq");
    assert.deepEqual(dsCalls.map((c) => c.args), [["score_version", SCORE_VERSION], ["lifecycle", "active"], ["frozen", true]]);
    const subEq = calls.filter((c) => c.table === "submissions" && c.method === "eq").map((c) => c.args);
    assert.deepEqual(subEq[0], ["dataset_version_id", ACTIVE]);
  });

  it("is empty — not an error — when nothing is eligible", async () => {
    const { client } = fakeSupabase({
      scoring_dataset_versions: { data: [datasetRow()] },
      submissions: { data: [], count: 0 },
    });
    assert.deepEqual(await loadRankings(client), { status: "ok", total: 0, entries: [] });
  });

  it("is unavailable with no active dataset, and on a read failure", async () => {
    const none = fakeSupabase({ scoring_dataset_versions: { data: [] } });
    assert.deepEqual(await loadRankings(none.client), { status: "unavailable" });
    const broken = fakeSupabase({
      scoring_dataset_versions: { data: [datasetRow()] },
      submissions: { data: null, error: { message: "boom" }, count: null },
    });
    assert.deepEqual(await loadRankings(broken.client), { status: "unavailable" });
  });
});

describe("/rankings view", () => {
  const render = (data: Parameters<typeof RankingsView>[0]["data"]) =>
    renderToStaticMarkup(createElement(RankingsView, { data }));

  it("shows a clear empty state", () => {
    const html = render({ status: "ok", total: 0, entries: [] });
    assert.match(html, /No ranked results yet/);
    assert.match(html, /Scores of 90 or higher are reviewed first/);
    assert.doesNotMatch(html, /athletes/i);
  });

  it("describes the population honestly and never as the benchmark", () => {
    const html = render({ status: "ok", total: 0, entries: [] });
    assert.match(html, /self-reported results/);
    assert.match(html, /separate reference dataset, which is not listed here/);
    assert.doesNotMatch(html, /simulated data/);
    assert.doesNotMatch(html, /517|519/);
  });

  it("shows ranks, shared ties and the full count", () => {
    const html = render({
      status: "ok",
      total: 250,
      entries: rankLeaderboard([
        { id: "a", name: "One", score: 90, tier: "ELITE", archetype: "X", createdAt: "2026-09-01T00:00:00Z" },
        { id: "b", name: "Two", score: 80, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-01T00:00:00Z" },
        { id: "c", name: "Three", score: 80, tier: "ADVANCED", archetype: "X", createdAt: "2026-09-02T00:00:00Z" },
      ]),
    });
    assert.match(html, /Showing the top 3 of 250 ranked results/);
    assert.match(html, /Tied scores share a rank/);
    const ranks = [...html.matchAll(/#(?:<!-- -->)?(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(ranks.includes(2) && !ranks.includes(3), `ranks ${ranks}`);
  });

  it("shows an unavailable state without database detail", () => {
    const html = render({ status: "unavailable" });
    assert.match(html, /temporarily unavailable/);
  });
});

// --- migrations (static) -------------------------------------------------------------

describe("Group 3 migrations", () => {
  const read = (f: string) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8");
  const code = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");

  it("moderation keeps the 90 threshold and needs a non-blank operator", () => {
    const sql = code(read("20260929_01_submissions_moderation.sql"));
    assert.equal(REVIEW_THRESHOLD, 90);
    assert.match(sql, /status = 'approved' AND \(hq_score IS NULL OR hq_score < 90\)/);
    assert.match(sql, /moderated_at IS NOT NULL\s+AND moderated_by IS NOT NULL\s+AND char_length\(btrim\(moderated_by\)\)/);
    assert.doesNotMatch(sql, /UPDATE public\.submissions/i, "no backfill");
  });

  it("the write revoke never touches SELECT", () => {
    const sql = code(read("20260929_02_submissions_revoke_public_writes.sql"));
    const revoke = sql.match(/REVOKE[\s\S]*?;/)![0];
    assert.doesNotMatch(revoke, /SELECT/);
    assert.match(revoke, /FROM PUBLIC, anon, authenticated/);
  });

  it("the SELECT revoke refuses to run without the deployment confirmation", () => {
    const sql = code(read("20260929_03_submissions_revoke_public_select.sql"));
    assert.ok(sql.indexOf("confirm_rankings_server_rendered") < sql.indexOf("REVOKE SELECT"));
  });
});

// --- API row caps (PostgREST max-rows) ------------------------------------------------

/**
 * A PostgREST stand-in with a max-rows cap: every response carries at most
 * `cap` rows, while count=exact is computed by "Postgres" over the whole
 * filtered set — exactly how the real API behaves. Filters and ordering are
 * applied for real.
 */
function cappedPostgrest(rows: Record<string, unknown>[], cap: number) {
  const requests: Array<{ head: boolean; returned: number; rpc?: string }> = [];
  const client = {
    // public.leaderboard_placement: ONE statement over the whole table, so
    // both counts see the same rows. Mirrors the migration's WHERE clause.
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "leaderboard_placement");
      const eligible = rows.filter(
        (r) =>
          r.dataset_version_id === args.p_dataset_version_id &&
          r.score_version === args.p_score_version &&
          r.status === "approved" &&
          r.visibility === "public" &&
          r.hq_score !== null &&
          r.hq_score !== undefined,
      );
      requests.push({ head: false, returned: 0, rpc: name });
      return {
        data: {
          higher: eligible.filter((r) => (r.hq_score as number) > (args.p_score as number)).length,
          total: eligible.length,
        },
        error: null,
      };
    },
    from() {
      const preds: Array<(r: Record<string, unknown>) => boolean> = [];
      const orders: Array<[string, boolean]> = [];
      let opts: { count?: string; head?: boolean } = {};
      let limit = Number.POSITIVE_INFINITY;
      const b: Record<string, unknown> = {};
      b.select = (_cols: string, o: typeof opts = {}) => ((opts = o), b);
      b.eq = (c: string, v: unknown) => (preds.push((r) => r[c] === v), b);
      b.not = (c: string, op: string, v: unknown) => {
        assert.equal(op, "is");
        assert.equal(v, null);
        preds.push((r) => r[c] !== null && r[c] !== undefined);
        return b;
      };
      b.gt = (c: string, v: number) => (preds.push((r) => (r[c] as number) > v), b);
      b.order = (c: string, o: { ascending: boolean }) => (orders.push([c, o.ascending]), b);
      b.limit = (n: number) => ((limit = n), b);
      b.then = (onOk: (v: unknown) => unknown) => {
        let found = rows.filter((r) => preds.every((p) => p(r)));
        const count = opts.count === "exact" ? found.length : null;
        for (const [c, asc] of [...orders].reverse()) {
          found = [...found].sort((x, y) => {
            const a = x[c] as number | string, d = y[c] as number | string;
            return (a < d ? -1 : a > d ? 1 : 0) * (asc ? 1 : -1);
          });
        }
        const data = opts.head ? null : found.slice(0, Math.min(limit, cap));
        requests.push({ head: Boolean(opts.head), returned: data?.length ?? 0 });
        return Promise.resolve({ data, error: null, count }).then(onOk);
      };
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, requests };
}

/**
 * 2,600 eligible results stored LOWEST score first, so every score above 70
 * sits beyond the first 1,000 rows a capped read would return. Plenty of ties
 * at 70. Plus ineligible rows of every kind, which must not be counted.
 */
function bigPopulation() {
  const eligible = (score: number, i: number) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    athlete_name: `Athlete ${i}`,
    hq_score: score,
    tier: "ADVANCED",
    archetype: "BALANCED HYBRID",
    created_at: new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString(),
    dataset_version_id: ACTIVE,
    score_version: SCORE_VERSION,
    status: "approved",
    visibility: "public",
  });
  const rows: Record<string, unknown>[] = [];
  let i = 0;
  for (let n = 0; n < 1100; n++) rows.push(eligible(20 + (n % 40), i++)); // 20–59
  for (let n = 0; n < 700; n++) rows.push(eligible(70, i++)); // ties at 70
  for (let n = 0; n < 800; n++) rows.push(eligible(71 + (n % 29), i++)); // 71–99
  // Ineligible: must never be counted, even when they outscore everyone.
  rows.push({ ...eligible(99, i++), status: "pending" });
  rows.push({ ...eligible(99, i++), status: "rejected" });
  rows.push({ ...eligible(99, i++), visibility: "private" });
  rows.push({ ...eligible(99, i++), dataset_version_id: OTHER });
  rows.push({ ...eligible(99, i++), score_version: "1.9.0" });
  rows.push({ ...eligible(99, i++), dataset_version_id: null, score_version: null });
  rows.push({ ...eligible(99, i++), hq_score: null });
  return rows;
}

describe("placement is exact beyond the API row cap", () => {
  const rows = bigPopulation();
  const eligibleScores = rows
    .filter((r) => isLeaderboardEligible(
      {
        moderationStatus: String(r.status),
        visibility: String(r.visibility),
        datasetVersionId: r.dataset_version_id as string | null,
        scoreVersion: r.score_version as string | null,
      },
      SCOPE,
    ) && r.hq_score !== null)
    .map((r) => r.hq_score as number);

  it("fixture: 2,600 eligible, and a capped list read really would truncate", async () => {
    assert.equal(eligibleScores.length, 2600);
    const { client } = cappedPostgrest(rows, 1000);
    // The pre-fix approach: fetch every eligible score, then use its length.
    const { data } = await (client.from("submissions") as unknown as {
      select: (c: string) => { eq: (c: string, v: unknown) => unknown };
    }).select("hq_score").eq("status", "approved") as unknown as { data: unknown[] };
    assert.equal(data.length, 1000, "the API returned only the first 1,000 rows");
  });

  for (const score of [70, 20, 99, 100, 59, 71]) {
    it(`score ${score}: rank = 1 + strictly higher over ALL 2,600, total = 2,600`, async () => {
      const { client, requests } = cappedPostgrest(rows, 1000);
      const placement = await createSupabaseScoreRepository(client).loadPlacement(SCOPE, score);
      const higher = eligibleScores.filter((s) => s > score).length;
      assert.deepEqual(placement, { rank: higher + 1, total: 2600 });
      assert.deepEqual(placement, placementFor(eligibleScores, score));
      assert.deepEqual(requests, [{ head: false, returned: 0, rpc: "leaderboard_placement" }], "one statement, no rows");
    });
  }

  it("ties at 70 all share the rank behind the 800 higher results", async () => {
    const { client } = cappedPostgrest(rows, 1000);
    assert.deepEqual(
      await createSupabaseScoreRepository(client).loadPlacement(SCOPE, 70),
      { rank: 801, total: 2600 },
    );
  });

  it("placementFromCounts equals competitionRank over any population", () => {
    const scores = [95, 80, 80, 70, 70, 70, 50, 0, 100, 80];
    for (const s of [...new Set(scores)]) {
      const higher = scores.filter((x) => x > s).length;
      assert.deepEqual(placementFromCounts(higher, scores.length), placementFor(scores, s));
      assert.equal(placementFromCounts(higher, scores.length).rank, competitionRank(scores, s));
    }
  });

  it("/rankings shows the true top 200 and the full count under the cap", async () => {
    const { client } = cappedPostgrest(rows, 1000);
    const page = await loadLeaderboardPage(client, SCOPE);
    assert.equal(page.total, 2600);
    assert.equal(page.rows.length, 200);
    assert.equal(page.rows[0].score, 99, "the highest scores are beyond row 1,000 in storage");
    const ranked = rankLeaderboard(page.rows);
    for (const e of ranked) assert.equal(e.rank, competitionRank(eligibleScores, e.score));
  });

  it("/rankings fails closed if a row cap is smaller than the page", async () => {
    const { client } = cappedPostgrest(rows, 150);
    await assert.rejects(() => loadLeaderboardPage(client, SCOPE), /truncated/);
  });
});

describe("placement SQL and the application share one eligibility rule", () => {
  it("leaderboard_placement filters exactly what scopedToLeaderboard filters", async () => {
    const sql = readFileSync(
      new URL("../migrations/20260929_04_leaderboard_placement_function.sql", import.meta.url),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("AS $$"), sql.indexOf("$$;"));
    const where = [...body.matchAll(/s\.(\w+) (=|IS NOT NULL)\s*('?\w*'?)/g)].map((m) =>
      m[2] === "=" ? `${m[1]}=${m[3]}` : `${m[1]} not null`,
    );

    const { client, calls } = fakeSupabase({ submissions: { data: [], count: 0 } });
    await loadLeaderboardPage(client, SCOPE);
    const appRule = [
      ...calls.filter((c) => c.method === "eq").map((c) => {
        const v = c.args[1];
        const sqlValue =
          c.args[0] === "dataset_version_id" ? "p_dataset_version_id"
          : c.args[0] === "score_version" ? "p_score_version"
          : `'${v}'`;
        return `${c.args[0]}=${sqlValue}`;
      }),
      ...calls.filter((c) => c.method === "not").map((c) => `${c.args[0]} not null`),
    ];
    assert.deepEqual([...where].sort(), [...appRule].sort());
    assert.match(body, /count\(\*\) FILTER \(WHERE s\.hq_score > p_score\)/);
  });

  it("the function is service-role only and asserts it despite default privileges", () => {
    const sql = readFileSync(
      new URL("../migrations/20260929_04_leaderboard_placement_function.sql", import.meta.url),
      "utf8",
    );
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.leaderboard_placement\(uuid, text, numeric\)\s+FROM PUBLIC, anon, authenticated;/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.leaderboard_placement\(uuid, text, numeric\)\s+TO service_role;/);
    assert.match(sql, /has_function_privilege\('anon', v_fn, 'EXECUTE'\)/);
    assert.match(sql, /SECURITY INVOKER/);
  });

  it("ai_rl_hit loses public EXECUTE only, keeping body and security mode", () => {
    const sql = readFileSync(
      new URL("../migrations/20260929_05_ai_rl_hit_revoke_public_execute.sql", import.meta.url),
      "utf8",
    );
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.match(code, /REVOKE EXECUTE ON FUNCTION public\.ai_rl_hit\(text, text, bigint\)\s+FROM PUBLIC, anon, authenticated;/);
    assert.match(code, /GRANT EXECUTE ON FUNCTION public\.ai_rl_hit\(text, text, bigint\)\s+TO service_role;/);
    assert.doesNotMatch(code, /CREATE (OR REPLACE )?FUNCTION|ALTER FUNCTION|SECURITY DEFINER/);
  });

  it("every application caller of ai_rl_hit uses a service-role client", () => {
    for (const [file, marker] of [
      ["../lib/server/rateLimit.ts", null],
      ["../app/api/score/route.ts", "getSupabaseAdmin()"],
      ["../app/api/athlete-review/route.ts", "createClient(supabaseUrl, serviceRoleKey"],
    ] as const) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      if (marker) assert.ok(source.includes(marker), `${file} uses the service role`);
    }
    for (const file of ["../app/rankings/RankingsView.tsx", "../app/tool/page.tsx", "../lib/tool/scoreSubmission.ts"]) {
      assert.ok(!readFileSync(new URL(file, import.meta.url), "utf8").includes("ai_rl_hit"), file);
    }
  });
});
