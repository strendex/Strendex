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
| `migrations/20260802_02_submissions_result_governance.sql` | Alters the live `submissions` table, **backfills `provenance` on every existing row**, runs constraint validation scans, adds a RESTRICTIVE RLS policy, and **revokes INSERT/UPDATE/DELETE on `submissions` from `anon`, `authenticated` and `PUBLIC`** (§6). Aborts up front if RLS is disabled. Also adds the nullable `original_bodyweight/bench/squat/deadlift` columns — these are **not** backfilled, and a governed row (one with a `dataset_version_id`) must carry all four plus `original_unit_system`. |
| `migrations/20260802_03_score_result_insert_rpc.sql` | Creates a `SECURITY DEFINER` function that writes to `submissions`. Requires migration 02 first. |
| `CONFIRM_CREATE_DRAFT=yes npx tsx scripts/createScoringDatasetVersion.ts --commit` | Writes an `observed` dataset version row. Inspect first without `--commit`. |
| `CONFIRM_LEGACY_MIXED_BOOTSTRAP="…" npx tsx scripts/bootstrapLegacyDatasetVersion.ts --commit` | Writes a `legacy_mixed_provisional` dataset version row. Transitional only — read §4b before running. |
| `UPDATE public.scoring_dataset_versions SET lifecycle = 'active' …` | Activation. Changes what every future score is measured against. |
| Any `UPDATE public.submissions SET provenance …` / `SET visibility …` | Reclassifies production rows. Manual, reviewed, one batch at a time. |

None of these run during `npm run build`, `npm run dev`, or a Vercel deploy.

`scripts/seedSubmissions.ts` has been **deleted**. It wiped the whole
`submissions` table before inserting synthetic rows, and after migration 02 its
inserts would have defaulted to `provenance = 'self_reported'` — quietly laundering
simulated athletes into the observed reference population. No command in this
repository can now delete or overwrite production submissions.

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

## 1b. RLS preflight — a hard production blocker

Migration 02 refuses to run if row level security is disabled on
`public.submissions`, because the visibility guard it installs is a RESTRICTIVE
policy and a RESTRICTIVE policy does nothing on a table without RLS. Check this
first; it is read-only:

```sql
-- Is RLS on, and is it forced for the owner?
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.submissions'::regclass;

-- What policies already exist, and are they permissive or restrictive?
SELECT polname,
       polpermissive AS is_permissive,
       polcmd        AS command,
       polroles::regrole[] AS roles,
       pg_get_expr(polqual, polrelid)      AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'public.submissions'::regclass
ORDER BY polname;

-- What can anon actually do at the grant level, independent of RLS?
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'submissions'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
```

**If `rls_enabled` is false, this is a production blocker.** Do not run migration
02 — it will abort by design, with nothing changed. Two facts follow from RLS
being off:

1. the anon key can read every column of every row today, including raw
   bodyweight and lifts;
2. any private or unlisted `/api/score` result would be publicly readable.

Enabling RLS is **not** additive and is deliberately out of scope for these
migrations: the existing policies and the `/rankings` query must be reviewed
first, and enabling it blind can empty the public leaderboard. Resolve this with
a human owner, then re-run migration 02.

The third query above is the **grant** picture, which RLS does not cover. The
RESTRICTIVE policy is `FOR SELECT` only, so if `anon` or `authenticated` shows
`INSERT`, `UPDATE` or `DELETE` there, a holder of the publishable key can forge a
result, promote its own row to `status = 'approved'`, or delete somebody else's —
regardless of RLS. Section 6 of migration 02 revokes exactly those three
privileges and re-grants them to `service_role` only. `SELECT` is deliberately
left alone: `app/rankings/page.tsx` reads the leaderboard with the publishable
key, and the section 5 policy is what narrows those reads.

That block is idempotent — a REVOKE of an absent privilege and a GRANT of a held
one are both no-ops — so an environment where the hardening was already applied
by hand can re-run migration 02 safely.

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

-- (d) The RESTRICTIVE visibility guard is present and applies to anon.
SELECT polname, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid)
FROM pg_policy
WHERE polrelid = 'public.submissions'::regclass
  AND polname = 'submissions_hide_non_public';
--   expect: polpermissive = f (restrictive), roles {anon,authenticated}

-- (d2) Writes are server-only. This is a GRANT check, not an RLS check — the
--      policy above is FOR SELECT and does nothing about INSERT/UPDATE/DELETE.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'submissions'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, privilege_type;
--   expect: no INSERT / UPDATE / DELETE row for any of them.
--   SELECT may (and should) still be present for anon.
--
--   If a TRUNCATE row appears for anon or authenticated, report it before
--   deploying. Supabase's default grant on public tables is ALL, which includes
--   TRUNCATE, and section 6 deliberately revokes only the three privileges that
--   PostgREST can actually issue. TRUNCATE is not reachable with a publishable
--   key (there is no TRUNCATE verb, and the anon JWT cannot open a direct
--   Postgres connection), so this is defence in depth rather than a live hole —
--   but it is a one-line follow-up if it is present.

SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'submissions'
  AND grantee = 'service_role'
ORDER BY privilege_type;
--   expect: at least SELECT, INSERT, UPDATE, DELETE.

-- (e) Governance columns from the correction pass.
SELECT count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'submissions'
  AND column_name IN ('request_fingerprint', 'dataset_kind', 'dataset_label');
--   expect: 3

-- (f) Original submitted inputs are recoverable.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'submissions'
  AND column_name IN ('original_bodyweight', 'original_bench',
                      'original_squat', 'original_deadlift')
ORDER BY column_name;
--   expect: 4 rows, double precision, is_nullable = YES (legacy rows keep NULL)

SELECT count(*) FROM public.submissions WHERE original_bodyweight IS NOT NULL;
--   expect: 0 — these are NEVER backfilled. A legacy row's original inputs are
--   not recoverable and must not be invented from the rounded kg columns.
```

The RLS state itself was already proven in §1b — migration 02 cannot have
applied unless RLS was enabled.

Then smoke-test the endpoint on staging:

```bash
curl -s -X POST "$STAGING_URL/api/score" -H 'content-type: application/json' \
  -d '{"unit_system":"kg","bodyweight":90,"bench":110,"squat":150,
       "deadlift":190,"run_distance":"5k","run_seconds":1500,
       "idempotency_key":"staging-smoke-001"}'
```

Before a dataset exists this must return **503 `DATASET_UNAVAILABLE`** — that is
the correct answer, not a bug. After activation, verify the idempotency contract:

| Call | Expected |
| --- | --- |
| Same body, same `idempotency_key`, twice | `200`, identical `resultId`, `idempotentReplay: true` |
| Same `idempotency_key`, **any input changed** | `409 IDEMPOTENCY_CONFLICT`, original row untouched |
| New `idempotency_key` | `201`, new `resultId` |

```sql
-- Confirm the conflicting call wrote nothing and changed nothing.
SELECT count(*) FROM public.submissions WHERE idempotency_key = 'staging-smoke-001';
--   expect: 1
```

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
`legacy_unknown`, and new `/api/score` results default to `private`. That is the
deadlock §4b exists to break — on a fresh install this builder cannot produce the
first dataset, and it is not supposed to fake one.

Once governed results exist, create the draft:

```bash
CONFIRM_CREATE_DRAFT=yes npx tsx scripts/createScoringDatasetVersion.ts \
  --label "2026-08 baseline" --commit
```

Review the draft before activating:

```sql
SELECT id, label, kind, lifecycle, frozen, eligible_sample_size, confidence,
       source_counts, dataset_hash
FROM public.scoring_dataset_versions
ORDER BY created_at DESC;
```

## 4b. Transitional bootstrap — the first production dataset

`POST /api/score` cannot produce a v2 result without an active dataset, and the
observed builder in §4 only accepts governed v2 results. Nothing bridges that gap
on its own: **"wait for public opt-ins" cannot bootstrap the first dataset.**

The documented transitional path is `scripts/bootstrapLegacyDatasetVersion.ts`.
It builds a reference snapshot from the same rows the currently live scoring
population already uses: complete, valid, `approved`, `legacy_unknown`
submissions. It is read-only against `submissions` — it issues no `INSERT`,
`UPDATE`, or `DELETE` there, reclassifies nothing, publishes nothing, and makes
no legacy row leaderboard-visible.

```bash
# Inspect (default — writes nothing):
npx tsx scripts/bootstrapLegacyDatasetVersion.ts --label "2026-08 provisional legacy"

# Create the draft:
CONFIRM_LEGACY_MIXED_BOOTSTRAP="I understand this dataset mixes unknown real and simulated legacy data" \
  npx tsx scripts/bootstrapLegacyDatasetVersion.ts \
  --label "2026-08 provisional legacy" --commit
