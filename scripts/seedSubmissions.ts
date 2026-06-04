/**
 * Seed the submissions table with synthetic athletes scored via lib/scoring.ts.
 *
 * ⚠️  STEP 0 — WIPES ALL EXISTING SUBMISSIONS before inserting new rows.
 * Run only when you intend to replace the full benchmark population.
 *
 * Usage: npx tsx scripts/seedSubmissions.ts
 * Optional: SEED_COUNT=500 npx tsx scripts/seedSubmissions.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  buildScoringDataset,
  canonicalScoreFromPercentiles,
  computeEnduranceIndex,
  computeStrengthIndex,
  getArchetype,
  getTier,
  percentileMidrank,
} from "../lib/scoring";

const DEFAULT_SEED_COUNT = 500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randNormal(mean: number, std: number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roundKg(n: number, step = 2.5) {
  return Math.round(n / step) * step;
}

const firstNames = [
  "Ryan", "Jake", "Ethan", "Noah", "Liam", "Aiden", "Cole", "Mason", "Lucas", "Owen",
  "Ben", "Max", "Sam", "Ty", "Alex", "Nate", "Dylan", "Carter", "Logan", "Reid",
  "Caleb", "Jordan", "Tanner", "Hunter", "Cameron", "Brandon", "Isaac", "Avery",
  "Connor", "Gavin", "Spencer", "Julian", "Dominic", "Zach", "Trevor", "Mitchell",
  "Tristan", "Austin", "Blake", "Eli", "Miles", "Finn", "Jack", "Leo", "Kai",
  "Jasper", "Theo", "Hudson", "Asher", "Nolan", "Cooper", "Parker", "Brody",
  "Colton", "Sawyer", "Beckett", "Silas", "Rowan", "Micah", "Kieran", "Declan",
  "Grayson", "Xavier", "Calvin", "Emmett", "Holden", "Wesley", "Jude", "Rhett",
  "Landon", "Beau", "Chase", "Maddox", "Bennett", "Harrison", "Seth", "Brady",
  "Evan", "Nathan", "Adam", "Luke", "James", "Maria", "Sofia", "Elena", "Priya",
  "Mei", "Aisha", "Chloe", "Hannah", "Zoe", "Nina", "Rosa", "Tara", "Jade",
];

const lastNames = [
  "Woods", "Carter", "Miller", "Clark", "Reed", "Bennett", "Foster", "Hayes",
  "Brooks", "Ward", "Parker", "Rogers", "Price", "Turner", "Morgan", "King",
  "Russell", "Collins", "Bailey", "Murphy", "Reynolds", "Anderson", "Thompson",
  "Campbell", "Mitchell", "Baker", "Cooper", "Evans", "Bell", "Young", "Hill",
  "Green", "Scott", "Adams", "Nelson", "Hall", "Moore", "Lewis", "Walker",
  "Roberts", "Phillips", "Howard", "Fisher", "Graham", "Hughes", "Murray",
  "Watson", "Stewart", "Morrison", "Gibson", "Hamilton", "Robertson", "Stone",
  "Fox", "Henderson", "Sullivan", "Bryant", "Holland", "Barrett", "McDonald",
  "Fraser", "Lawson", "Bishop", "Johnston", "Gardner", "Peters", "Chapman",
  "Harper", "Spencer", "Simmons", "Crawford", "Pearson", "Fleming", "Barnes",
  "Wagner", "Hawkins", "Holt", "Boyd", "Jennings", "Burke", "Chen", "Patel",
  "Kim", "Nguyen", "Singh", "Diaz", "Torres", "Flores", "Rossi", "Khan",
];

function makeName() {
  return `${pick(firstNames)} ${pick(lastNames)}`;
}

type RawAthlete = {
  athlete_name: string;
  bodyweight: number;
  bench: number;
  squat: number;
  deadlift: number;
  endurance_seconds: number;
  strength_index: number;
  endurance_index: number;
  total_lift: number;
  strength_ratio: number;
};

type SeededAthlete = RawAthlete & {
  strength_percentile: number;
  endurance_percentile: number;
  hq_score: number;
  rank: string;
  archetype: string;
  status: "approved" | "pending";
};

/**
 * Sample bodyweight (kg): trained adults, ~55–115, centered ~80.
 */
function sampleBodyweightKg(): number {
  const kg = randNormal(80, 11);
  return roundKg(clamp(kg, 55, 115), 1);
}

/**
 * Draw lift ratios (lift/bodyweight) with profile bias and noise.
 * Spreads novice → advanced across the population.
 */
function sampleLiftRatios(profile: {
  strengthBias: number;
  level: number;
}) {
  const { strengthBias, level } = profile;
  const jitter = () => rand(-0.08, 0.08) * (1 - level * 0.35);

  const benchMid = 0.55 + level * 0.55 + strengthBias * 0.25;
  const squatMid = 0.85 + level * 0.75 + strengthBias * 0.35;
  const deadMid = 1.05 + level * 0.95 + strengthBias * 0.4;

  const benchRatio = clamp(
    benchMid + jitter() + rand(-0.12, 0.12),
    0.45,
    1.95,
  );
  const squatRatio = clamp(
    squatMid + jitter() + rand(-0.15, 0.15),
    0.7,
    2.85,
  );
  const deadliftRatio = clamp(
    deadMid + jitter() + rand(-0.15, 0.15),
    0.9,
    3.15,
  );

  return { benchRatio, squatRatio, deadliftRatio };
}

