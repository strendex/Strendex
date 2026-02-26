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
    // More realistic strength scaling targets (ratios in xBW):
// 0.75x / 1.25x / 1.50x = "mid", 1.25x / 1.75x / 2.25x = "strong", higher = elite-ish
function strengthScoreFromRatio(ratio: number, mid: number, strong: number, elite: number) {
  if (ratio <= 0) return 0;
  if (ratio <= mid) return clamp((ratio / mid) * 40, 0, 40); // 0–40
  if (ratio <= strong) return 40 + clamp(((ratio - mid) / (strong - mid)) * 30, 0, 30); // 40–70
  if (ratio <= elite) return 70 + clamp(((ratio - strong) / (elite - strong)) * 25, 0, 25); // 70–95
  return 95 + clamp((ratio - elite) * 10, 0, 5); // 95–100
}

const bRatio = bench ? bench / bw : 0;
const sRatio = squat ? squat / bw : 0;
const dRatio = deadlift ? deadlift / bw : 0;

const bIdx = bench ? strengthScoreFromRatio(bRatio, 0.75, 1.25, 1.75) : 0;
const sIdx = squat ? strengthScoreFromRatio(sRatio, 1.00, 1.75, 2.50) : 0;
const dIdx = deadlift ? strengthScoreFromRatio(dRatio, 1.25, 2.25, 3.00) : 0;
    const strengthIndex = Number(((bIdx + sIdx + dIdx) / 3).toFixed(1));

    // Endurance index (0–100) from HALF-MARATHON equivalent seconds
// Lower seconds = better. These are sane defaults; tune later.
const END_MIN_SEC = 4200;  // 1:10:00 half-eq = very strong
const END_MAX_SEC = 10800; // 3:00:00 half-eq = very weak

const enduranceIndex = Number(
  (enduranceSeconds
    ? clamp(((END_MAX_SEC - enduranceSeconds) / (END_MAX_SEC - END_MIN_SEC)) * 100, 0, 100)
    : 0
  ).toFixed(1)
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

  const totalExisting = hqScores.length;

  // Include the current athlete in the displayed total
  const totalAll = totalExisting + 1;
  
  // Rank: # of people strictly better than you + 1 (tie-friendly)
  const numBetter = hqScores.filter((s) => s > hq).length;
  const rank = numBetter + 1;
  
  // Better-than% based on rank within totalAll
  // Example: rank 1 of 100 => 99% better than
  const betterThan = Number(
    clamp(((totalAll - rank) / totalAll) * 100, 0, 100).toFixed(1)
  );

  const strengthPercentile =
  strengthScores.length > 0
    ? Number(
        clamp(
          ((strengthScores.filter((x) => x < strengthIndex).length) / (strengthScores.length + 1)) * 100,
          0,
          100
        ).toFixed(1)
      )
    : 50;

const endurancePercentile =
  enduranceScores.length > 0
    ? Number(
        clamp(
          ((enduranceScores.filter((x) => x < enduranceIndex).length) / (enduranceScores.length + 1)) * 100,
          0,
          100
        ).toFixed(1)
      )
    : 50;

return NextResponse.json({
hq,
strengthPercentile,
endurancePercentile,
topPercent: betterThan,
rank,
total: totalAll,
});
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}