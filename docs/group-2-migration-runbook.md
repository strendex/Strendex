# Group 2 — Scoring & Data Migration Runbook

Covers the three migrations, the dataset tooling, and the deployment ordering
introduced by the canonical scoring work.

**Nothing in this document has been executed.** Every migration file and every
script call below is inert until a human runs it.

---

## Commands that MUST NOT be run until reviewed

| Command | Why it is dangerous |
| --- | --- |
| `migrations/20260802_01_scoring_dataset_versions.sql` | Creates a table, a trigger, and revokes public grants. Run in staging first. |
| `migrations/20260802_02_submissions_result_governance.sql` | Alters the live `submissions` table and adds a RESTRICTIVE RLS policy that can hide rows if `visibility` is backfilled wrongly. |
| `migrations/20260802_03_score_result_insert_rpc.sql` | Creates a `SECURITY DEFINER` function that writes to `submissions`. Requires migration 02 first. |
| `CONFIRM_CREATE_DRAFT=yes npx tsx scripts/createScoringDatasetVersion.ts --commit` | Writes a dataset version row. Inspect first without `--commit`. |
| `npx tsx scripts/seedSubmissions.ts` | **Wipes every row in `submissions`.** Never run against production. |
| `UPDATE public.scoring_dataset_versions SET lifecycle = 'active' …` | Activation. Changes what every future score is measured against. |
| Any `UPDATE public.submissions SET provenance …` / `SET visibility …` | Reclassifies production rows. Manual, reviewed, one batch at a time. |

None of these run during `npm run build`, `npm run dev`, or a Vercel deploy.

---

## 1. Backup

```sql
-- Verify row counts before anything else.
SELECT count(*) AS total,
       count(*) FILTER (WHERE status = 'approved') AS approved,
       count(*) FILTER (WHERE status = 'pending')  AS pending
FROM public.submissions;
```

Take a Supabase point-in-time backup (Dashboard → Database → Backups) **and**
export the table:

```bash
pg_dump "$STAGING_OR_PROD_URL" -t public.submissions --data-only -f submissions_backup.sql
```

Record the row counts and the backup filename in the deploy ticket.

## 2. Staging migration

Apply, in this exact order, against **staging**:

1. `migrations/20260802_01_scoring_dataset_versions.sql`
2. `migrations/20260802_02_submissions_result_governance.sql`
3. `migrations/20260802_03_score_result_insert_rpc.sql`

Each file is a single `BEGIN … COMMIT`. If one fails, nothing from that file is
applied — fix it and re-run rather than patching by hand.

## 3. Schema verification

```sql
-- (a) New columns exist and legacy rows are classified conservatively.
SELECT provenance, count(*) FROM public.submissions GROUP BY 1;
--   expect: every pre-existing row -> 'legacy_unknown'

SELECT count(*) FROM public.submissions WHERE visibility IS NOT NULL;
--   expect: 0 (visibility is deliberately left NULL for legacy rows)

-- (b) Constraints and indexes.
SELECT conname, convalidated FROM pg_constraint
WHERE conrelid = 'public.submissions'::regclass AND contype IN ('c','f')
ORDER BY conname;
--   expect: every submissions_* constraint present with convalidated = true

SELECT indexname FROM pg_indexes
WHERE tablename = 'submissions' AND indexname LIKE 'submissions_%';
--   expect: submissions_public_result_id_key, submissions_idempotency_key_key,
--           submissions_dataset_leaderboard_idx, submissions_provenance_status_idx

-- (c) The dataset table is server-only.
SELECT relrowsecurity, relforcerowsecurity FROM pg_class
WHERE oid = 'public.scoring_dataset_versions'::regclass;
--   expect: t, t   (RLS on, no policies -> anon/authenticated denied)

-- (d) Is RLS actually enabled on submissions? The RESTRICTIVE policy added by
--     migration 02 only takes effect if it is.
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.submissions'::regclass;
SELECT polname, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid)
FROM pg_policy WHERE polrelid = 'public.submissions'::regclass;
```

If (d) reports `relrowsecurity = f`, the visibility guard is inert — see
**Open item** at the bottom before going to production.

Then smoke-test the endpoint on staging:

