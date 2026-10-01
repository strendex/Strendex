// POST /api/athlete-review
// Generates a structured Athlete Review: canonical score + deterministic
// scenarios from lib/scoring, interpretation from OpenAI (strict JSON schema).
// No DB writes, no caching, no persistence of personal answers.
//
// GROUP 1: this route no longer builds its own reference population. It used to
// run its own live query of approved `submissions` and derive percentiles from
// whatever happened to be approved at that moment — a THIRD moving benchmark,
// independent of both /api/rank and /api/submit. It now reads the same frozen
// scoring_dataset_versions row that POST /api/score uses, so a review and a
// score computed from identical inputs compare against identical reference data.
//
// Still READ-ONLY with respect to `submissions`: this route performs no INSERT,
// UPDATE or DELETE on that table, and the dataset load is a SELECT.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { computeScore, type ScoringDataset } from "@/lib/scoring";
import {
  SCORE_VERSION,
  ScoringError,
  assertDatasetUsable,
} from "@/lib/scoring/core";
import { createSupabaseScoreRepository } from "@/lib/server/scoreRepository";
import { getClientIp } from "@/lib/clientIp";
import { validateAnswers } from "@/lib/athleteReview/questions";
import {
  RECALCULATE_MESSAGE,
  validateBenchmark,
} from "@/lib/athleteReview/benchmarkValidation";
import { computeScenarios } from "@/lib/athleteReview/scenarios";
import { diagnose } from "@/lib/athleteReview/diagnosis";
import { buildAthleteReviewInput } from "@/lib/athleteReview/prompt";
import {
  REPORT_JSON_SCHEMA,
  REPORT_PROMPT_VERSION,
  validateReport,
} from "@/lib/athleteReview/reportSchema";
import type { AthleteReviewResponse } from "@/lib/athleteReview/types";
import { logError, logInfo, logWarn } from "@/lib/server/logging";
import { parseReviewDailyCap, reserveReviewAttempt } from "@/lib/server/reviewCap";

export const runtime = "nodejs";

const MODEL =
  process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_OUTPUT_TOKENS = 3500;
const OPENAI_TIMEOUT_MS = 60_000;

// The review is the most expensive endpoint — keep limits tight.
const MAX_PER_MINUTE = 2;
const MAX_PER_DAY = 5;

const ROUTE = "/api/athlete-review";

const REVIEWS_PAUSED_MESSAGE =
  "Athlete Reviews are temporarily unavailable. Please try again later.";
const DAILY_CAP_MESSAGE =
  "Athlete Reviews have reached today's limit. Please try again tomorrow.";

const AI_UNAVAILABLE_MESSAGE =
  "The review engine returned an unusable result. Please try again — your answers are still saved.";

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function upsertAndGetReviewCount(
  supabase: SupabaseClient,
  ip: string,
  bucket: "minute" | "day",
  bucketId: number,
) {
  const { data, error } = await supabase.rpc("ai_rl_hit", {
    p_ip: `review:${ip}`,
    p_bucket: bucket,
    p_bucket_id: bucketId,
  });

  if (error) throw error;

  return Number(data) || 0;
}

