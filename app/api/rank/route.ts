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

    const bw = Number(body?.bodyweight_kg) || 0; // canonical KG
const enduranceSeconds =
  body?.endurance_seconds === null ? null : Number(body?.endurance_seconds); // HM-equivalent seconds
const bench = body?.bench_kg === null ? null : Number(body?.bench_kg);
const squat = body?.squat_kg === null ? null : Number(body?.squat_kg);
const deadlift = body?.deadlift_kg === null ? null : Number(body?.deadlift_kg);

// bw is now KG. 80–400 lb becomes ~36–181 kg.
if (!bw || bw < 36 || bw > 181) {
  return NextResponse.json({ error: "Invalid bodyweight" }, { status: 400 });
}

    // Strength index (0–100)
    const bIdx = bench ? clamp((bench / (bw * 1.5)) * 100, 0, 100) : 0;
    const sIdx = squat ? clamp((squat / (bw * 2.0)) * 100, 0, 100) : 0;
    const dIdx = deadlift ? clamp((deadlift / (bw * 2.5)) * 100, 0, 100) : 0;
    const strengthIndex = Number(((bIdx + sIdx + dIdx) / 3).toFixed(1));

    // Endurance index (0–100) from HALF-MARATHON equivalent seconds
// Map HM time roughly: 60 min -> 100, 240 min -> 0 (linear)
const hmMin = enduranceSeconds ? enduranceSeconds / 60 : 0;
const enduranceIndex = Number(
  (enduranceSeconds ? clamp(100 - (hmMin - 60) * (100 / 180), 0, 100) : 0).toFixed(1)
);

    // HQ score (0–100 for now)
    const hq = Number(((strengthIndex + enduranceIndex) / 2).toFixed(1));

    // Pull all HQ scores for ranking
    const { data, error } = await supabase
  .from("submissions")
  .select("hq_score,strength_index,endurance_index");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];

const hqScores = rows
  .map((r: any) => Number(r.hq_score))
  .filter((n: number) => Number.isFinite(n));

const strengthScores = rows
  .map((r: any) => Number(r.strength_index))
  .filter((n: number) => Number.isFinite(n));

const enduranceScores = rows
  .map((r: any) => Number(r.endurance_index))
  .filter((n: number) => Number.isFinite(n));

const total = hqScores.length;

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
    const betterOrEqual = hqScores.filter((s) => s >= hq).length;
const rank = Math.max(1, betterOrEqual);

const worse = hqScores.filter((s) => s < hq).length;
const betterThan = Number(((worse / total) * 100).toFixed(1));

const strengthPercentile =
strengthScores.length > 0
  ? Number(((strengthScores.filter((x) => x < strengthIndex).length / strengthScores.length) * 100).toFixed(1))
  : 50;

const endurancePercentile =
enduranceScores.length > 0
  ? Number(((enduranceScores.filter((x) => x < enduranceIndex).length / enduranceScores.length) * 100).toFixed(1))
  : 50;

return NextResponse.json({
hq,
strengthPercentile,
endurancePercentile,
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