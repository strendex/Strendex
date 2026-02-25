import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simple HQ calculation (0–100 style). You can refine later.
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const bw = Number(body?.bodyweight) || 0;
    const fivek = body?.fivek_seconds === null ? null : Number(body?.fivek_seconds);
    const bench = body?.bench === null ? null : Number(body?.bench);
    const squat = body?.squat === null ? null : Number(body?.squat);
    const deadlift = body?.deadlift === null ? null : Number(body?.deadlift);

    if (!bw || bw < 80 || bw > 400) {
      return NextResponse.json({ error: "Invalid bodyweight" }, { status: 400 });
    }

    // Strength index (0–100)
    const bIdx = bench ? clamp((bench / (bw * 1.5)) * 100, 0, 100) : 0;
    const sIdx = squat ? clamp((squat / (bw * 2.0)) * 100, 0, 100) : 0;
    const dIdx = deadlift ? clamp((deadlift / (bw * 2.5)) * 100, 0, 100) : 0;
    const strengthIndex = Number(((bIdx + sIdx + dIdx) / 3).toFixed(1));

    // Endurance index (0–100) from 5k seconds
    const fivekMin = fivek ? fivek / 60 : 0;
    const enduranceIndex = Number((fivek ? clamp(100 - fivekMin * 2, 0, 100) : 0).toFixed(1));

    // HQ score (0–100 for now)
    const hq = Number(((strengthIndex + enduranceIndex) / 2).toFixed(1));

    // Pull all HQ scores for ranking
    const { data, error } = await supabase
      .from("submissions")
      .select("hq_score");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const scores = (data ?? [])
      .map((r: any) => Number(r.hq_score))
      .filter((n: number) => Number.isFinite(n));

    const total = scores.length;

    // If no data yet, you're #1 of 1 and better than 0% doesn't make sense, so set 50.0
    if (total === 0) {
      return NextResponse.json({
        hq,
        strengthPercentile: 50,
        endurancePercentile: 50,
        topPercent: 50,
        rank: 1,
        total: 1,
      });
    }

    // Rank calc: count how many are >= you
    const betterOrEqual = scores.filter((s) => s >= hq).length;
    const rank = Math.max(1, betterOrEqual);

    // Better-than percent: % of athletes you beat
    const worse = scores.filter((s) => s < hq).length;
    const betterThan = Number(((worse / total) * 100).toFixed(1));

    return NextResponse.json({
      hq,
      strengthPercentile: null,
      endurancePercentile: null,
      topPercent: betterThan,
      rank,
      total,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}