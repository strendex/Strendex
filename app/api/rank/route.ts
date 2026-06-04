import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildScoringDataset,
  clamp,
  computeScore,
} from "@/lib/scoring";
import { getClientIp } from "@/lib/clientIp";

const MAX_RANK_PER_MINUTE = 20;
const MAX_RANK_PER_DAY = 200;

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function upsertAndGetRankCount(
  supabase: any,
  ip: string,
  bucket: "minute" | "day",
  bucketId: number,
) {
  const { data, error } = await supabase.rpc("ai_rl_hit", {
    p_ip: `rank:${ip}`,
    p_bucket: bucket,
    p_bucket_id: bucketId,
  });

  if (error) throw error;

  return Number(data) || 0;
}

async function incrementAndCheckRankLimit(
  supabase: any,
  ip: string,
) {
  const t = nowUnixSeconds();
  const minuteBucketId = Math.floor(t / 60);
  const dayBucketId = Math.floor(t / 86400);

  const minute = await upsertAndGetRankCount(
    supabase,
    ip,
    "minute",
    minuteBucketId,
  );
  if (minute > MAX_RANK_PER_MINUTE) {
    return {
      ok: false,
      reason: "Too many scoring requests. Please wait a minute.",
    };
  }

  const day = await upsertAndGetRankCount(
    supabase,
    ip,
    "day",
    dayBucketId,
  );
  if (day > MAX_RANK_PER_DAY) {
    return {
      ok: false,
      reason: "Daily scoring limit reached. Try again tomorrow.",
    };
  }

  return { ok: true as const };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function logSecurityEvent(event: string, details: Record<string, unknown>) {
  console.warn(`[security][/api/rank] ${event}`, details);
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

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const ip = getClientIp(req);
    const limit = await incrementAndCheckRankLimit(supabase, ip);

    if (!limit.ok) {
      return NextResponse.json({ error: limit.reason }, { status: 429 });
    }
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      logSecurityEvent("invalid_content_type", {
        ip,
        contentType,
      });
      return badRequest("Content-Type must be application/json.");
    }

    const bodyUnknown: unknown = await req.json();

    if (!isPlainObject(bodyUnknown)) {
      logSecurityEvent("invalid_json_shape", { ip });
      return badRequest("Request body must be a JSON object.");
    }

    const allowedKeys = [
      "bodyweight_kg",
      "endurance_seconds",
      "bench_kg",
      "squat_kg",
      "deadlift_kg",
    ];

    if (!hasOnlyAllowedKeys(bodyUnknown, allowedKeys)) {
      logSecurityEvent("unexpected_keys", {
        ip,
        keys: Object.keys(bodyUnknown),
      });
      return badRequest("Request contains unexpected fields.");
    }

    const body = bodyUnknown;

    const bodyweightRaw = Number(body?.bodyweight_kg);
    const enduranceRaw =
      body?.endurance_seconds === null || body?.endurance_seconds === undefined
        ? null
        : Number(body?.endurance_seconds);

    const benchRaw =
      body?.bench_kg === null || body?.bench_kg === undefined
        ? null
        : Number(body?.bench_kg);

    const squatRaw =
      body?.squat_kg === null || body?.squat_kg === undefined
        ? null
        : Number(body?.squat_kg);

    const deadliftRaw =
      body?.deadlift_kg === null || body?.deadlift_kg === undefined
        ? null
        : Number(body?.deadlift_kg);

    if (!Number.isFinite(bodyweightRaw)) {
      return badRequest("Bodyweight is required.");
    }

    const bw = bodyweightRaw;

    if (bw < 36 || bw > 181) {
      return badRequest("Bodyweight must be between 36 and 181 kg.");
    }

    const bench = benchRaw;
    const squat = squatRaw;
    const deadlift = deadliftRaw;

    if (bench !== null) {
      if (!Number.isFinite(bench))
        return badRequest("Bench must be a valid number.");
      if (bench < 20 || bench > 318) {
        return badRequest("Bench must be between 20 and 318 kg.");
      }
    }

    if (squat !== null) {
      if (!Number.isFinite(squat))
        return badRequest("Squat must be a valid number.");
      if (squat < 20 || squat > 409) {
        return badRequest("Squat must be between 20 and 409 kg.");
      }
    }

    if (deadlift !== null) {
      if (!Number.isFinite(deadlift))
        return badRequest("Deadlift must be a valid number.");
      if (deadlift < 20 || deadlift > 454) {
        return badRequest("Deadlift must be between 20 and 454 kg.");
      }
    }

    if (
      bench === null &&
      squat === null &&
      deadlift === null &&
      enduranceRaw === null
    ) {
      return badRequest("Enter at least one lift or an endurance time.");
    }

    if (bench !== null && bench / bw > 3.2) {
      return badRequest("Bench-to-bodyweight ratio looks unrealistic.");
    }
    if (squat !== null && squat / bw > 4.0) {
      return badRequest("Squat-to-bodyweight ratio looks unrealistic.");
    }
    if (deadlift !== null && deadlift / bw > 4.5) {
      return badRequest("Deadlift-to-bodyweight ratio looks unrealistic.");
    }

    const enduranceSeconds = enduranceRaw;

    if (enduranceSeconds !== null) {
      if (!Number.isFinite(enduranceSeconds)) {
        return badRequest("Endurance time must be a valid number.");
      }

      const MIN_ENDURANCE_SEC = 4200;
      const MAX_ENDURANCE_SEC = 28800;

      if (
        enduranceSeconds < MIN_ENDURANCE_SEC ||
        enduranceSeconds > MAX_ENDURANCE_SEC
      ) {
        return badRequest("Endurance time looks out of range.");
      }
    }

    const { data, error } = await supabase
      .from("submissions")
      .select(
        "hq_score,strength_index,endurance_index,endurance_seconds,status",
      )
      .eq("status", "approved");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type SubmissionRow = {
      hq_score: number | null;
      strength_index: number | null;
      endurance_index: number | null;
      endurance_seconds: number | null;
      status: string | null;
    };

    const rows = (data ?? []) as SubmissionRow[];

    const hqScores = rows
      .map((r) => Number(r.hq_score))
      .filter((n) => Number.isFinite(n));

    const scored = computeScore(
      {
        bodyweightKg: bw,
        benchKg: bench,
        squatKg: squat,
        deadliftKg: deadlift,
        enduranceSeconds,
      },
      buildScoringDataset(rows),
    );

    const totalExisting = hqScores.length;
    const totalAll = totalExisting + 1;

    const numBetter = hqScores.filter((s) => s > scored.hq).length;
    const rank = numBetter + 1;

    const betterThan = Number(
      clamp(((totalAll - rank) / totalAll) * 100, 0, 100).toFixed(1),
    );

    return NextResponse.json({
      hq: scored.hq,
      strengthIndex: scored.strengthIndex,
      enduranceIndex: scored.enduranceIndex,
      strengthPercentile: scored.strengthPercentile,
      endurancePercentile: scored.endurancePercentile,
      betterThanPercent: betterThan,
      rank,
      total: totalAll,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}
