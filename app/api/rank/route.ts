import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
// ------------------ Canonical Score Definition ------------------
// Canonical Score (0–100) = 0.5 * Strength Percentile + 0.5 * Endurance Percentile
// This is the ONLY place score math should exist.
// Everything else (tool UI, share card, leaderboard, DB) must consume the returned `hq`.
const SCORE_WEIGHTS = {
  strength: 0.5,
  endurance: 0.5,
} as const;

function canonicalScoreFromPercentiles(
  strengthPercentile: number,
  endurancePercentile: number
): number {
  const sp = clamp(strengthPercentile, 0, 100);
  const ep = clamp(endurancePercentile, 0, 100);

  const raw = SCORE_WEIGHTS.strength * sp + SCORE_WEIGHTS.endurance * ep;

  // Integer score (0–100)
  return clamp(Math.round(raw), 0, 100);
}

// Percentile with tie handling (midrank / "Hazen-ish" style):
// percentile = (count(x < v) + 0.5*count(x == v)) / N * 100
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

// Strength score from lift/bodyweight ratio (in KG/KG)
function strengthScoreFromRatio(ratio: number, mid: number, strong: number, elite: number) {
  if (ratio <= 0) return 0;
  if (ratio <= mid) return clamp((ratio / mid) * 40, 0, 40); // 0–40
  if (ratio <= strong) return 40 + clamp(((ratio - mid) / (strong - mid)) * 30, 0, 30); // 40–70
  if (ratio <= elite) return 70 + clamp(((ratio - strong) / (elite - strong)) * 25, 0, 25); // 70–95
  return 95 + clamp((ratio - elite) * 10, 0, 5); // 95–100
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const bw = Number(body?.bodyweight_kg) || 0; // KG
    const enduranceSeconds =
      body?.endurance_seconds === null ? null : Number(body?.endurance_seconds); // half-eq seconds
    const bench = body?.bench_kg === null ? null : Number(body?.bench_kg);
    const squat = body?.squat_kg === null ? null : Number(body?.squat_kg);
    const deadlift = body?.deadlift_kg === null ? null : Number(body?.deadlift_kg);

    // bw sanity: 80–400 lb => ~36–181 kg
    if (!bw || bw < 36 || bw > 181) {
      return NextResponse.json({ error: "Invalid bodyweight" }, { status: 400 });
    }

    // ---- Build indexes (0–100) ----
    const bRatio = bench ? bench / bw : 0;
    const sRatio = squat ? squat / bw : 0;
    const dRatio = deadlift ? deadlift / bw : 0;

    const bIdx = bench ? strengthScoreFromRatio(bRatio, 0.75, 1.25, 1.75) : 0;
    const sIdx = squat ? strengthScoreFromRatio(sRatio, 1.0, 1.75, 2.5) : 0;
    const dIdx = deadlift ? strengthScoreFromRatio(dRatio, 1.25, 2.25, 3.0) : 0;

    // If someone only enters one lift, average should not punish them with 0s.
    const strengthParts = [bIdx, sIdx, dIdx].filter((x) => x > 0);
    const strengthIndex =
      strengthParts.length > 0 ? Number((strengthParts.reduce((a, b) => a + b, 0) / strengthParts.length).toFixed(1)) : 0;

    // Endurance index from half-eq seconds (lower is better)
    const END_MIN_SEC = 4200;  // 1:10:00
    const END_MAX_SEC = 10800; // 3:00:00

    const enduranceIndex = Number(
      (enduranceSeconds
        ? clamp(((END_MAX_SEC - enduranceSeconds) / (END_MAX_SEC - END_MIN_SEC)) * 100, 0, 100)
        : 0
      ).toFixed(1)
    );

    // ---- Pull dataset for percentiles + ranking ----
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

    // ---- Percentiles (this is your real "score basis") ----
    // IMPORTANT: if user doesn’t enter endurance, enduranceIndex=0 will crush them.
    // For MVP, we still compute it, but the UI can message "best with both".
    const strengthPercentile = percentileMidrank(strengthScores, strengthIndex);
    const endurancePercentile =
  enduranceSeconds !== null ? percentileMidrank(enduranceScores, enduranceIndex) : 0;

// ---- Canonical Score (0–100) = 0.5*StrengthP + 0.5*EnduranceP ----
const hq = canonicalScoreFromPercentiles(strengthPercentile, endurancePercentile);
    // ---- Rank / better-than% ----
    // Include current athlete in displayed total
    const totalExisting = hqScores.length;
    const totalAll = totalExisting + 1;

    // Rank: # strictly greater + 1 (tie-friendly)
    const numBetter = hqScores.filter((s) => s > hq).length;
    const rank = numBetter + 1;

    const betterThan = Number(
      clamp(((totalAll - rank) / totalAll) * 100, 0, 100).toFixed(1)
    );

    return NextResponse.json({
      hq,
      strengthIndex,
      enduranceIndex,
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