async function incrementAndCheckReviewLimit(
  supabase: SupabaseClient,
  ip: string,
) {
  const t = nowUnixSeconds();

  const minute = await upsertAndGetReviewCount(
    supabase,
    ip,
    "minute",
    Math.floor(t / 60),
  );
  if (minute > MAX_PER_MINUTE) {
    return {
      ok: false,
      reason: "Please wait a minute before generating another review.",
    };
  }

  const day = await upsertAndGetReviewCount(
    supabase,
    ip,
    "day",
    Math.floor(t / 86400),
  );
  if (day > MAX_PER_DAY) {
    return {
      ok: false,
      reason: "Daily Athlete Review limit reached. Try again tomorrow.",
    };
  }

  return { ok: true as const };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// The review cannot be tied to the frozen benchmark its result was scored
// against (no id, unknown or draft dataset, or another score version). 409, not
// 400: the input is well formed but belongs to a result that must be rescored.
function recalculateRequired() {
  return NextResponse.json(
    { error: RECALCULATE_MESSAGE, code: "RECALCULATE_REQUIRED" },
    { status: 409 },
  );
}

// Allow-list logger only (lib/server/logging.ts): what happened, never who.
// No IP address, request content, questionnaire answer or error message.
function logSecurityEvent(event: string) {
  logWarn("request rejected", { route: ROUTE, event });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyAllowedKeys(
  obj: Record<string, unknown>,
  allowedKeys: string[],
) {
  return Object.keys(obj).every((key) => allowedKeys.includes(key));
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !openaiApiKey) {
      logError("server misconfigured", { route: ROUTE, code: "missing_env" });
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 },
      );
    }

    // Global daily attempt cap (lib/server/reviewCap.ts). A disabled or
    // invalid setting stops here: no counter, no validation, no OpenAI.
    const capConfig = parseReviewDailyCap(process.env.ATHLETE_REVIEW_DAILY_CAP);
    if (!capConfig.enabled) {
      if (capConfig.reason === "invalid") {
        logError("server misconfigured", { route: ROUTE, code: "review_cap_invalid" });
      } else {
        logInfo("athlete review disabled", { route: ROUTE, code: "review_cap_zero" });
      }
      return NextResponse.json({ error: REVIEWS_PAUSED_MESSAGE }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ip = getClientIp(req);
    const limit = await incrementAndCheckReviewLimit(supabase, ip);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.reason }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      logSecurityEvent("invalid_content_type");
      return badRequest("Content-Type must be application/json.");
    }

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      // The parse error's message can quote the body: never log it.
      logSecurityEvent("invalid_json");
      return badRequest("Request body must be valid JSON.");
    }
    if (!isPlainObject(bodyUnknown)) {
      logSecurityEvent("invalid_json_shape");
      return badRequest("Request body must be a JSON object.");
    }
    if (!hasOnlyAllowedKeys(bodyUnknown, ["benchmark", "answers"])) {
      logSecurityEvent("unexpected_keys");
      return badRequest("Request contains unexpected fields.");
    }

    const benchmarkResult = validateBenchmark(bodyUnknown.benchmark);
    if (!benchmarkResult.ok) {
      return benchmarkResult.recalculate ? recalculateRequired() : badRequest(benchmarkResult.error);
    }
    const benchmark = benchmarkResult.benchmark;

    const answersResult = validateAnswers(bodyUnknown.answers);
    if (!answersResult.ok) return badRequest(answersResult.error);
    const answers = answersResult.answers;

    // The FIXED reference population — the one frozen, hash-verified dataset
    // version that POST /api/score scores against. Not a live query, so adding
    // or approving a submission cannot move a review's percentiles, and two
    // reviews of the same athlete a week apart give the same numbers.
    let dataset: ScoringDataset;
    let datasetVersionId: string;
    try {
      // GROUP 3: the dataset the SAVED result was scored against — active or
      // retired — never whichever is active now. Nothing falls back: a missing,
      // unknown or incompatible benchmark is a request to recalculate.
      if (benchmark.scoreVersion !== SCORE_VERSION) {
        return recalculateRequired();
      }

      const snapshot = await createSupabaseScoreRepository(
        supabase,
      ).loadDatasetVersion(benchmark.datasetVersionId);

      if (!snapshot || snapshot.scoreVersion !== benchmark.scoreVersion) {
        logWarn("saved benchmark unavailable", { route: ROUTE, code: "recalculate_required" });
        return recalculateRequired();
      }
      datasetVersionId = snapshot.datasetVersionId;

      // The SAME usability gate the canonical scorer applies before it will
      // score anything: right score version, structurally intact, and at least
      // MIN_DATASET_SIZE eligible rows.
      //
      // This is not redundant with the repository's hash check. The repository
      // proves the arrays are the ones that were frozen; it does not prove they
      // are USABLE. And the adapter below is computeScore — the legacy surface —
      // whose documented behaviour on an undersized population is to fall back
      // to the raw endurance index instead of a percentile. Without this call an
      // Athlete Review would silently produce numbers on a 12-row dataset that
      // POST /api/score would have refused outright, then spend an OpenAI request
      // narrating them.
      //
      // It runs BEFORE the arrays are adapted and long before any AI call, so an
      // unusable dataset costs nothing.
      assertDatasetUsable(snapshot);

      // The frozen reference arrays, used verbatim. percentileMidrank is the
      // same function the canonical scorer calls, so the percentiles here and
      // the percentiles on a saved result are produced identically.
      dataset = {
        strengthScores: snapshot.strengthReference,
        enduranceScores: snapshot.enduranceReference,
      };
    } catch (datasetError: unknown) {
      // A corrupt or unusable dataset is server state, not something the athlete
      // can fix. Never leak the underlying detail.
      const code =
        datasetError instanceof ScoringError ? datasetError.code : "INTERNAL";
      logError("dataset unusable", { route: ROUTE, code });
      return NextResponse.json(
        { error: "Scoring is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const scoringInput = {
      bodyweightKg: benchmark.bodyweightKg,
      benchKg: benchmark.benchKg,
      squatKg: benchmark.squatKg,
      deadliftKg: benchmark.deadliftKg,
      enduranceSeconds: benchmark.enduranceSeconds,
    };

    const computed = computeScore(scoringInput, dataset);

    const scenarios = computeScenarios({
      input: scoringInput,
      dataset,
      current: computed,
      primaryGoal: answers.primaryGoal,
      priorityLift: answers.priorityLift,
    });

    // The report's numeric findings, from the canonical score and scenarios
    // only. Rendered as-is; the model explains them and cannot change them.
    // Targets are expressed in the run the athlete entered and in their unit.
    const diagnosis = diagnose(computed, scenarios, {
      unitSystem: benchmark.unitSystem,
      benchKg: benchmark.benchKg,
      squatKg: benchmark.squatKg,
      deadliftKg: benchmark.deadliftKg,
      run: benchmark.run,
    });

    const { system, user } = buildAthleteReviewInput({
      computed,
      benchmark: scoringInput,
      scenarios,
      diagnosis,
      answers,
      unitSystem: benchmark.unitSystem,
    });

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      maxRetries: 0, // retry policy is handled explicitly below
      timeout: OPENAI_TIMEOUT_MS,
    });

    // Reserve ONE attempt against the shared daily cap, after every check
    // above and immediately before the paid call. No reservation, no call.
    const reservation = await reserveReviewAttempt(supabase, capConfig.cap);
    if (!reservation.ok) {
      if (reservation.reason === "cap_reached") {
        logWarn("athlete review daily cap reached", { route: ROUTE, code: "review_cap_reached" });
        return NextResponse.json({ error: DAILY_CAP_MESSAGE }, { status: 503 });
      }
      logError("athlete review cap counter failed", { route: ROUTE, code: "review_cap_counter_failed" });
      return NextResponse.json({ error: REVIEWS_PAUSED_MESSAGE }, { status: 503 });
    }

    // Exactly one OpenAI attempt per accepted request: SDK retries are off
    // (maxRetries: 0) and nothing here retries — a timeout or error may still
    // have been billed, and a retry would be a second paid call.
    let resp: OpenAI.Responses.Response;
    try {
      resp = await openai.responses.create({
        model: MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "athlete_review_report",
            strict: true,
            schema: REPORT_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
      });
    } catch (err) {
      // Never log or echo provider error details: status or class name only.
      logError("openai request failed", {
        route: ROUTE,
        code:
          err instanceof OpenAI.APIError && typeof err.status === "number"
            ? `openai_${err.status}`
            : err instanceof Error
              ? err.name
              : "unknown",
      });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    if (resp.status === "incomplete") {
      logError("openai response incomplete", {
        route: ROUTE,
        code: String(resp.incomplete_details?.reason ?? "incomplete"),
      });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    const text = typeof resp.output_text === "string" ? resp.output_text : "";
    if (!text) {
      logError("openai output unusable", { route: ROUTE, code: "empty_or_refused" });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      logError("openai output unusable", { route: ROUTE, code: "invalid_json" });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    const reportResult = validateReport(parsed, { daysAvailable: answers.daysAvailable });
    if (!reportResult.ok) {
      logError("openai output unusable", { route: ROUTE, code: "report_invalid" });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    const payload: AthleteReviewResponse = {
      report: reportResult.report,
      scenarios,
      computed: {
        hq: computed.hq,
        tier: computed.tier,
        archetype: computed.archetype,
        strengthIndex: computed.strengthIndex,
        enduranceIndex: computed.enduranceIndex,
        strengthPercentile: computed.strengthPercentile,
        endurancePercentile: computed.endurancePercentile,
      },
      diagnosis,
      meta: {
        model: MODEL,
        promptVersion: REPORT_PROMPT_VERSION,
        datasetVersionId,
        scoreVersion: SCORE_VERSION,
      },
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    logError("unhandled review failure", {
      route: ROUTE,
      code: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
