import { NextResponse } from "next/server";
const MAX_SUBMIT_PER_MINUTE = 5;
const MAX_SUBMIT_PER_DAY = 25;

function getClientIp(req: Request) {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return "unknown";
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    async function upsertAndGetSubmitCount(
        ip: string,
        bucket: "minute" | "day",
        bucketId: number
      ) {
        const { data, error } = await supabaseAdmin.rpc("ai_rl_hit", {
          p_ip: `submit:${ip}`,
          p_bucket: bucket,
          p_bucket_id: bucketId,
        });
      
        if (error) throw error;
      
        return Number(data) || 0;
      }
      
      async function incrementAndCheckSubmitLimit(ip: string) {
        const t = nowUnixSeconds();
        const minuteBucketId = Math.floor(t / 60);
        const dayBucketId = Math.floor(t / 86400);
      
        const minute = await upsertAndGetSubmitCount(ip, "minute", minuteBucketId);
        if (minute > MAX_SUBMIT_PER_MINUTE) {
          return { ok: false, reason: "Too many submissions. Please wait a minute." };
        }
      
        const day = await upsertAndGetSubmitCount(ip, "day", dayBucketId);
        if (day > MAX_SUBMIT_PER_DAY) {
          return { ok: false, reason: "Daily submission limit reached. Try again tomorrow." };
        }
      
        return { ok: true as const };
      }

      const ip = getClientIp(req);
      const limit = await incrementAndCheckSubmitLimit(ip);
      
      if (!limit.ok) {
        return NextResponse.json({ error: limit.reason }, { status: 429 });
      }
      
      const body = await req.json();

    const athlete_name =
      typeof body?.athlete_name === "string" && body.athlete_name.trim().length >= 2
        ? body.athlete_name.trim()
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
      body?.bench === null || body?.bench === undefined ? null : Number(body.bench);

    const squat =
      body?.squat === null || body?.squat === undefined ? null : Number(body.squat);

    const deadlift =
      body?.deadlift === null || body?.deadlift === undefined
        ? null
        : Number(body.deadlift);

    const hq_score = Number(body?.hq_score);

    const rank = typeof body?.rank === "string" ? body.rank : null;
    const archetype = typeof body?.archetype === "string" ? body.archetype : null;

    const strength_index =
      body?.strength_index === null || body?.strength_index === undefined
        ? null
        : Number(body.strength_index);

    const endurance_index =
      body?.endurance_index === null || body?.endurance_index === undefined
        ? null
        : Number(body.endurance_index);

    const total_lift =
      body?.total_lift === null || body?.total_lift === undefined
        ? null
        : Number(body.total_lift);

    const strength_ratio =
      body?.strength_ratio === null || body?.strength_ratio === undefined
        ? null
        : Number(body.strength_ratio);

    const strength_percentile =
      body?.strength_percentile === null || body?.strength_percentile === undefined
        ? null
        : Number(body.strength_percentile);

    const endurance_percentile =
      body?.endurance_percentile === null || body?.endurance_percentile === undefined
        ? null
        : Number(body.endurance_percentile);

    const status = hq_score >= 90 ? "pending" : "approved";

    if (!Number.isFinite(hq_score)) {
      return NextResponse.json({ error: "Invalid hq_score." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("submissions").insert([
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

    if (error) {
      console.error("[/api/submit] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[/api/submit] unexpected error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Submission failed." },
      { status: 500 }
    );
  }
}