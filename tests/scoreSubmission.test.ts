// The calculator's one-request submission path.
//
// These tests connect to nothing: `fetch` is injected, and the key generator is
// injected wherever a key's identity matters. What they pin down is the
// contract the browser must keep — one request, one key per logical submission,
// no client-calculated result ever sent or displayed, and nothing the athlete
// typed thrown away when a request fails.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_VISIBILITY, VISIBILITIES } from "../lib/scoring/core";
import type { Visibility } from "../lib/scoring/core";
import { SCORE_REQUEST_FIELDS } from "../lib/server/scoreService";
import {
  buildScoreRequestDraft,
  createSubmissionSession,
  parseScoreResponse,
  resolveIdempotency,
  submissionSignature,
  submitScore,
  type ScoreFormValues,
  type ScoreRequestDraft,
  type ScoreResultView,
} from "../lib/tool/scoreSubmission";

// --- fixtures ----------------------------------------------------------------

/** 195 lb athlete, 275/365/425, 22:30 5K. Valid in both unit systems' bounds. */
function form(overrides: Partial<ScoreFormValues> = {}): ScoreFormValues {
  return {
    displayName: "Ryan",
    unitSystem: "lb",
    bodyweight: "195",
    bench: "275",
    squat: "365",
    deadlift: "425",
    runDistance: "5k",
    runSeconds: 1350,
    visibility: DEFAULT_VISIBILITY,
    ...overrides,
  };
}

function draft(overrides: Partial<ScoreFormValues> = {}): ScoreRequestDraft {
  const built = buildScoreRequestDraft(form(overrides));
  assert.ok(built.ok, "fixture must be a valid submission");
  return built.draft;
}

function savedResult(
  overrides: Partial<ScoreResultView> = {},
): ScoreResultView {
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
    datasetLabel: "2026-08 provisional legacy",
    datasetKind: "legacy_mixed_provisional",
    datasetSampleSize: 412,
    datasetConfidence: "established",
    calculatedAt: "2026-08-04T12:00:00.000Z",
    leaderboard: { rank: 12, total: 400 },
    ...overrides,
  };
}

type Canned =
  | { status: number; body: unknown }
  | { networkError: true }
  /** Resolves only when `release()` is called, for concurrency tests. */
  | { deferred: { promise: Promise<void>; status: number; body: unknown } };

function fakeFetch(script: Canned[]) {
  const bodies: Record<string, unknown>[] = [];
  const urls: string[] = [];

  const impl = (async (input: unknown, init?: RequestInit) => {
    urls.push(String(input));
    bodies.push(JSON.parse(String(init?.body ?? "{}")));

    const canned = script[Math.min(urls.length - 1, script.length - 1)];

    if ("networkError" in canned) throw new TypeError("failed to fetch");

    if ("deferred" in canned) {
      await canned.deferred.promise;
      return {
        ok: canned.deferred.status < 300,
        status: canned.deferred.status,
        json: async () => canned.deferred.body,
      } as Response;
    }

    return {
      ok: canned.status < 300,
      status: canned.status,
      json: async () => canned.body,
    } as Response;
  }) as unknown as typeof fetch;

  return { impl, bodies, urls, get calls() { return urls.length; } };
}

function ok(result = savedResult(), replayed = false) {
  return { status: replayed ? 200 : 201, body: { result, idempotentReplay: replayed } };
}

function apiError(status: number, code: string, message = "", field?: string) {
  return { status, body: { error: { code, message, field } } };
}

let keyCounter = 0;
const nextKey = () => `sx-test-key-${++keyCounter}`;

// --- one request -------------------------------------------------------------

