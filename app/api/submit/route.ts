import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildScoringDataset, computeScore } from "@/lib/scoring";

const MAX_SUBMIT_PER_MINUTE = 5;
const MAX_SUBMIT_PER_DAY = 25;

export const runtime = "nodejs";

function getClientIp(req: Request) {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return "unknown";
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function logSecurityEvent(event: string, details: Record<string, unknown>) {
  console.warn(`[security][/api/submit] ${event}`, details);
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

async function upsertAndGetSubmitCount(
  supabaseAdmin: any,
  ip: string,
  bucket: "minute" | "day",
  bucketId: number,
) {
  const { data, error } = await supabaseAdmin.rpc("ai_rl_hit", {
    p_ip: `submit:${ip}`,
    p_bucket: bucket,
    p_bucket_id: bucketId,
  });

  if (error) throw error;

  return Number(data) || 0;
}

async function incrementAndCheckSubmitLimit(
  supabaseAdmin: any,
  ip: string,
) {
  const t = nowUnixSeconds();
  const minuteBucketId = Math.floor(t / 60);
  const dayBucketId = Math.floor(t / 86400);

  const minute = await upsertAndGetSubmitCount(
    supabaseAdmin,
    ip,
    "minute",
    minuteBucketId,
  );
  if (minute > MAX_SUBMIT_PER_MINUTE) {
    return {
      ok: false,
      reason: "Too many submissions. Please wait a minute.",
    };
  }

  const day = await upsertAndGetSubmitCount(supabaseAdmin, ip, "day", dayBucketId);
  if (day > MAX_SUBMIT_PER_DAY) {
    return {
      ok: false,
      reason: "Daily submission limit reached. Try again tomorrow.",
    };
  }

  return { ok: true as const };
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const ip = getClientIp(req);
    const limit = await incrementAndCheckSubmitLimit(supabaseAdmin, ip);

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
      "athlete_name",
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

    const athlete_name =
      typeof body?.athlete_name === "string" &&
      body.athlete_name.trim().length >= 2
        ? body.athlete_name.trim().slice(0, 60)
        : "Anonymous Athlete";

    const bodyweightRaw = Number(body?.bodyweight_kg);
    const endurance_seconds =
      body?.endurance_seconds === null || body?.endurance_seconds === undefined
        ? null
        : Number(body.endurance_seconds);

    const bench =
      body?.bench_kg === null || body?.bench_kg === undefined
        ? null
        : Number(body.bench_kg);

    const squat =
      body?.squat_kg === null || body?.squat_kg === undefined
        ? null
        : Number(body.squat_kg);

    const deadlift =
      body?.deadlift_kg === null || body?.deadlift_kg === undefined
        ? null
        : Number(body.deadlift_kg);

    if (!Number.isFinite(bodyweightRaw)) {
      return badRequest("Bodyweight is required.");
    }

    const bodyweight = bodyweightRaw;

    if (bodyweight < 36 || bodyweight > 181) {
      return badRequest("Bodyweight must be between 36 and 181 kg.");
    }

    if (bench !== null) {
      if (!Number.isFinite(bench)) return badRequest("Bench must be a valid number.");
      if (bench < 20 || bench > 318) {
        return badRequest("Bench must be between 20 and 318 kg.");
      }
    }

    if (squat !== null) {
      if (!Number.isFinite(squat)) return badRequest("Squat must be a valid number.");
      if (squat < 20 || squat > 409) {
        return badRequest("Squat must be between 20 and 409 kg.");
      }
    }

    if (deadlift !== null) {
      if (!Number.isFinite(deadlift)) return badRequest("Deadlift must be a valid number.");
      if (deadlift < 20 || deadlift > 454) {
        return badRequest("Deadlift must be between 20 and 454 kg.");
      }
    }

    if (
      bench === null &&
      squat === null &&
      deadlift === null &&
      endurance_seconds === null
    ) {
      return badRequest("Enter at least one lift or an endurance time.");
    }

    if (bench !== null && bench / bodyweight > 3.2) {
      return badRequest("Bench-to-bodyweight ratio looks unrealistic.");
    }
    if (squat !== null && squat / bodyweight > 4.0) {
      return badRequest("Squat-to-bodyweight ratio looks unrealistic.");
    }
    if (deadlift !== null && deadlift / bodyweight > 4.5) {
      return badRequest("Deadlift-to-bodyweight ratio looks unrealistic.");
    }

    if (endurance_seconds !== null) {
      if (!Number.isFinite(endurance_seconds)) {
        return badRequest("Endurance time must be a valid number.");
      }

      const MIN_ENDURANCE_SEC = 4200;
      const MAX_ENDURANCE_SEC = 28800;

      if (
        endurance_seconds < MIN_ENDURANCE_SEC ||
        endurance_seconds > MAX_ENDURANCE_SEC
      ) {
        return badRequest("Endurance time looks out of range.");
      }
    }

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("hq_score,strength_index,endurance_index,endurance_seconds,status")
      .eq("status", "approved");

    if (error) {
      console.error("[/api/submit] select error:", error);
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

    const scored = computeScore(
      {
        bodyweightKg: bodyweight,
        benchKg: bench,
        squatKg: squat,
        deadliftKg: deadlift,
        enduranceSeconds: endurance_seconds,
      },
      buildScoringDataset(rows),
    );

    const total_lift = (bench ?? 0) + (squat ?? 0) + (deadlift ?? 0);

    const strength_ratio =
      bodyweight > 0 ? Number((total_lift / bodyweight).toFixed(2)) : null;

    const status = scored.hq >= 90 ? "pending" : "approved";

    const { error: insertError } = await supabaseAdmin.from("submissions").insert([
      {
        athlete_name,
        bodyweight,
        endurance_seconds,
        bench,
        squat,
        deadlift,
        hq_score: scored.hq,
        rank: scored.tier,
        archetype: scored.archetype,
        strength_index: scored.strengthIndex,
        endurance_index: scored.enduranceIndex,
        total_lift,
        strength_ratio,
        strength_percentile: scored.strengthPercentile,
        endurance_percentile: scored.endurancePercentile,
        status,
      },
    ]);

    if (insertError) {
      console.error("[/api/submit] insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[/api/submit] unexpected error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Submission failed.",
      },
      { status: 500 },
    );
  }
}
