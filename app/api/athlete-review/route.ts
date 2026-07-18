// POST /api/athlete-review
// Generates a structured Athlete Review: canonical score + deterministic
// scenarios from lib/scoring.ts, interpretation from OpenAI (strict JSON
// schema). No DB writes, no caching, no persistence of personal answers.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { buildScoringDataset, computeScore } from "@/lib/scoring";
import { getClientIp } from "@/lib/clientIp";
import { validateAnswers } from "@/lib/athleteReview/questions";
import { computeScenarios } from "@/lib/athleteReview/scenarios";
import { buildAthleteReviewInput } from "@/lib/athleteReview/prompt";
import {
  REPORT_JSON_SCHEMA,
  REPORT_PROMPT_VERSION,
  validateReport,
} from "@/lib/athleteReview/reportSchema";
import type { AthleteReviewResponse } from "@/lib/athleteReview/types";

export const runtime = "nodejs";

const MODEL =
  process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_OUTPUT_TOKENS = 3500;
const OPENAI_TIMEOUT_MS = 60_000;

// The review is the most expensive endpoint — keep limits tight.
const MAX_PER_MINUTE = 2;
const MAX_PER_DAY = 5;

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

function logSecurityEvent(event: string, details: Record<string, unknown>) {
  console.warn(`[security][/api/athlete-review] ${event}`, details);
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

type ValidatedBenchmark = {
  bodyweightKg: number;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  enduranceSeconds: number | null;
  unitSystem: "lb" | "kg";
};

// Same validity rules as /api/rank — a review athlete is a legal athlete.
function validateBenchmark(
  raw: unknown,
): { ok: true; benchmark: ValidatedBenchmark } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Benchmark must be an object." };
  }

  const allowed = [
    "bodyweight_kg",
    "endurance_seconds",
    "bench_kg",
    "squat_kg",
    "deadlift_kg",
    "unit_system",
  ];
  if (!hasOnlyAllowedKeys(raw, allowed)) {
    return { ok: false, error: "Benchmark contains unexpected fields." };
  }

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  const bw = Number(raw.bodyweight_kg);
  if (!Number.isFinite(bw) || bw < 36 || bw > 181) {
    return { ok: false, error: "Bodyweight must be between 36 and 181 kg." };
  }

  const bench = num(raw.bench_kg);
  const squat = num(raw.squat_kg);
  const deadlift = num(raw.deadlift_kg);
  const endurance = num(raw.endurance_seconds);

  if (bench !== null && (!Number.isFinite(bench) || bench < 20 || bench > 318)) {
    return { ok: false, error: "Bench must be between 20 and 318 kg." };
  }
  if (squat !== null && (!Number.isFinite(squat) || squat < 20 || squat > 409)) {
    return { ok: false, error: "Squat must be between 20 and 409 kg." };
  }
  if (
    deadlift !== null &&
    (!Number.isFinite(deadlift) || deadlift < 20 || deadlift > 454)
  ) {
    return { ok: false, error: "Deadlift must be between 20 and 454 kg." };
  }
  if (bench === null && squat === null && deadlift === null && endurance === null) {
    return { ok: false, error: "At least one lift or an endurance time is required." };
  }
  if (bench !== null && bench / bw > 3.2) {
    return { ok: false, error: "Bench-to-bodyweight ratio looks unrealistic." };
  }
  if (squat !== null && squat / bw > 4.0) {
    return { ok: false, error: "Squat-to-bodyweight ratio looks unrealistic." };
  }
  if (deadlift !== null && deadlift / bw > 4.5) {
    return { ok: false, error: "Deadlift-to-bodyweight ratio looks unrealistic." };
  }
  if (
    endurance !== null &&
    (!Number.isFinite(endurance) || endurance < 4200 || endurance > 28800)
  ) {
    return { ok: false, error: "Endurance time looks out of range." };
  }

  const unitSystem = raw.unit_system === "kg" ? "kg" : "lb";

  return {
    ok: true,
    benchmark: {
      bodyweightKg: bw,
      benchKg: bench,
      squatKg: squat,
      deadliftKg: deadlift,
      enduranceSeconds: endurance,
      unitSystem,
    },
  };
}

// Retry policy: exactly one retry, and only for genuinely transient failures
// (network / timeout / OpenAI 5xx). Refusals, rate limits, and bad input are
// never retried — that would just double cost.
function isTransientOpenAIError(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) {
    return typeof err.status === "number" && err.status >= 500;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !openaiApiKey) {
      console.error("[/api/athlete-review] missing required env configuration");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 },
      );
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
      logSecurityEvent("invalid_content_type", { ip, contentType });
      return badRequest("Content-Type must be application/json.");
    }

    const bodyUnknown: unknown = await req.json();
    if (!isPlainObject(bodyUnknown)) {
      logSecurityEvent("invalid_json_shape", { ip });
      return badRequest("Request body must be a JSON object.");
    }
    if (!hasOnlyAllowedKeys(bodyUnknown, ["benchmark", "answers"])) {
      logSecurityEvent("unexpected_keys", { ip, keys: Object.keys(bodyUnknown) });
      return badRequest("Request contains unexpected fields.");
    }

    const benchmarkResult = validateBenchmark(bodyUnknown.benchmark);
    if (!benchmarkResult.ok) return badRequest(benchmarkResult.error);
    const benchmark = benchmarkResult.benchmark;

    const answersResult = validateAnswers(bodyUnknown.answers);
    if (!answersResult.ok) return badRequest(answersResult.error);
    const answers = answersResult.answers;

    // Canonical scoring — same dataset and path as /api/rank. The client's
    // stored scores are never used.
    const { data, error } = await supabase
      .from("submissions")
      .select("hq_score,strength_index,endurance_index,endurance_seconds,status")
      .eq("status", "approved");

    if (error) {
      console.error("[/api/athlete-review] dataset fetch failed:", error.message);
      return NextResponse.json(
        { error: "Could not load scoring data. Please try again." },
        { status: 500 },
      );
    }

    const dataset = buildScoringDataset(
      (data ?? []) as {
        strength_index: number | null;
        endurance_index: number | null;
        endurance_seconds: number | null;
      }[],
    );

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

    const { system, user } = buildAthleteReviewInput({
      computed,
      benchmark: scoringInput,
      scenarios,
      answers,
      unitSystem: benchmark.unitSystem,
    });

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      maxRetries: 0, // retry policy is handled explicitly below
      timeout: OPENAI_TIMEOUT_MS,
    });

    let resp: OpenAI.Responses.Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
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
        break;
      } catch (err) {
        if (attempt === 0 && isTransientOpenAIError(err)) {
          console.warn("[/api/athlete-review] transient OpenAI error, retrying once");
          continue;
        }
        // Never echo OpenAI error details to the client.
        console.error(
          "[/api/athlete-review] OpenAI request failed:",
          err instanceof Error ? err.message : "unknown",
        );
        return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
      }
    }

    if (!resp || resp.status === "incomplete") {
      console.error(
        "[/api/athlete-review] response incomplete:",
        resp?.incomplete_details?.reason ?? "no response",
      );
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    const text = typeof resp.output_text === "string" ? resp.output_text : "";
    if (!text) {
      console.error("[/api/athlete-review] empty or refused output");
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[/api/athlete-review] output was not valid JSON");
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    const reportResult = validateReport(parsed);
    if (!reportResult.ok) {
      console.error(
        "[/api/athlete-review] report failed validation:",
        reportResult.error,
      );
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
      meta: { model: MODEL, promptVersion: REPORT_PROMPT_VERSION },
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error(
      "[/api/athlete-review] unhandled error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
