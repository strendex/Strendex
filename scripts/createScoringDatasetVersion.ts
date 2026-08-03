/**
 * Create a DRAFT immutable scoring dataset version.
 *
 * This script is administrative and interactive-by-intent. It is NOT wired into
 * `npm run build`, `npm run dev`, or any deployment step, and it must never be.
 *
 * What it does:
 *   - reads eligible `submissions` rows (read-only);
 *   - excludes simulated, legacy-unknown, rejected, pending, private, unlisted,
 *     incomplete, and corrupt records by default;
 *   - computes a deterministic dataset hash;
 *   - prints a source-count / sample summary;
 *   - with an explicit label AND explicit confirmation, inserts ONE draft row
 *     into scoring_dataset_versions.
 *
 * What it will never do:
 *   - delete, update, or reclassify a submission;
 *   - activate a dataset (lifecycle stays 'draft' — activation is a manual,
 *     reviewed SQL step; see docs/group-2-migration-runbook.md);
 *   - run without a human typing the confirmation token.
 *
 * Usage:
 *   # 1. Inspect only (default — writes nothing):
 *   npx tsx scripts/createScoringDatasetVersion.ts --label "2026-08 baseline"
 *
 *   # 2. Create the draft:
 *   CONFIRM_CREATE_DRAFT=yes npx tsx scripts/createScoringDatasetVersion.ts \
 *     --label "2026-08 baseline" --commit
 */

import { createHash } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import {
  MIN_DATASET_SIZE,
  SCORE_VERSION,
  VALIDATION_BOUNDS,
  datasetConfidence,
} from "../lib/scoring/core";

const CONFIRM_TOKEN = "yes";

/** Provenance values allowed into a reference population. */
const ELIGIBLE_PROVENANCE = ["self_reported", "reviewed", "verified"] as const;

type Row = {
  status: string | null;
  provenance: string | null;
  visibility: string | null;
  score_version: string | null;
  bodyweight: number | null;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
  canonical_endurance_seconds: number | null;
  strength_index: number | null;
  endurance_index: number | null;
};

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Deterministic hash over exactly what makes a dataset a dataset: the scoring
 * version and the two sorted reference distributions. Two runs over the same
 * eligible population always produce the same hash.
 */
function datasetHash(
  scoreVersion: string,
  strength: number[],
  endurance: number[],
): string {
  const canonical = JSON.stringify({
    scoreVersion,
    strength: [...strength].sort((a, b) => a - b),
    endurance: [...endurance].sort((a, b) => a - b),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 64);
}

async function main() {
  const label = arg("label");
  const commit = hasFlag("commit");
  const confirmed = process.env.CONFIRM_CREATE_DRAFT === CONFIRM_TOKEN;

  if (!label) {
    console.error(
      'A version label is required, e.g. --label "2026-08 baseline".',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "status,provenance,visibility,score_version,bodyweight,bench,squat,deadlift,canonical_endurance_seconds,strength_index,endurance_index",
    );

  if (error) {
    console.error("Could not read submissions:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];

  const excluded = {
    notApproved: 0,
    provenanceExcluded: 0,
    notPublic: 0,
    wrongScoreVersion: 0,
    incomplete: 0,
    corrupt: 0,
  };
  const sourceCounts: Record<string, number> = {};

  const strength: number[] = [];
  const endurance: number[] = [];

  for (const row of rows) {
    if (row.status !== "approved") {
      excluded.notApproved++;
      continue;
    }
    if (
      !row.provenance ||
      !(ELIGIBLE_PROVENANCE as readonly string[]).includes(row.provenance)
    ) {
      excluded.provenanceExcluded++;
      continue;
    }
    if (row.visibility !== "public") {
      excluded.notPublic++;
      continue;
    }
    if (row.score_version !== SCORE_VERSION) {
      excluded.wrongScoreVersion++;
      continue;
    }
    if (
      row.bodyweight === null ||
      row.bench === null ||
      row.squat === null ||
      row.deadlift === null ||
      row.canonical_endurance_seconds === null
    ) {
      excluded.incomplete++;
      continue;
    }

    const s = Number(row.strength_index);
    const e = Number(row.endurance_index);
    const secs = Number(row.canonical_endurance_seconds);

    if (
      !finite(s) ||
      !finite(e) ||
      s <= 0 ||
      s > 100 ||
      e <= 0 ||
      e > 100 ||
      !finite(secs) ||
      secs < VALIDATION_BOUNDS.canonicalEnduranceSeconds.min ||
      secs > VALIDATION_BOUNDS.canonicalEnduranceSeconds.max
    ) {
      excluded.corrupt++;
      continue;
    }

    sourceCounts[row.provenance] = (sourceCounts[row.provenance] ?? 0) + 1;
    strength.push(s);
    endurance.push(e);
  }

  const sampleSize = Math.min(strength.length, endurance.length);
  const hash = datasetHash(SCORE_VERSION, strength, endurance);
  const confidence = datasetConfidence(sampleSize);

  console.log("");
  console.log("Scoring dataset candidate");
  console.log("─────────────────────────────────────────────");
  console.log(`  label            ${label}`);
  console.log(`  score version    ${SCORE_VERSION}`);
  console.log(`  rows scanned     ${rows.length}`);
  console.log(`  eligible sample  ${sampleSize}`);
  console.log(`  confidence       ${confidence}`);
  console.log(`  dataset hash     ${hash.slice(0, 16)}…`);
  console.log("");
  console.log("  eligible by provenance");
  for (const p of ELIGIBLE_PROVENANCE) {
    console.log(`    ${p.padEnd(16)} ${sourceCounts[p] ?? 0}`);
  }
  console.log("");
  console.log("  excluded");
  console.log(`    not approved     ${excluded.notApproved}`);
  console.log(
    `    provenance       ${excluded.provenanceExcluded}  (simulated / legacy_unknown / unset)`,
  );
  console.log(`    not public       ${excluded.notPublic}`);
  console.log(`    score version    ${excluded.wrongScoreVersion}`);
  console.log(`    incomplete       ${excluded.incomplete}`);
  console.log(`    corrupt          ${excluded.corrupt}`);
  console.log("");

  if (sampleSize < MIN_DATASET_SIZE) {
    console.error(
      `Refusing: ${sampleSize} eligible records is below the minimum of ${MIN_DATASET_SIZE}.`,
    );
    process.exit(1);
  }

  if (!commit) {
    console.log("Inspection only. Re-run with --commit to create the draft.");
    return;
  }

  if (!confirmed) {
    console.error(
      `Refusing to write. Set CONFIRM_CREATE_DRAFT=${CONFIRM_TOKEN} to create the draft.`,
    );
    process.exit(1);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("scoring_dataset_versions")
    .insert({
      label,
      score_version: SCORE_VERSION,
      lifecycle: "draft",
      frozen: false,
      strength_reference: strength,
      endurance_reference: endurance,
      eligible_sample_size: sampleSize,
      source_counts: sourceCounts,
      dataset_hash: hash,
      confidence,
    })
    .select("id,label,lifecycle")
    .single();

  if (insertError) {
    console.error("Could not create draft dataset:", insertError.message);
    process.exit(1);
  }

  console.log(`Created DRAFT dataset version ${inserted?.id}`);
  console.log("");
  console.log("It is NOT active. Activation is a separate, reviewed step —");
  console.log("see docs/group-2-migration-runbook.md, section 5.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Unknown error");
  process.exit(1);
});
