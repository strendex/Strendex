import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Bigger lists (fewer repeats)
const firstNames = [
  "Ryan","Jake","Ethan","Noah","Liam","Aiden","Cole","Mason","Lucas","Owen","Ben","Max","Sam","Ty","Alex","Nate",
  "Dylan","Carter","Logan","Reid","Caleb","Jordan","Tanner","Hunter","Cameron","Brandon","Isaac","Avery","Connor","Gavin",
  "Spencer","Julian","Dominic","Zach","Trevor","Mitchell","Tristan","Austin","Blake","Eli","Miles","Finn","Jack","Leo",
  "Kai","Jasper","Theo","Hudson","Asher","Nolan","Cooper","Parker","Brody","Colton","Sawyer","Beckett","Silas","Rowan",
  "Micah","Kieran","Declan","Kobe","Grayson","Xavier","Calvin","Emmett","Holden","Wesley","Jude","Rhett","Knox",
  "Landon","Beau","Chase","Maddox","Bennett","Harrison","Seth","Brady","Shawn","Evan","Nathan","Adam","Luke","James"
];

const lastNames = [
  "Woods","Carter","Miller","Clark","Reed","Bennett","Foster","Hayes","Brooks","Ward","Parker","Rogers","Price","Turner","Morgan",
  "King","Russell","Collins","Bailey","Murphy","Reynolds","Anderson","Thompson","Campbell","Mitchell","Baker","Cooper","Evans",
  "Bell","Young","Hill","Green","Scott","Adams","Nelson","Hall","Moore","Lewis","Walker","Roberts","Phillips","Howard",
  "Fisher","Graham","Hughes","Murray","Watson","Stewart","Morrison","Gibson","Hamilton","Robertson","Stone","Fox","Henderson",
  "Sullivan","Bryant","Holland","Barrett","McDonald","MacKenzie","Carroll","Fraser","Lawson","Bishop","Johnston","Gardner","Peters",
  "Chapman","Harper","Spencer","Simmons","Crawford","Pearson","Fleming","Barnes","Wagner","Hawkins","Holt","Boyd","Jennings","Burke"
];

function makeName() {
  return `${pick(firstNames)} ${pick(lastNames)}`;
}

type Athlete = {
  athlete_name: string;
  bodyweight: number;
  fivek_seconds: number | null;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
  strength_index: number;
  endurance_index: number;
  total_lift: number;
  strength_ratio: number;

  // NEW
  strength_percentile: number;
  endurance_percentile: number;
  hq_score: number;
  rank: string;
  archetype: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// Percentile: higher is better
function percentileHigher(values: number[], x: number) {
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) if (v <= x) count++;
  return (count / sorted.length) * 100;
}

// Percentile: lower is better
function percentileLower(values: number[], x: number) {
  return 100 - percentileHigher(values, x);
}

function rankFromHQ(hq: number) {
  if (hq >= 90) return "WORLD CLASS";
  if (hq >= 75) return "ELITE";
  if (hq >= 60) return "ADVANCED";
  if (hq >= 40) return "INTERMEDIATE";
  return "NOVICE";
}

function archetypeFromIndexes(str: number, end: number) {
  if (str < 10 && end < 10) return "BASE BUILDER";
  const diff = str - end;
  if (str >= 70 && end >= 70) return "POWER HYBRID";
  if (diff >= 25) return "STRENGTH BEAST";
  if (diff <= -25) return "ENGINE MACHINE";
  if (Math.abs(diff) <= 10) return "BALANCED HYBRID";
  if (diff > 10) return "STRENGTH-LEANING HYBRID";
  return "ENDURANCE-LEANING HYBRID";
}

function genRawAthlete(): Omit<
  Athlete,
  "strength_percentile" | "endurance_percentile" | "hq_score" | "rank" | "archetype"
> {
  const bodyweight = Math.round(rand(145, 245));

  // Make heavy people *tend* to lift more and run slightly slower
  const bwFactor = (bodyweight - 145) / (245 - 145); // 0..1
  const strengthMult = 1 + bwFactor * 0.25; // up to +25% strength
  const runPenalty = 1 + bwFactor * 0.15;   // up to +15% slower

  const bench = Math.round((bodyweight * rand(1.05, 1.75) * strengthMult) / 5) * 5;
  const squat = Math.round((bodyweight * rand(1.55, 2.45) * strengthMult) / 5) * 5;
  const deadlift = Math.round((bodyweight * rand(1.95, 2.85) * strengthMult) / 5) * 5;

  // 5k minutes (faster is lower)
  const base5k = rand(18, 34) * runPenalty;
  const fivek_seconds = Math.round(base5k * 60);

  const totalLift = bench + squat + deadlift;
  const strength_ratio = totalLift / bodyweight;

  // Keep your existing indexes (0–100)
  const benchIndex = clamp((bench / (bodyweight * 1.5)) * 100, 0, 100);
  const squatIndex = clamp((squat / (bodyweight * 2.0)) * 100, 0, 100);
  const deadIndex = clamp((deadlift / (bodyweight * 2.5)) * 100, 0, 100);

  const strength_index = Number(((benchIndex + squatIndex + deadIndex) / 3).toFixed(1));
  const endurance_index = Number(clamp(100 - (base5k * 2), 0, 100).toFixed(1));

  return {
    athlete_name: makeName(),
    bodyweight,
    fivek_seconds,
    bench,
    squat,
    deadlift,
    strength_index,
    endurance_index,
    total_lift: totalLift,
    strength_ratio,
  };
}

async function run() {
  const count = Number(process.env.SEED_COUNT) || 300;

  // PASS A: generate raw athletes
  const raw = Array.from({ length: count }, () => genRawAthlete());

  // Build arrays for percentiles (ratios and 5k)
  const benchRatios = raw.map((a) => (a.bench! / a.bodyweight));
  const squatRatios = raw.map((a) => (a.squat! / a.bodyweight));
  const deadRatios = raw.map((a) => (a.deadlift! / a.bodyweight));
  const fiveks = raw.map((a) => a.fivek_seconds!);

  // PASS B: compute percentiles + HQ
  const athletes: Athlete[] = raw.map((a) => {
    const br = a.bench! / a.bodyweight;
    const sr = a.squat! / a.bodyweight;
    const dr = a.deadlift! / a.bodyweight;

    const strength_percentile =
      (percentileHigher(benchRatios, br) +
        percentileHigher(squatRatios, sr) +
        percentileHigher(deadRatios, dr)) / 3;

    const endurance_percentile = percentileLower(fiveks, a.fivek_seconds!);

    const hq_score = 0.5 * strength_percentile + 0.5 * endurance_percentile;

    const rank = rankFromHQ(hq_score);
    const archetype = archetypeFromIndexes(a.strength_index, a.endurance_index);

    return {
      ...a,
      strength_percentile: Number(strength_percentile.toFixed(1)),
      endurance_percentile: Number(endurance_percentile.toFixed(1)),
      hq_score: Number(hq_score.toFixed(1)),
      rank,
      archetype,
    };
  });

  // Insert in chunks (safer)
  const chunkSize = 200;
  for (let i = 0; i < athletes.length; i += chunkSize) {
    const chunk = athletes.slice(i, i + chunkSize);
    const { error } = await supabase.from("submissions").insert(chunk);
    if (error) {
      console.error("Insert error:", error);
      process.exit(1);
    }
  }

  console.log(`SUCCESS: Seeded ${athletes.length} athletes with HQ (0–100).`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});