```

What this dataset is, stated plainly:

- its `kind` is `legacy_mixed_provisional`, never `observed`;
- its `source_counts` records every row as `legacy_unknown`, because that is what
  they are — the table mixes seeded synthetic athletes with real self-reported
  entries and nothing can tell them apart;
- **legacy rows never appear as `verified`.** Provenance stays `legacy_unknown`
  and `verification_status` stays untouched. Being counted in a reference
  population is not a promotion;
- **it does not make any legacy row leaderboard-visible.** `visibility` is not
  written, the leaderboard query is unchanged, and no row is published;
- `/api/score` returns `datasetKind: "legacy_mixed_provisional"` and
  `datasetLabel`, so Group 3 must show the athlete a **"provisional legacy mixed
  benchmark"** disclosure alongside the score. Raw reference arrays are never
  returned to any client.

Retire it as soon as the observed builder in §4 clears the 30-sample minimum from
genuinely governed results, using the swap transaction in §5.

Both tools hash through the same `computeDatasetHash` helper, so the same
population always produces the same `dataset_hash` regardless of which tool or
how many times it is run.

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

**Steps 1–4b are implemented in code and not yet deployed.** Nothing below has
run against a database.

1. ✅ `app/tool/page.tsx` calls `POST /api/score` once (replacing the
   `/api/rank` + `/api/submit` pair). Its local `getTier`, `getArchetype`,
   `lbToKg`/`kgToLb`, `distanceMeters` and Riegel duplicates are gone; the page
   now imports `@/lib/scoring/core`.
2. ✅ The request carries the ORIGINAL unit system, weights, run distance and
   run time. The browser converts nothing.
3. ✅ One `idempotency_key` per logical submission
   (`lib/tool/scoreSubmission.ts`). The key is derived from a signature over
   exactly the fields the server fingerprints — display name, unit system, the
   four weights, run distance, run seconds, visibility — so an unchanged retry
   replays the stored row and any edit mints a new key. A `409
   IDEMPOTENCY_CONFLICT` drops the stored key so the next attempt starts clean.
   A second click while a request is in flight is refused rather than sent.
4. ✅→**superseded by product decision (2026-08-04):** the visibility control
   was built, then removed. The calculator now submits every result with an
   EXPLICIT `visibility: "public"` (`SUBMISSION_VISIBILITY` in
   `lib/tool/scoreSubmission.ts`) and discloses it in one line beside the
   button: "Calculating adds your result and display name to the public
   leaderboard." The API
   contract is unchanged — `private`/`unlisted` remain valid request values and
   the server's absent-visibility fallback is still `private`, so no other
   caller can publish by accident. A blank display name is submitted as
   "Anonymous".
4b. ✅ Benchmark transparency is consolidated into the "?" popover beside the
   score (`scoreExplanation` in `lib/tool/resultPresentation.ts`): plain-language
   scoring explanation, percentile definition, an "early and provisional"
   disclosure whenever the dataset is `legacy_mixed_provisional` or its
   confidence is `provisional`, and "results are self-reported unless
   verified". Dataset labels, versions, kinds, sample sizes, result ids and
   moderation/verification chips no longer appear in the visible results UI;
   a result that is not on the leaderboard gets one plain line saying why
   (pending review / not approved).

Consequences worth knowing before the deploy:

- **All four lifts and a run time are now required.** `parseCanonicalBenchmark`
  rejects a missing event, so the old "score me with just a bench" path cannot
  produce a v2 result. The step gating enforces it in the browser.
- The browser pre-validates with the same canonical validator the route runs, so
  an impossible entry no longer costs one of the athlete's 5 requests/minute.
- A private or unlisted result gets no rank, and the results page says so
  instead of showing a placeholder placement.

Still outstanding:

5. backfill `visibility` for legacy rows, then tighten
   `submissions_hide_non_public` to `visibility = 'public'`;
6. filter the leaderboard query on `visibility = 'public'` and on the active
   `dataset_version_id`, and label pre-cutover rows as not comparable;
7. delete `/api/rank`, `/api/submit`, and `lib/scoring/index.ts`.

Note that (7) is now unblocked for `/api/rank` — nothing calls it — but
`/api/submit` and `lib/scoring` are still reachable from `/api/athlete-review`
and the currently deployed build, so both stay until step 6 lands.

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
- `legacy_unknown` rows are **excluded from every `observed` reference
  population**. The only thing that may read them is the transitional bootstrap
  in §4b, which labels the result `legacy_mixed_provisional` and counts them
  honestly as `legacy_unknown`. They are not deleted and not hidden — the
  leaderboard shows them exactly as it does today, and the bootstrap does not
  change that either way.
- Being counted in a bootstrap dataset is **not** a promotion: those rows keep
  `provenance = 'legacy_unknown'`, never become `verified`, and are never made
  leaderboard-visible by any tool in this repository.
- They have no `dataset_version_id`, so they are never ranked against a new
  dataset version and are never presented as comparable to a v2 score.
- Reclassifying any of them to `simulated`, `self_reported`, `reviewed`, or
  `verified` is a manual, reviewed `UPDATE`. `approved` means "passed automated
  moderation" — it has never meant "verified", and the separate
  `verification_status` column exists so the two can stop being conflated.
- `scripts/seedSubmissions.ts` has been deleted. It wiped the table and, after
  migration 02, its inserts would have defaulted to `self_reported` — turning
  synthetic athletes into observed-dataset material. There is no longer any
  command in this repository that can delete or overwrite production
  submissions.

---

## Open items requiring a human decision

1. **RLS on `public.submissions` (blocker).** Migration 02 now aborts before
   changing anything if RLS is disabled, so this can no longer fail silently —
   but it still has to be resolved by a person. See §1b for the read-only
   inspection queries and what each outcome means.
2. **Column types on `submissions`.** The repository does not prove the SQL types
   of `bodyweight`, `bench`, `hq_score`, or `id`. The RPC casts through
   `double precision` and relies on Postgres assignment casts; the API reader
   accepts numeric-as-string from PostgREST. Confirm on staging before
   production.
3. **Activating a `legacy_mixed_provisional` dataset is a product decision.**
   It makes every score provisional and requires the Group 3 disclosure in the
   UI. Someone who owns the product, not just the deploy, should sign it off.
