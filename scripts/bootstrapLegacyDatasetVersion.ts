/**
 * TRANSITIONAL: create a DRAFT `legacy_mixed_provisional` dataset version.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * There is a chicken-and-egg problem at launch. POST /api/score refuses to score
 * without an active dataset, and the normal builder
 * (scripts/createScoringDatasetVersion.ts) only accepts governed v2 results —
 * which cannot exist until scoring works. "Wait for public opt-ins" therefore
 * cannot produce the FIRST dataset.
 *
 * This tool breaks that deadlock exactly once, using the same rows the currently
 * live scoring population already uses: complete, valid, approved legacy rows.
 *
 * ── What it is honest about ───────────────────────────────────────────────────
 * Those rows are `legacy_unknown`. The table mixes seeded synthetic athletes
 * with real self-reported entries and NOTHING in the repository can tell them
 * apart. A dataset built from them is therefore marked
 * `kind = 'legacy_mixed_provisional'`, which POST /api/score returns as
 * `datasetKind` so Group 3 can disclose "provisional legacy mixed benchmark" to
 * athletes. It is never presented as verified or observed.
 *
 * ── What it will never do ─────────────────────────────────────────────────────
 *   - update, reclassify, publish, or delete a submission (it only SELECTs);
 *   - make any legacy row leaderboard-visible;
 *   - activate a dataset;
 *   - run during build, dev, or deploy.
 *
 * Usage:
 *   # 1. Inspect only (default — writes nothing):
 *   npx tsx scripts/bootstrapLegacyDatasetVersion.ts --label "2026-08 provisional legacy"
 *
 *   # 2. Create the draft:
 *   CONFIRM_LEGACY_MIXED_BOOTSTRAP="I understand this dataset mixes unknown real and simulated legacy data" \
 *     npx tsx scripts/bootstrapLegacyDatasetVersion.ts \
 *     --label "2026-08 provisional legacy" --commit
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import {
  DatasetDraftError,
  insertDraft,
  parseReferenceRow,
  prepareDraft,
  printDraftSummary,
} from "./lib/datasetDraft";

const CONFIRM_TOKEN =
  "I understand this dataset mixes unknown real and simulated legacy data";

type Row = {
  status: string | null;
  provenance: string | null;
  bodyweight: number | null;
  bench: number | null;
  squat: number | null;
  deadlift: number | null;
  endurance_seconds: number | null;
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

function printDisclosure() {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  PROVISIONAL LEGACY MIXED BENCHMARK                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("  The source rows are classified `legacy_unknown`. They mix");
  console.log("  seeded SIMULATED athletes with REAL self-reported entries and");
  console.log("  the two cannot be told apart from the data.");
  console.log("");
  console.log("  A score measured against this dataset is provisional. The API");
  console.log("  reports datasetKind = 'legacy_mixed_provisional' so the UI can");
  console.log("  say so plainly. Retire it as soon as enough governed observed");
  console.log("  results exist.");
  console.log("");
}

async function main() {
  const label = arg("label");
  const commit = hasFlag("commit");
  const confirmed = process.env.CONFIRM_LEGACY_MIXED_BOOTSTRAP === CONFIRM_TOKEN;

  if (!label) {
    console.error(
      'A version label is required, e.g. --label "2026-08 provisional legacy".',
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

  // Read-only. This tool issues no INSERT, UPDATE, or DELETE against
  // public.submissions, ever.
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "status,provenance,bodyweight,bench,squat,deadlift,endurance_seconds,strength_index,endurance_index",
    );

  if (error) {
    console.error("Could not read submissions:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];

  const excluded: Record<string, number> = {
    "not approved": 0,
    "not legacy": 0,
    incomplete: 0,
    corrupt: 0,
  };

  const strengthReference: number[] = [];
  const enduranceReference: number[] = [];
  let legacyUnknown = 0;

  for (const row of rows) {
    // Pending and rejected rows never enter a reference population.
    if (row.status !== "approved") {
      excluded["not approved"]++;
      continue;
    }
    // Only pre-governance rows. Governed rows belong to the observed builder.
    if (row.provenance !== "legacy_unknown") {
      excluded["not legacy"]++;
      continue;
    }
    if (
      row.bodyweight === null ||
      row.bench === null ||
      row.squat === null ||
      row.deadlift === null ||
      row.endurance_seconds === null
    ) {
      excluded.incomplete++;
      continue;
    }

    // Shared with the observed builder so both tools agree on eligibility.
    // An index of exactly 0 or exactly 100 is valid and is kept.
    const pair = parseReferenceRow({
      strengthIndex: row.strength_index,
      enduranceIndex: row.endurance_index,
      enduranceSeconds: row.endurance_seconds,
    });

    if (!pair) {
      excluded.corrupt++;
      continue;
    }

    legacyUnknown++;
    strengthReference.push(pair.strengthIndex);
    enduranceReference.push(pair.enduranceIndex);
  }

  const draft = prepareDraft({
    label,
    kind: "legacy_mixed_provisional",
    strengthReference,
    enduranceReference,
    // Honest accounting: every source row is legacy_unknown. No row is
    // upgraded, relabelled, or counted as self-reported.
    sourceCounts: { legacy_unknown: legacyUnknown },
  });

  printDraftSummary(draft, rows.length, excluded);
  printDisclosure();

  if (!commit) {
    console.log("Inspection only. Re-run with --commit to create the draft.");
    return;
  }

  if (!confirmed) {
    console.error("Refusing to write. Set the confirmation token exactly:");
    console.error("");
    console.error(`  CONFIRM_LEGACY_MIXED_BOOTSTRAP="${CONFIRM_TOKEN}"`);
    process.exit(1);
  }

  const id = await insertDraft(supabase, draft);

  console.log(`Created DRAFT legacy_mixed_provisional dataset version ${id}`);
  console.log("");
  console.log("It is NOT active, and no submission was modified. Activation is");
  console.log("a separate, reviewed step — see docs/group-2-migration-runbook.md,");
  console.log("sections 4b and 5.");
}

main().catch((e: unknown) => {
  if (e instanceof DatasetDraftError) {
    console.error(`Refusing: ${e.message}`);
    process.exit(1);
  }
  console.error(e instanceof Error ? e.message : "Unknown error");
  process.exit(1);
});
