import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
const MAX_RANK_PER_MINUTE = 20;
const MAX_RANK_PER_DAY = 200;

function getClientIp(req: Request) {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return "unknown";
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function upsertAndGetRankCount(
  ip: string,
  bucket: "minute" | "day",
  bucketId: number
) {
  const { data, error } = await supabase.rpc("ai_rl_hit", {
    p_ip: `rank:${ip}`,
    p_bucket: bucket,
    p_bucket_id: bucketId,
  });

  if (error) throw error;

  return Number(data) || 0;
}

async function incrementAndCheckRankLimit(ip: string) {
  const t = nowUnixSeconds();
  const minuteBucketId = Math.floor(t / 60);
  const dayBucketId = Math.floor(t / 86400);

  const minute = await upsertAndGetRankCount(ip, "minute", minuteBucketId);
  if (minute > MAX_RANK_PER_MINUTE) {
    return { ok: false, reason: "Too many scoring requests. Please wait a minute." };
  }

  const day = await upsertAndGetRankCount(ip, "day", dayBucketId);
  if (day > MAX_RANK_PER_DAY) {
    return { ok: false, reason: "Daily scoring limit reached. Try again tomorrow." };
  }

  return { ok: true as const };
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
    const ip = getClientIp(req);
    const limit = await incrementAndCheckRankLimit(ip);

    if (!limit.ok) {
      return NextResponse.json({ error: limit.reason }, { status: 429 });
    }
    const body = await req.json();

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

// ---------- Required bodyweight ----------
if (!Number.isFinite(bodyweightRaw)) {
  return badRequest("Bodyweight is required.");
}

const bw = bodyweightRaw;

// 80–400 lb ~= 36–181 kg
if (bw < 36 || bw > 181) {
  return badRequest("Bodyweight must be between 36 and 181 kg.");
}

// ---------- Optional lifts ----------
const bench = benchRaw;
const squat = squatRaw;
const deadlift = deadliftRaw;

// if present, must be finite positive values in realistic ranges
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

// at least one performance input must exist
if (bench === null && squat === null && deadlift === null && enduranceRaw === null) {
  return badRequest("Enter at least one lift or an endurance time.");
}

// ratio caps to catch obvious fake entries
if (bench !== null && bench / bw > 3.2) {
  return badRequest("Bench-to-bodyweight ratio looks unrealistic.");
}
if (squat !== null && squat / bw > 4.0) {
  return badRequest("Squat-to-bodyweight ratio looks unrealistic.");
}
if (deadlift !== null && deadlift / bw > 4.5) {
  return badRequest("Deadlift-to-bodyweight ratio looks unrealistic.");
}

// ---------- Endurance validation ----------
// This route receives HALF-MARATHON-EQUIVALENT seconds from the tool page.
const enduranceSeconds = enduranceRaw;

if (enduranceSeconds !== null) {
  if (!Number.isFinite(enduranceSeconds)) {
    return badRequest("Endurance time must be a valid number.");
  }

  // Conservative plausible half-marathon-equivalent range:
  // 1:10:00 to 8:00:00
  const MIN_ENDURANCE_SEC = 4200;
  const MAX_ENDURANCE_SEC = 28800;

  if (enduranceSeconds < MIN_ENDURANCE_SEC || enduranceSeconds > MAX_ENDURANCE_SEC) {
    return badRequest("Endurance time looks out of range.");
  }
}

    // ---- Build indexes (0–100) ----
    const bRatio = bench !== null ? bench / bw : 0;
const sRatio = squat !== null ? squat / bw : 0;
const dRatio = deadlift !== null ? deadlift / bw : 0;

const bIdx = bench !== null ? strengthScoreFromRatio(bRatio, 0.75, 1.25, 1.75) : 0;
const sIdx = squat !== null ? strengthScoreFromRatio(sRatio, 1.0, 1.75, 2.5) : 0;
const dIdx = deadlift !== null ? strengthScoreFromRatio(dRatio, 1.25, 2.25, 3.0) : 0;

    // If someone only enters one lift, average should not punish them with 0s.
    const strengthParts = [bIdx, sIdx, dIdx].filter((x) => x > 0);
    const strengthIndex =
      strengthParts.length > 0 ? Number((strengthParts.reduce((a, b) => a + b, 0) / strengthParts.length).toFixed(1)) : 0;

    // Endurance index from half-eq seconds (lower is better)
    const END_MIN_SEC = 4200;  // 1:10:00
    const END_MAX_SEC = 10800; // 3:00:00

    const enduranceIndex = Number(
      (enduranceSeconds !== null
        ? clamp(((END_MAX_SEC - enduranceSeconds) / (END_MAX_SEC - END_MIN_SEC)) * 100, 0, 100)
        : 0
      ).toFixed(1)
    );

    // ---- Pull dataset for percentiles + ranking ----
    const { data, error } = await supabase
  .from("submissions")
  .select("hq_score,strength_index,endurance_index,endurance_seconds,status")
  .eq("status", "approved");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];

    const hqScores = rows
      .map((r: any) => Number(r.hq_score))
      .filter((n: number) => Number.isFinite(n));

      const strengthScores = rows
      .map((r: any) => Number(r.strength_index))
      .filter((n: number) => Number.isFinite(n) && n > 0);

      const enduranceScores = rows
      .filter(
        (r: any) =>
          r.endurance_seconds !== null &&
          Number.isFinite(Number(r.endurance_index)) &&
          Number(r.endurance_index) > 0
      )
      .map((r: any) => Number(r.endurance_index));

    // ---- Percentiles (this is your real "score basis") ----
    // IMPORTANT: if user doesn’t enter endurance, enduranceIndex=0 will crush them.
    // For MVP, we still compute it, but the UI can message "best with both".
    const strengthPercentile = percentileMidrank(strengthScores, strengthIndex);
    const MIN_ENDURANCE_SAMPLE = 30; // change later if you want

let endurancePercentile = 0;

if (enduranceSeconds !== null) {
  // If dataset is too small, percentiles are meaningless.
  // Fallback: use the enduranceIndex itself (0–100) until you have enough data.
  endurancePercentile =
    enduranceScores.length >= MIN_ENDURANCE_SAMPLE
      ? percentileMidrank(enduranceScores, enduranceIndex)
      : enduranceIndex;
}

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
      betterThanPercent: betterThan,
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