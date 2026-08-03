// POST /api/score — the canonical Strendex scoring endpoint.
//
// Replaces the /api/rank + /api/submit pair: one request validates, converts,
// scores, persists, and returns the SAVED canonical result. The client's
// scores, percentiles, conversions, tier, archetype, rank, and moderation
// status are never trusted — none of those are even accepted as input.
//
// The calculator does NOT call this yet; Group 3 migrates the frontend.

import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/clientIp";
import { logError, logInfo, logWarn } from "@/lib/server/logging";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { createSupabaseScoreRepository } from "@/lib/server/scoreRepository";
import {
  SCORE_REQUEST_FIELDS,
  createCanonicalResult,
  type ScoreRequestFields,
} from "@/lib/server/scoreService";
import { ServerConfigError, getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  ScoringError,
  hasOnlyAllowedKeys,
  isPlainObject,
  type ScoringErrorCode,
} from "@/lib/scoring/core";

export const runtime = "nodejs";

const ROUTE = "/api/score";
const MAX_BODY_BYTES = 4096;
const MAX_PER_MINUTE = 5;
const MAX_PER_DAY = 25;

/** Dataset problems are server state, not something the caller can fix. */
const SERVICE_UNAVAILABLE_CODES: ReadonlySet<ScoringErrorCode> = new Set([
  "DATASET_UNAVAILABLE",
  "DATASET_INSUFFICIENT",
  "DATASET_CORRUPT",
  "SCORE_VERSION_MISMATCH",
]);

/** Reusing one idempotency key for two different submissions. */
const CONFLICT_CODES: ReadonlySet<ScoringErrorCode> = new Set([
  "IDEMPOTENCY_CONFLICT",
]);

function errorResponse(
  code: ScoringErrorCode | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED" | "INTERNAL",
  message: string,
  status: number,
  field?: string,
) {
  return NextResponse.json({ error: { code, message, field } }, { status });
}

/** Reads the body without ever buffering more than MAX_BODY_BYTES. */
async function readBoundedText(
  req: Request,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false };
  }

  const body = req.body;
  if (!body) return { ok: true, text: "" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    // --- Cheap request-shape checks first: these must not cost quota. ---
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      logWarn("request rejected", {
        route: ROUTE,
        event: "invalid_content_type",
        code: "INVALID_BODY",
      });
      return errorResponse(
        "INVALID_BODY",
        "Content-Type must be application/json.",
        415,
      );
    }

    const bounded = await readBoundedText(req);
    if (!bounded.ok) {
      logWarn("request rejected", {
        route: ROUTE,
        event: "body_too_large",
        code: "PAYLOAD_TOO_LARGE",
      });
      return errorResponse(
        "PAYLOAD_TOO_LARGE",
        "Request body is too large.",
        413,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bounded.text);
    } catch {
      logWarn("request rejected", {
        route: ROUTE,
        event: "invalid_json",
        code: "INVALID_BODY",
      });
      return errorResponse(
        "INVALID_BODY",
        "Request body must be valid JSON.",
        400,
      );
    }

    if (!isPlainObject(parsed)) {
      return errorResponse(
        "INVALID_BODY",
        "Request body must be a JSON object.",
        400,
      );
    }

    if (!hasOnlyAllowedKeys(parsed, SCORE_REQUEST_FIELDS)) {
      // Includes any attempt to send a pre-calculated score, percentile,
      // conversion, tier, archetype, rank, or status.
      logWarn("request rejected", {
        route: ROUTE,
        event: "unexpected_fields",
        code: "UNKNOWN_FIELD",
      });
      return errorResponse(
        "UNKNOWN_FIELD",
        "Request contains unexpected fields.",
        400,
      );
    }

    // --- Now it is worth spending quota. ---
    const supabase = getSupabaseAdmin();
    const ip = getClientIp(req);

    const limit = await enforceRateLimit(supabase, {
      scope: "score",
      ip,
      perMinute: MAX_PER_MINUTE,
      perDay: MAX_PER_DAY,
      minuteMessage: "Too many scoring requests. Please wait a minute.",
      dayMessage: "Daily scoring limit reached. Try again tomorrow.",
    });

    if (!limit.ok) {
      logWarn("rate limited", {
        route: ROUTE,
        event: "rate_limited",
        bucket: limit.bucket,
      });
      return errorResponse("RATE_LIMITED", limit.reason, 429);
    }

    const repository = createSupabaseScoreRepository(supabase);
    const { result, replayed } = await createCanonicalResult(
      repository,
      parsed as ScoreRequestFields,
    );

    logInfo("score persisted", {
      route: ROUTE,
      event: "score_persisted",
      scoreVersion: result.scoreVersion,
      datasetVersionId: result.datasetVersionId,
      datasetSampleSize: result.datasetSampleSize,
      datasetConfidence: result.datasetConfidence,
      moderationStatus: result.moderationStatus,
      visibility: result.visibility,
      eligible: result.leaderboard !== null,
      idempotentReplay: replayed,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { result, idempotentReplay: replayed },
      { status: replayed ? 200 : 201 },
    );
  } catch (error: unknown) {
    if (error instanceof ScoringError) {
      const unavailable = SERVICE_UNAVAILABLE_CODES.has(error.code);
      const conflict = CONFLICT_CODES.has(error.code);
      const status = unavailable ? 503 : conflict ? 409 : 400;

      if (unavailable) {
        logError("scoring unavailable", {
          route: ROUTE,
          event: "dataset_unavailable",
          code: error.code,
          status,
        });
      } else if (conflict) {
        logWarn("idempotency conflict", {
          route: ROUTE,
          event: "idempotency_conflict",
          code: error.code,
          status,
        });
      } else {
        logWarn("request rejected", {
          route: ROUTE,
          event: "validation_failed",
          code: error.code,
          field: error.field,
          status,
        });
      }

      return errorResponse(error.code, error.message, status, error.field);
    }

    if (error instanceof ServerConfigError) {
      logError("server misconfigured", {
        route: ROUTE,
        event: "config_error",
        status: 500,
      });
      return errorResponse("INTERNAL", "Scoring is unavailable.", 500);
    }

    // Repository / provider failures: never echo the underlying message.
    logError("unhandled scoring failure", {
      route: ROUTE,
      event: "internal_error",
      status: 500,
      durationMs: Date.now() - startedAt,
    });

    return errorResponse(
      "INTERNAL",
      "Something went wrong. Please try again.",
      500,
    );
  }
}