```bash
curl -s -X POST "$STAGING_URL/api/score" -H 'content-type: application/json' \
  -d '{"unit_system":"kg","bodyweight":90,"bench":110,"squat":150,
       "deadlift":190,"run_distance":"5k","run_seconds":1500,
       "idempotency_key":"staging-smoke-001"}'
```

Before a dataset exists this must return **503 `DATASET_UNAVAILABLE`** — that is
the correct answer, not a bug. Repeat the same call twice after activation and
confirm the same `resultId` comes back with `idempotentReplay: true`.

## 4. Create and review a draft dataset

Inspect first — this writes nothing:

```bash
npx tsx scripts/createScoringDatasetVersion.ts --label "2026-08 baseline"
```

Read the printed summary and confirm by hand:

- `eligible sample` is at least 30 (below that the script refuses);
- the `excluded → provenance` count matches the number of simulated and
  legacy rows you expect to be excluded;
- the eligible-by-provenance breakdown contains no `simulated` or
  `legacy_unknown` rows (by construction it cannot, but confirm the totals add
  up against step 1's counts).

**Expected on day one: an eligible sample of 0.** Every existing row is
`legacy_unknown`, and new `/api/score` results default to `private`. Populating
the first real reference population is a deliberate product decision, not
something this migration does for you. The options, in order of preference:

1. wait until enough athletes opt into `visibility: "public"`;
2. explicitly reclassify a reviewed subset of existing rows (manual `UPDATE`,
   one batch, recorded in the ticket) — only for rows a human has actually
   looked at;
3. build a clearly-labelled simulated dataset for staging **only**, and never
   activate it in production.

Then create the draft:

```bash
CONFIRM_CREATE_DRAFT=yes npx tsx scripts/createScoringDatasetVersion.ts \
  --label "2026-08 baseline" --commit
```

Review the draft before activating:

```sql
SELECT id, label, lifecycle, frozen, eligible_sample_size, confidence,
       source_counts, left(dataset_hash, 16) AS hash
FROM public.scoring_dataset_versions
ORDER BY created_at DESC;
```

## 5. Activation (manual, deliberate, irreversible-ish)

Activation freezes the version. After this, its contents can never change — only
its lifecycle can move to `retired`.

```sql
BEGIN;
UPDATE public.scoring_dataset_versions
   SET lifecycle = 'active', frozen = true
 WHERE id = '<draft-uuid>'
   AND lifecycle = 'draft';
-- Confirm exactly one row updated, then:
COMMIT;
```

The partial unique index `scoring_dataset_versions_one_active` guarantees at
most one active version per `score_version`. To swap versions, retire the old
one in the same transaction:

```sql
BEGIN;
UPDATE public.scoring_dataset_versions SET lifecycle = 'retired' WHERE id = '<old>';
UPDATE public.scoring_dataset_versions SET lifecycle = 'active', frozen = true WHERE id = '<new>';
COMMIT;
```

## 6. Deployment ordering

1. Migrations 01 → 02 → 03 on **production** (they are additive; the currently
   deployed app does not reference any new column).
2. Deploy this branch. `/api/rank` and `/api/submit` keep their existing
   contracts; `/api/score` ships but nothing calls it.
3. Create + review + activate the dataset (steps 4–5).
4. Smoke-test `/api/score` in production with a `visibility: "private"` request.

Migrations may be applied before the deploy without breaking the running app,
and the deploy may land before the migrations without breaking it either —
`/api/score` simply returns 503/500 until the schema is in place.

## 7. Group 3 frontend cutover

Deferred to Group 3, in this order:

1. point `app/tool/page.tsx` at `POST /api/score` (one call replaces the
   `/api/rank` + `/api/submit` pair) and delete its local `getTier`,
   `getArchetype`, `lbToKg`, `distanceMeters`, and Riegel duplicates in favour
   of `@/lib/scoring/core`;
2. send the ORIGINAL unit system, run distance, and run time — stop converting
   in the browser;
3. generate and reuse an `idempotency_key` per submission attempt;
4. add a visibility control (default private) to the results step;
5. backfill `visibility` for legacy rows, then tighten
   `submissions_hide_non_public` to `visibility = 'public'`;
6. filter the leaderboard query on `visibility = 'public'` and on the active
   `dataset_version_id`, and label pre-cutover rows as not comparable;
7. delete `/api/rank`, `/api/submit`, and `lib/scoring/index.ts`.

## 8. Monitoring

Structured JSON logs (`lib/server/logging.ts`) carry no performance inputs, no
names, no IPs, and no secrets. Watch for:

- `msg:"scoring unavailable"` with `code:"DATASET_UNAVAILABLE"` — no active
  dataset, every score request is failing;
- `code:"DATASET_INSUFFICIENT"` — the active dataset dropped below 30 samples;
- a rising `idempotentReplay:true` rate — clients retrying, worth investigating;
- `event:"internal_error"` — repository/provider failure, details are in the
  Supabase logs, never in the response.

Sanity query after cutover:

```sql
SELECT dataset_version_id, score_version, count(*), min(hq_score), max(hq_score)
FROM public.submissions
WHERE dataset_version_id IS NOT NULL
GROUP BY 1, 2;
```

## 9. Rollback (without losing submissions)

Rollback is a **deploy** rollback, not a data rollback. Submissions are never
deleted.

1. Revert the Vercel deployment to the previous build. `/api/rank` and
   `/api/submit` are untouched by these migrations and keep working.
2. If scoring itself is wrong, retire the dataset rather than dropping anything:

   ```sql
   UPDATE public.scoring_dataset_versions SET lifecycle = 'retired' WHERE lifecycle = 'active';
   ```

   `/api/score` then returns 503 `DATASET_UNAVAILABLE`. Already-saved results
   keep their `dataset_version_id` and stay reproducible.
3. Only if the schema itself must go (last resort, and it drops governance
   metadata for rows written since the migration — take a fresh backup first):

   ```sql
   -- DESTRUCTIVE. Requires explicit sign-off.
   DROP FUNCTION IF EXISTS public.score_result_insert(jsonb);
   DROP POLICY IF EXISTS submissions_hide_non_public ON public.submissions;
   -- Column drops are NOT recommended; prefer leaving the columns in place.
   ```

   Do **not** drop `public.scoring_dataset_versions` while any submission still
   references it — the foreign key is `ON DELETE RESTRICT` precisely so this
   fails loudly.

The one thing that cannot be undone by a deploy rollback is the `/api/submit`
review-threshold correction (95 → 90): scores of 90–94 written while this branch
was live are `pending` instead of `approved`. To reverse, approve them
explicitly by `created_at` range after review.

## 10. Legacy and simulated rows

- Every row that existed before migration 02 is `provenance = 'legacy_unknown'`.
  That is the honest classification: the table mixes seeded synthetic athletes
  with real self-reported entries and the repository cannot tell them apart.
- `legacy_unknown` rows are **excluded from every reference population** by the
  dataset builder. They are not deleted and not hidden — the leaderboard shows
  them exactly as it does today.
- They have no `dataset_version_id`, so they are never ranked against a new
  dataset version and are never presented as comparable to a v2 score.
- Reclassifying any of them to `simulated`, `self_reported`, `reviewed`, or
  `verified` is a manual, reviewed `UPDATE`. `approved` means "passed automated
  moderation" — it has never meant "verified", and the separate
  `verification_status` column exists so the two can stop being conflated.
- `scripts/seedSubmissions.ts` still writes rows without a provenance, which the
  column default now classifies as `self_reported`. It also wipes the table.
  Do not run it against production; Group 3 should either set
  `provenance: 'simulated'` explicitly in that script or delete it.

---

## Open item requiring a decision

`migrations/20260802_02` adds a RESTRICTIVE `SELECT` policy so private and
unlisted rows can never reach a public client. **A RESTRICTIVE policy only has
any effect if RLS is enabled on `public.submissions`.** The repository does not
prove whether it is. Run check (d) in step 3 first:

- RLS enabled → the guard is live, nothing more to do;
- RLS disabled → the anon key can currently read every column of every row,
  including raw bodyweight and lifts. Enabling RLS is not additive and could
  break `/rankings`, so it is deliberately out of scope here. Escalate before
  production rollout.
