import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function canonicalScoreFromPercentiles(
  strengthPercentile: number,
  endurancePercentile: number,
): number {
  const sp = clamp(strengthPercentile, 0, 100);
  const ep = clamp(endurancePercentile, 0, 100);
  return clamp(Math.round(0.5 * sp + 0.5 * ep), 0, 100);
}

function percentileMidrank(values: number[], v: number): number {
  const clean = values.filter((x) => Number.isFinite(x));
  const N = clean.length;
  if (N <= 0) return 50;

  let less = 0;
  let equal = 0;

  for (const x of clean) {
    if (x < v) less++;
    else if (x === v) equal++;
  }

  const p = ((less + 0.5 * equal) / N) * 100;
  return clamp(Number(p.toFixed(1)), 0, 100);
}

function strengthScoreFromRatio(
  ratio: number,
  mid: number,
  strong: number,
  elite: number,
) {
  if (ratio <= 0) return 0;
  if (ratio <= mid) return clamp((ratio / mid) * 40, 0, 40);
  if (ratio <= strong) {
    return 40 + clamp(((ratio - mid) / (strong - mid)) * 30, 0, 30);
  }
  if (ratio <= elite) {
    return 70 + clamp(((ratio - strong) / (elite - strong)) * 25, 0, 25);
  }
  return 95 + clamp((ratio - elite) * 10, 0, 5);
}

function getTier(score: number) {
  if (score >= 90) return "WORLD CLASS";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "NOVICE";
}

function getArchetype(strengthPercentile: number, endurancePercentile: number) {
  if (strengthPercentile < 10 && endurancePercentile < 10) {
    return "BASE BUILDER";
  }

  const diff = strengthPercentile - endurancePercentile;

  if (strengthPercentile >= 75 && endurancePercentile >= 75) {
    return "POWER HYBRID";
  }
  if (diff >= 20) return "STRENGTH BEAST";
  if (diff <= -20) return "ENDURANCE MACHINE";
  if (Math.abs(diff) <= 8) return "BALANCED HYBRID";
  if (diff > 0) return "STRENGTH-LEANING HYBRID";
  return "ENDURANCE-LEANING HYBRID";
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
      "bodyweight",
      "endurance_seconds",
      "bench",
      "squat",
      "deadlift",
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

    const bodyweight =
      body?.bodyweight === null || body?.bodyweight === undefined
        ? null
        : Number(body.bodyweight);

    const endurance_seconds =
      body?.endurance_seconds === null || body?.endurance_seconds === undefined
        ? null
        : Number(body.endurance_seconds);

    const bench =
      body?.bench === null || body?.bench === undefined
        ? null
        : Number(body.bench);

    const squat =
      body?.squat === null || body?.squat === undefined
        ? null
        : Number(body.squat);

    const deadlift =
      body?.deadlift === null || body?.deadlift === undefined
        ? null
        : Number(body.deadlift);

    if (bodyweight === null || !Number.isFinite(bodyweight)) {
      return badRequest("Bodyweight is required.");
    }

    if (bodyweight < 80 || bodyweight > 400) {
      return badRequest("Bodyweight must be between 80 and 400 lb.");
    }

    if (bench !== null) {
      if (!Number.isFinite(bench)) return badRequest("Bench must be a valid number.");
      if (bench < 45 || bench > 700) {
        return badRequest("Bench must be between 45 and 700 lb.");
      }
    }

    if (squat !== null) {
      if (!Number.isFinite(squat)) return badRequest("Squat must be a valid number.");
      if (squat < 45 || squat > 900) {
        return badRequest("Squat must be between 45 and 900 lb.");
      }
    }

    if (deadlift !== null) {
      if (!Number.isFinite(deadlift)) return badRequest("Deadlift must be a valid number.");
      if (deadlift < 45 || deadlift > 1000) {
        return badRequest("Deadlift must be between 45 and 1000 lb.");
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

    const bRatio = bench !== null ? bench / bodyweight : 0;
    const sRatio = squat !== null ? squat / bodyweight : 0;
    const dRatio = deadlift !== null ? deadlift / bodyweight : 0;

    const bIdx =
      bench !== null ? strengthScoreFromRatio(bRatio, 0.75, 1.25, 1.75) : 0;
    const sIdx =
      squat !== null ? strengthScoreFromRatio(sRatio, 1.0, 1.75, 2.5) : 0;
    const dIdx =
      deadlift !== null ? strengthScoreFromRatio(dRatio, 1.25, 2.25, 3.0) : 0;

    const strengthParts = [bIdx, sIdx, dIdx].filter((x) => x > 0);
    const strength_index =
      strengthParts.length > 0
        ? Number(
            (
              strengthParts.reduce((a, b) => a + b, 0) / strengthParts.length
            ).toFixed(1),
          )
        : 0;

    const END_MIN_SEC = 4200;
    const END_MAX_SEC = 10800;

    const endurance_index = Number(
      (endurance_seconds !== null
        ? clamp(
            ((END_MAX_SEC - endurance_seconds) / (END_MAX_SEC - END_MIN_SEC)) *
              100,
            0,
            100,
          )
        : 0
      ).toFixed(1),
    );

    const total_lift =
      (bench ?? 0) + (squat ?? 0) + (deadlift ?? 0);

    const strength_ratio =
      bodyweight > 0 ? Number((total_lift / bodyweight).toFixed(2)) : null;

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

    const hqScores = rows
      .map((r) => Number(r.hq_score))
      .filter((n) => Number.isFinite(n));

    const strengthScores = rows
      .map((r) => Number(r.strength_index))
      .filter((n) => Number.isFinite(n) && n > 0);

    const enduranceScores = rows
      .filter(
        (r) =>
          r.endurance_seconds !== null &&
          Number.isFinite(Number(r.endurance_index)) &&
          Number(r.endurance_index) > 0,
      )
      .map((r) => Number(r.endurance_index));

    const strength_percentile = percentileMidrank(strengthScores, strength_index);

    const MIN_ENDURANCE_SAMPLE = 30;
    let endurance_percentile = 0;

    if (endurance_seconds !== null) {
      endurance_percentile =
        enduranceScores.length >= MIN_ENDURANCE_SAMPLE
          ? percentileMidrank(enduranceScores, endurance_index)
          : endurance_index;
    }

    const hq_score = canonicalScoreFromPercentiles(
      strength_percentile,
      endurance_percentile,
    );

    const rank = getTier(hq_score);
    const archetype = getArchetype(strength_percentile, endurance_percentile);
    const status = hq_score >= 90 ? "pending" : "approved";

    const { error: insertError } = await supabaseAdmin.from("submissions").insert([
      {
        athlete_name,
        bodyweight,
        endurance_seconds,
        bench,
        squat,
        deadlift,
        hq_score,
        rank,
        archetype,
        strength_index,
        endurance_index,
        total_lift,
        strength_ratio,
        strength_percentile,
        endurance_percentile,
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