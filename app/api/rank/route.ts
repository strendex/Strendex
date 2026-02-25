import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This runs on the server, so it's safe to use SERVICE_ROLE here
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Row = {
  bodyweight: number;
  fivek_seconds: number | null;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
  hq_score?: number | null;
};

function percentileHigherIsBetter(values: number[], x: number) {
  // returns 0..100 where higher is better
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) if (v <= x) count++;
  return (count / sorted.length) * 100;
}

function percentileLowerIsBetter(values: number[], x: number) {
  // returns 0..100 where lower is better (invert)
  return 100 - percentileHigherIsBetter(values, x);
}

export async function POST(req: Request) {
  const body = await req.json();

  const bw = Number(body.bodyweight);
  const fivek_seconds =
    body.fivek_seconds == null ? null : Number(body.fivek_seconds);
  const bench = Number(body.bench);
  const squat = Number(body.squat);
  const deadlift = Number(body.deadlift);

  if (!bw || !bench || !squat || !deadlift) {
    return NextResponse.json({ error: "Missing required inputs" }, { status: 400 });
  }

  // Pull dataset (enough for now; later we can optimize)
  const { data, error } = await supabase
    .from("submissions")
    .select("bodyweight,fivek_seconds,bench,squat,deadlift,hq_score")
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];

  const benchRatios: number[] = [];
  const squatRatios: number[] = [];
  const deadRatios: number[] = [];
  const fiveKs: number[] = [];
  const hqs: number[] = [];

  for (const r of rows) {
    if (r.bodyweight && r.bench && r.squat && r.deadlift) {
      benchRatios.push(r.bench / r.bodyweight);
      squatRatios.push(r.squat / r.bodyweight);
      deadRatios.push(r.deadlift / r.bodyweight);
    }
    if (typeof r.fivek_seconds === "number") fiveKs.push(r.fivek_seconds);
    if (typeof r.hq_score === "number") hqs.push(r.hq_score);
  }

  const userBenchRatio = bench / bw;
  const userSquatRatio = squat / bw;
  const userDeadRatio = deadlift / bw;

  const strengthPercentile =
    (percentileHigherIsBetter(benchRatios, userBenchRatio) +
      percentileHigherIsBetter(squatRatios, userSquatRatio) +
      percentileHigherIsBetter(deadRatios, userDeadRatio)) /
    3;

  const endurancePercentile =
    fivek_seconds == null ? 50 : percentileLowerIsBetter(fiveKs, fivek_seconds);

  const hq = 0.5 * strengthPercentile + 0.5 * endurancePercentile;

  // Top percent: what % of people have HQ >= you (smaller number = better)
  let topPercent = 50;
  if (hqs.length > 0) {
    const betterOrEqual = hqs.filter((v) => v >= hq).length;
    topPercent = (betterOrEqual / hqs.length) * 100;
  }

  return NextResponse.json({
    strengthPercentile: Number(strengthPercentile.toFixed(1)),
    endurancePercentile: Number(endurancePercentile.toFixed(1)),
    hq: Number(hq.toFixed(1)),
    topPercent: Number(topPercent.toFixed(1)),
  });
}