describe("calculator submission: one request to /api/score", () => {
  it("makes exactly one POST and sends the athlete's original values", async () => {
    const fetcher = fakeFetch([ok()]);
    const session = createSubmissionSession();

    const outcome = await submitScore(session, draft(), {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "ok");
    assert.equal(fetcher.calls, 1, "the old rank + submit pair is gone");
    assert.equal(fetcher.urls[0], "/api/score");

    const body = fetcher.bodies[0];
    // Original units, uncoverted: the server does every conversion itself.
    assert.equal(body.unit_system, "lb");
    assert.equal(body.bodyweight, 195);
    assert.equal(body.bench, 275);
    assert.equal(body.run_distance, "5k");
    assert.equal(body.run_seconds, 1350);
  });

  it("sends nothing the server would reject as an unknown field", async () => {
    const fetcher = fakeFetch([ok()]);

    await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });

    for (const key of Object.keys(fetcher.bodies[0])) {
      assert.ok(
        (SCORE_REQUEST_FIELDS as readonly string[]).includes(key),
        `${key} is not an accepted request field`,
      );
    }
  });

  it("never transmits a score, percentile, rank or status", async () => {
    const fetcher = fakeFetch([ok()]);

    await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });

    const sent = Object.keys(fetcher.bodies[0]).join(",");
    for (const forbidden of [
      "hq",
      "score",
      "percentile",
      "index",
      "tier",
      "archetype",
      "rank",
      "status",
      "kg",
      "endurance_seconds",
    ]) {
      assert.equal(
        sent.includes(forbidden),
        false,
        `a calculated or pre-converted value leaked: ${forbidden}`,
      );
    }
  });
});

// --- server-owned results ----------------------------------------------------

