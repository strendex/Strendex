/**
 * Create a DRAFT `observed` scoring dataset version.
 *
 * "Observed" means the reference population is built only from governed v2
 * results: approved, public, complete, and self-reported or better. This is the
 * steady-state builder. It cannot bootstrap the very first dataset, because no
 * governed results exist until scoring works — for that transitional case use
 * scripts/bootstrapLegacyDatasetVersion.ts.
 *
 * This script is administrative and interactive-by-intent. It is NOT wired into
 * `npm run build`, `npm run dev`, or any deployment step, and it must never be.
 *
 * What it does:
 *   - reads eligible `submissions` rows (read-only);
 *   - excludes simulated, legacy-unknown, rejected, pending, private, unlisted,
 *     incomplete, and corrupt records;
 *   - computes the shared deterministic dataset hash;
 *   - prints a source-count / sample summary;
 *   - with an explicit label AND explicit confirmation, inserts ONE draft row.
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

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import { SCORE_VERSION, VALIDATION_BOUNDS } from "../lib/scoring/core";
import {
  DatasetDraftError,
  insertDraft,
  prepareDraft,
  printDraftSummary,
} from "./lib/datasetDraft";

const CONFIRM_TOKEN = "yes";

/** Provenance values allowed into an observed reference population. */
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

function isValidIndex(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 100;
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

  const excluded: Record<string, number> = {
    "not approved": 0,
    provenance: 0,
    "not public": 0,
    "score version": 0,
    incomplete: 0,
    corrupt: 0,
  };
  const sourceCounts: Record<string, number> = {};

  const strengthReference: number[] = [];
  const enduranceReference: number[] = [];

  for (const row of rows) {
    if (row.status !== "approved") {
      excluded["not approved"]++;
      continue;
    }
    if (
      !row.provenance ||
      !(ELIGIBLE_PROVENANCE as readonly string[]).includes(row.provenance)
    ) {
      excluded.provenance++;
      continue;
    }
    if (row.visibility !== "public") {
      excluded["not public"]++;
      continue;
    }
    if (row.score_version !== SCORE_VERSION) {
      excluded["score version"]++;
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
      !isValidIndex(s) ||
      !isValidIndex(e) ||
      !Number.isFinite(secs) ||
      secs < VALIDATION_BOUNDS.canonicalEnduranceSeconds.min ||
      secs > VALIDATION_BOUNDS.canonicalEnduranceSeconds.max
    ) {
      excluded.corrupt++;
      continue;
    }

    sourceCounts[row.provenance] = (sourceCounts[row.provenance] ?? 0) + 1;
    strengthReference.push(s);
    enduranceReference.push(e);
  }

  for (const p of ELIGIBLE_PROVENANCE) {
    sourceCounts[p] = sourceCounts[p] ?? 0;
  }

  const draft = prepareDraft({
    label,
    kind: "observed",
    strengthReference,
    enduranceReference,
    sourceCounts,
  });

  printDraftSummary(draft, rows.length, excluded);

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

  const id = await insertDraft(supabase, draft);

  console.log(`Created DRAFT observed dataset version ${id}`);
  console.log("");
  console.log("It is NOT active. Activation is a separate, reviewed step —");
  console.log("see docs/group-2-migration-runbook.md, section 5.");
}

main().catch((e: unknown) => {
  if (e instanceof DatasetDraftError) {
    console.error(`Refusing: ${e.message}`);
    process.exit(1);
  }
  console.error(e instanceof Error ? e.message : "Unknown error");
  process.exit(1);
});
