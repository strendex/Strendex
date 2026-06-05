import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function minMedMax(values: number[]): [number, number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[0], median(sorted), sorted[sorted.length - 1]];
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) process.exit(1);

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("submissions")
    .select("endurance_seconds,hq_score,strength_index")
    .eq("status", "approved");

  if (error) process.exit(1);

  const rows = data ?? [];
  const endurance = rows
    .map((r) => Number(r.endurance_seconds))
    .filter(Number.isFinite);
  const hq = rows.map((r) => Number(r.hq_score)).filter(Number.isFinite);
  const strength = rows
    .map((r) => Number(r.strength_index))
    .filter(Number.isFinite);

  const [eMin, eMed, eMax] = minMedMax(endurance);
  const [hMin, hMed, hMax] = minMedMax(hq);
  const [sMin, sMed, sMax] = minMedMax(strength);

  console.log(rows.length);
  console.log(`${eMin} ${eMed} ${eMax}`);
  console.log(`${hMin} ${hMed} ${hMax}`);
  console.log(`${sMin} ${sMed} ${sMax}`);
})();