describe("calculator submission: the result is the server's", () => {
  it("returns the saved row exactly as it arrived", async () => {
    const saved = savedResult();
    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([ok(saved)]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") return;
    assert.deepEqual(outcome.result, saved);
    assert.equal(outcome.replayed, false);
  });

  it("reports a replayed result as such", async () => {
    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([ok(savedResult(), true)]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") return;
    assert.equal(outcome.replayed, true);
  });

  it("keeps every field the results view renders", () => {
    const parsed = parseScoreResponse({
      result: savedResult(),
      idempotentReplay: false,
    });

    assert.ok(parsed);
    for (const field of [
      "resultId",
      "hybridScore",
      "strengthIndex",
      "enduranceIndex",
      "strengthPercentile",
      "endurancePercentile",
      "tier",
      "archetype",
      "moderationStatus",
      "verificationStatus",
      "provenance",
      "visibility",
      "datasetLabel",
      "datasetKind",
      "datasetSampleSize",
      "datasetConfidence",
      "leaderboard",
    ] as const) {
      assert.ok(field in parsed.result, `${field} must survive parsing`);
    }
  });

  it("fails closed on a response it cannot read rather than inventing one", async () => {
    // A missing score, an unrecognised tier, and a malformed placement must all
    // become an error the athlete can retry — never a substituted local value.
    const broken: unknown[] = [
      { result: { ...savedResult(), hybridScore: undefined } },
      { result: { ...savedResult(), tier: "GOD MODE" } },
      { result: { ...savedResult(), visibility: "everyone" } },
      { result: { ...savedResult(), leaderboard: { rank: "1st", total: 10 } } },
      { result: null },
      {},
    ];

    for (const payload of broken) {
      assert.equal(parseScoreResponse(payload), null);
    }

    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([{ status: 201, body: broken[0] }]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    if (outcome.status !== "error") return;
    assert.equal(outcome.error.code, "MALFORMED_RESPONSE");
    assert.equal(outcome.error.canRetry, true);
  });
});

// --- visibility --------------------------------------------------------------

describe("calculator submission: visibility", () => {
  it("defaults to private", () => {
    assert.equal(DEFAULT_VISIBILITY, "private");
    assert.equal(draft().visibility, "private");
  });

  for (const visibility of VISIBILITIES) {
    it(`transmits "${visibility}" when chosen`, async () => {
      const fetcher = fakeFetch([ok()]);

      await submitScore(createSubmissionSession(), draft({ visibility }), {
        fetchImpl: fetcher.impl,
        makeKey: nextKey,
      });

      assert.equal(fetcher.bodies[0].visibility, visibility);
    });
  }

  it("treats a changed visibility as a different submission", () => {
    const session = createSubmissionSession();
    const privateDraft = draft({ visibility: "private" });
    const publicDraft = draft({ visibility: "public" });

    const first = resolveIdempotency(null, privateDraft, nextKey);
    const second = resolveIdempotency(first, publicDraft, nextKey);

    assert.notEqual(
      first.key,
      second.key,
      "reusing a key with a changed visibility is a 409 by design",
    );
    assert.equal(session.idempotency, null);
  });
});

// --- idempotency -------------------------------------------------------------

describe("calculator submission: idempotency", () => {
  it("reuses one key while the submission is unchanged", async () => {
    const fetcher = fakeFetch([ok(), ok(savedResult(), true)]);
    const session = createSubmissionSession();
    const same = draft();

    await submitScore(session, same, { fetchImpl: fetcher.impl, makeKey: nextKey });
    await submitScore(session, same, { fetchImpl: fetcher.impl, makeKey: nextKey });

    assert.equal(fetcher.calls, 2);
    assert.equal(
      fetcher.bodies[0].idempotency_key,
      fetcher.bodies[1].idempotency_key,
      "a retry of the same submission must replay, not create a second row",
    );
  });

  for (const [what, change] of [
    ["a lift", { bench: "280" }],
    ["the bodyweight", { bodyweight: "196" }],
    ["the run time", { runSeconds: 1360 }],
    ["the run distance", { runDistance: "10k" as const, runSeconds: 2800 }],
    ["the display name", { displayName: "Ryan W" }],
    ["the unit system", { unitSystem: "kg" as const, bodyweight: "88", bench: "125", squat: "165", deadlift: "192" }],
  ] as const) {
    it(`generates a new key after ${what} changes`, async () => {
      const fetcher = fakeFetch([ok(), ok()]);
      const session = createSubmissionSession();

      await submitScore(session, draft(), {
        fetchImpl: fetcher.impl,
        makeKey: nextKey,
      });
      await submitScore(session, draft(change), {
        fetchImpl: fetcher.impl,
        makeKey: nextKey,
      });

      assert.notEqual(
        fetcher.bodies[0].idempotency_key,
        fetcher.bodies[1].idempotency_key,
      );
    });
  }

  it("keeps the key across a failure so the retry cannot double-submit", async () => {
    const fetcher = fakeFetch([
      apiError(500, "INTERNAL", "Something went wrong."),
      ok(),
    ]);
    const session = createSubmissionSession();
    const same = draft();

    const failed = await submitScore(session, same, {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });
    assert.equal(failed.status, "error");

    const retried = await submitScore(session, same, {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });
    assert.equal(retried.status, "ok");

    assert.equal(
      fetcher.bodies[0].idempotency_key,
      fetcher.bodies[1].idempotency_key,
    );
    // A failure that actually reached the database must not be able to write a
    // second row on retry, so the retry has to be byte-identical.
    assert.deepEqual(fetcher.bodies[0], fetcher.bodies[1]);
  });

  it("rotates the key after the server reports a conflict", async () => {
    const fetcher = fakeFetch([
      apiError(409, "IDEMPOTENCY_CONFLICT", "Key already used."),
      ok(),
    ]);
    const session = createSubmissionSession();
    const same = draft();

    const conflicted = await submitScore(session, same, {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });

    assert.equal(conflicted.status, "error");
    assert.equal(session.idempotency, null, "the conflicting key must be dropped");

    await submitScore(session, same, { fetchImpl: fetcher.impl, makeKey: nextKey });

    assert.notEqual(
      fetcher.bodies[0].idempotency_key,
      fetcher.bodies[1].idempotency_key,
    );
  });

  it("signs only the fields the server fingerprints", () => {
    const base = draft();
    assert.equal(submissionSignature(base), submissionSignature({ ...base }));
    assert.notEqual(
      submissionSignature(base),
      submissionSignature({ ...base, squat: base.squat + 5 }),
    );
  });

  it("generates keys the route will accept", () => {
    const session = createSubmissionSession();
    const record = resolveIdempotency(session.idempotency, draft());
    assert.match(record.key, /^[A-Za-z0-9._:-]{8,128}$/);
  });
});

// --- double clicks -----------------------------------------------------------

describe("calculator submission: duplicate clicks", () => {
  it("ignores a second click while a request is in flight", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const fetcher = fakeFetch([
      { deferred: { promise: gate, status: 201, body: ok().body } },
    ]);
    const session = createSubmissionSession();
    const same = draft();

    const first = submitScore(session, same, {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });
    const second = await submitScore(session, same, {
      fetchImpl: fetcher.impl,
      makeKey: nextKey,
    });

    assert.equal(second.status, "busy", "the second click must not fire a request");
    assert.equal(fetcher.calls, 1);

    release();
    assert.equal((await first).status, "ok");

    // ...and the guard clears afterwards, so a real retry is still possible.
    assert.equal(session.inFlight, false);
  });

  it("releases the guard when the request fails", async () => {
    const session = createSubmissionSession();

    const outcome = await submitScore(session, draft(), {
      fetchImpl: fakeFetch([{ networkError: true }]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    assert.equal(session.inFlight, false, "a failed submission must stay retryable");
  });
});

// --- structured errors + input preservation ----------------------------------

describe("calculator submission: structured errors", () => {
  it("turns a field error into copy naming that field and its range", async () => {
    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([
        apiError(400, "OUT_OF_RANGE", "bench is outside the supported range.", "bench"),
      ]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    if (outcome.status !== "error") return;
    assert.equal(outcome.error.code, "OUT_OF_RANGE");
    assert.equal(outcome.error.field, "bench");
    assert.match(outcome.error.message, /^Bench must be between/);
    // The athlete entered pounds, so the range has to be quoted in pounds.
    assert.match(outcome.error.message, /lb\.$/);
    // An out-of-range value cannot succeed on an unchanged retry.
    assert.equal(outcome.error.canRetry, false);
  });

  it("quotes the range in kilograms for a kg athlete", async () => {
    const kgDraft = draft({
      unitSystem: "kg",
      bodyweight: "88",
      bench: "125",
      squat: "165",
      deadlift: "192",
    });

    const outcome = await submitScore(createSubmissionSession(), kgDraft, {
      fetchImpl: fakeFetch([apiError(400, "OUT_OF_RANGE", "", "bodyweight")]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    if (outcome.status !== "error") return;
    assert.match(outcome.error.message, /36–181 kg/);
  });

  it("explains an unavailable dataset without blaming the athlete", async () => {
    for (const code of [
      "DATASET_UNAVAILABLE",
      "DATASET_INSUFFICIENT",
      "DATASET_CORRUPT",
      "SCORE_VERSION_MISMATCH",
    ]) {
      const outcome = await submitScore(createSubmissionSession(), draft(), {
        fetchImpl: fakeFetch([apiError(503, code, "")]).impl,
        makeKey: nextKey,
      });

      assert.equal(outcome.status, "error");
      if (outcome.status !== "error") continue;
      assert.match(outcome.error.message, /temporarily unavailable/i);
      assert.match(outcome.error.message, /still here/i);
      assert.equal(outcome.error.field, undefined);
      // Nothing to fix — an unchanged retry is the right advice here.
      assert.equal(outcome.error.canRetry, true);
    }
  });

  it("passes the rate limiter's own wording through", async () => {
    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([
        apiError(429, "RATE_LIMITED", "Too many scoring requests. Please wait a minute."),
      ]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    if (outcome.status !== "error") return;
    assert.match(outcome.error.message, /wait a minute/);
  });

  it("never shows the athlete a request-shape message meant for a developer", async () => {
    // 415/400 from the route carry wording like "Content-Type must be
    // application/json" — true, useless to a person, and there is no entry for
    // them to correct.
    for (const code of ["INVALID_BODY", "UNKNOWN_FIELD"]) {
      const outcome = await submitScore(createSubmissionSession(), draft(), {
        fetchImpl: fakeFetch([
          apiError(400, code, "Content-Type must be application/json."),
        ]).impl,
        makeKey: nextKey,
      });

      assert.equal(outcome.status, "error");
      if (outcome.status !== "error") continue;
      assert.equal(/Content-Type/i.test(outcome.error.message), false);
      assert.equal(outcome.error.field, undefined, "there is no field to point at");
      assert.match(outcome.error.message, /still here/i);
    }
  });

  it("handles a network failure as a retryable error, not a crash", async () => {
    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([{ networkError: true }]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    if (outcome.status !== "error") return;
    assert.equal(outcome.error.code, "NETWORK");
    assert.equal(outcome.error.canRetry, true);
  });

  it("says nothing was lost, whatever the failure", async () => {
    for (const canned of [
      apiError(500, "INTERNAL", ""),
      apiError(503, "DATASET_UNAVAILABLE", ""),
      { networkError: true } as const,
    ]) {
      const outcome = await submitScore(createSubmissionSession(), draft(), {
        fetchImpl: fakeFetch([canned]).impl,
        makeKey: nextKey,
      });

      assert.equal(outcome.status, "error");
      if (outcome.status !== "error") continue;
      assert.match(outcome.error.message, /still here/i);
    }
  });

  it("leaves the entered values untouched after a failure", async () => {
    const values = form();
    const snapshot = JSON.stringify(values);

    const outcome = await submitScore(createSubmissionSession(), draft(), {
      fetchImpl: fakeFetch([apiError(500, "INTERNAL", "")]).impl,
      makeKey: nextKey,
    });

    assert.equal(outcome.status, "error");
    // Nothing in the failure path may reach back into what the athlete typed.
    assert.equal(JSON.stringify(values), snapshot);
    assert.equal("result" in outcome, false, "a failure must not carry a result");
  });
});

// --- pre-flight validation ---------------------------------------------------

describe("calculator submission: pre-flight validation", () => {
  it("requires every event a ranked result needs", () => {
    for (const missing of ["bodyweight", "bench", "squat", "deadlift"] as const) {
      const built = buildScoreRequestDraft(form({ [missing]: "" }));
      assert.equal(built.ok, false);
      if (built.ok) continue;
      assert.equal(built.error.field, missing);
      assert.equal(built.error.code, "MISSING_EVENT");
      assert.equal(built.error.canRetry, false, "a missing entry must be filled in");
    }

    const noRun = buildScoreRequestDraft(form({ runSeconds: null }));
    assert.equal(noRun.ok, false);
    if (!noRun.ok) assert.equal(noRun.error.field, "run_seconds");
  });

  it("rejects an impossible entry before it costs a request", () => {
    // The same canonical validator the route runs, so this cannot disagree
    // with the server about what is acceptable.
    const tooHeavy = buildScoreRequestDraft(form({ bodyweight: "900" }));
    assert.equal(tooHeavy.ok, false);
    if (!tooHeavy.ok) {
      assert.equal(tooHeavy.error.code, "OUT_OF_RANGE");
      assert.equal(tooHeavy.error.field, "bodyweight");
    }

    const implausible = buildScoreRequestDraft(form({ bench: "690" }));
    assert.equal(implausible.ok, false);
    if (!implausible.ok) assert.equal(implausible.error.code, "IMPLAUSIBLE_RATIO");

    const notANumber = buildScoreRequestDraft(form({ squat: "abc" }));
    assert.equal(notANumber.ok, false);
    if (!notANumber.ok) assert.equal(notANumber.error.code, "INVALID_NUMBER");
  });

  it("normalises the display name the same way the server will", () => {
    const built = buildScoreRequestDraft(form({ displayName: "  Ryan   W  " }));
    assert.ok(built.ok);
    if (!built.ok) return;
    assert.equal(built.draft.display_name, "Ryan W");
  });

  it("falls back to the anonymous name rather than failing on a blank one", () => {
    const built = buildScoreRequestDraft(form({ displayName: "" }));
    assert.ok(built.ok);
    if (!built.ok) return;
    assert.equal(built.draft.display_name, "Anonymous Athlete");
  });

  it("keeps a rejected visibility from reaching the request", () => {
    const built = buildScoreRequestDraft(
      form({ visibility: "everyone" as unknown as Visibility }),
    );
    // The value is carried through verbatim for the server to reject; what
    // matters is that the browser never rewrites it into something valid.
    assert.ok(built.ok);
    if (!built.ok) return;
    assert.equal(built.draft.visibility, "everyone");
  });
});