/**
 * Half-marathon-equivalent seconds for trained hybrid athletes.
 *
 * Target population spread (before clamp):
 *   ~4500s fastest (~1:15 half), ~6300s median (~1:45), ~9000s slowest (~2:30).
 * Fitter overall profiles (level) tend to run faster; endurance-biased outliers
 * pull toward the fast end, strength-biased toward the slow end.
 */
function sampleEnduranceSeconds(profile: {
  enduranceBias: number;
  strengthBias: number;
  level: number;
}): number {
  const FAST_SEC = 4500;
  const SLOW_SEC = 9000;
  const span = SLOW_SEC - FAST_SEC;

  const runFitness = clamp(
    0.35 +
      profile.level * 0.45 +
      profile.enduranceBias * 0.35 -
      profile.strengthBias * 0.25 +
      randNormal(0, 0.07),
    0,
    1,
  );

  const meanSeconds = SLOW_SEC - runFitness * span;
  const seconds = meanSeconds + randNormal(0, 400);
  return Math.round(clamp(seconds, FAST_SEC, SLOW_SEC));
}

function genRawAthlete(): RawAthlete {
  const bodyweight = sampleBodyweightKg();

  const archetypeRoll = Math.random();
  const strengthBias =
    archetypeRoll < 0.22 ? rand(0.35, 0.75) : archetypeRoll > 0.78 ? rand(-0.35, 0.1) : rand(-0.1, 0.25);
  const enduranceBias =
    archetypeRoll > 0.78 ? rand(0.35, 0.75) : archetypeRoll < 0.22 ? rand(-0.35, 0.1) : rand(-0.1, 0.25);

  const level = clamp(randNormal(0.48, 0.22), 0.08, 0.95);

  const { benchRatio, squatRatio, deadliftRatio } = sampleLiftRatios({
    strengthBias,
    level,
  });

  const bench = roundKg(bodyweight * benchRatio, 2.5);
  const squat = roundKg(bodyweight * squatRatio, 2.5);
  const deadlift = roundKg(bodyweight * deadliftRatio, 2.5);

  const endurance_seconds = sampleEnduranceSeconds({
    enduranceBias,
    strengthBias,
    level,
  });

  const strength_index = computeStrengthIndex({
    bodyweightKg: bodyweight,
    benchKg: bench,
    squatKg: squat,
    deadliftKg: deadlift,
  });

  const endurance_index = computeEnduranceIndex(endurance_seconds);

  const total_lift = bench + squat + deadlift;
  const strength_ratio = Number((total_lift / bodyweight).toFixed(2));

  return {
    athlete_name: makeName(),
    bodyweight,
    bench,
    squat,
    deadlift,
    endurance_seconds,
    strength_index,
    endurance_index,
    total_lift,
    strength_ratio,
  };
}

function scorePopulation(raw: RawAthlete[]): SeededAthlete[] {
  const dataset = buildScoringDataset(
    raw.map((r) => ({
      strength_index: r.strength_index,
      endurance_index: r.endurance_index,
      endurance_seconds: r.endurance_seconds,
    })),
  );

  return raw.map((r) => {
    const strength_percentile = percentileMidrank(
      dataset.strengthScores,
      r.strength_index,
    );

    const endurance_percentile = percentileMidrank(
      dataset.enduranceScores,
      r.endurance_index,
    );

    const hq_score = canonicalScoreFromPercentiles(
      strength_percentile,
      endurance_percentile,
    );

    return {
      ...r,
      strength_percentile,
      endurance_percentile,
      hq_score,
      rank: getTier(hq_score),
      archetype: getArchetype(strength_percentile, endurance_percentile),
      status: hq_score >= 90 ? ("pending" as const) : ("approved" as const),
    };
  });
}

async function deleteAllSubmissions() {
  console.warn("");
  console.warn("══════════════════════════════════════════════════════════════");
  console.warn("  DELETE ALL ROWS in `submissions` (full table wipe)");
  console.warn("══════════════════════════════════════════════════════════════");
  console.warn("");

  const { error } = await supabase
    .from("submissions")
    .delete()
    .not("id", "is", null);

  if (error) {
    throw new Error(`Failed to delete existing submissions: ${error.message}`);
  }
}

async function run() {
  const count = Number(process.env.SEED_COUNT) || DEFAULT_SEED_COUNT;

  await deleteAllSubmissions();

  console.log(`Generating ${count} synthetic athletes (kg + half-marathon-equiv seconds)…`);

  const raw = Array.from({ length: count }, () => genRawAthlete());
  const athletes = scorePopulation(raw);

  const chunkSize = 200;
  for (let i = 0; i < athletes.length; i += chunkSize) {
    const chunk = athletes.slice(i, i + chunkSize);
    const { error } = await supabase.from("submissions").insert(chunk);
    if (error) {
      throw new Error(`Insert error at offset ${i}: ${error.message}`);
    }
    console.log(`  inserted ${Math.min(i + chunk.length, athletes.length)} / ${athletes.length}`);
  }

  const hqValues = athletes.map((a) => a.hq_score);
  const minHq = Math.min(...hqValues);
  const maxHq = Math.max(...hqValues);

  console.log("");
  const approvedCount = athletes.filter((a) => a.status === "approved").length;
  const pendingCount = athletes.length - approvedCount;
  console.log(`SUCCESS: Seeded ${athletes.length} submissions.`);
  console.log(`  approved: ${approvedCount}, pending (HQ ≥ 90): ${pendingCount}`);
  console.log(`  HQ range: ${minHq} – ${maxHq}`);
  console.log(`  Weights stored in kg; endurance in half-marathon-equivalent seconds.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
