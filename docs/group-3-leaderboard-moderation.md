# Group 3 — Leaderboard, moderation, permissions, legacy routes

Branch: `launch/group-1-score-consistency` (uncommitted, on top of Groups 1–2).
Applied to **staging only**: all five migrations, `20260929_01` to `_05`
(2026-09-29). Staging verification is complete (see "Staging results"). The
test deployment is on the separate Vercel project `strendex-staging`. Nothing
is deployed to production, and no production access was used.

## The rules (plain English)

**Leaderboard.** One rule, in `lib/leaderboard.ts`, used by both `/rankings`
and the calculator's placement. A result is ranked only if it is:
- **approved**;
- **public**;
- scored against the **active** frozen dataset; and
- scored with the **current** score version.

Everything else is never ranked: pending, rejected, private or unlisted
results; results from an older dataset; the 519 legacy rows; and the frozen
reference dataset of 517 benchmark entries.

- **Order:** Hybrid Score, highest first. Ties share a rank (1, 2, 2, 4) and
  are listed earliest first, then by row id.
- **Sorting:** sorting by name or newest never changes a result's rank.
- **Counts:** counts are **results**, not athletes, and always cover the whole
  eligible population. The page shows the top 200.
- **Empty board:** zero eligible results shows "No ranked results yet". It does
  not show an error or pad the board with other rows.

**Where it runs.** `/rankings` is rendered on the server with the service role
(`lib/server/rankings.ts`). It sends the browser only rank, name, score, tier,
archetype and date. A production build against staging showed no ids, raw
inputs, idempotency data or dataset arrays in the page. In `next dev`, Next.js
embeds React debug data, including raw query responses, in the page. That is
development-only.

**Placement.** **Enabled** (`LEADERBOARD_PLACEMENT_AVAILABLE = true`) after the
staging checks below passed, as a separate change. The results screen shows one
labelled line under the stat tiles: "Leaderboard placement: #4 of 9 public
results". It comes from `placementLine` in `lib/tool/resultPresentation.ts` and
never shows a percentage, so it can't be mistaken for the benchmark
percentiles. When the server returns no placement, the line gives the reason
instead, never a number:
- pending: under review;
- rejected: not approved;
- private or unlisted: not shown on the leaderboard;
- approved and public but no placement: placement isn't available right now.

The share-card footer shows `#rank / total` only when the server returned one,
and "CAN YOU BEAT THIS?" otherwise. The server computes placement with the
shared rule in **one database statement**, `public.leaderboard_placement`
(migration `20260929_04`). It returns `{higher, total}`, computed together by a
single `SELECT` with `count(*) FILTER (...)`, so both numbers come from the same
snapshot:
- rank = 1 + the number of eligible results scoring strictly higher;
- total = all eligible results.

The function's `WHERE` clause is the same eligibility rule the application
uses; a test compares the two. No score list is fetched, so PostgREST's
`max-rows` cap cannot truncate it. The project's row limit is left as it is.

**What the null check means.** Within one snapshot, an eligible result is
counted in `total` and not in `higher`, so `total ≥ higher + 1`. If the function
returns less, the saved result itself was not eligible at that moment (for
example, it was moderated in the meantime), and no placement is returned. This
is the only inconsistency it detects. The count still reflects the moment the
function ran, not the moment the result was saved: results added or removed
between the save and the placement query are counted as of the query.

If placement can't be loaded (for example, before `20260929_04` exists on an
environment), the saved result is still returned, with no placement, and a
warning is logged. Replaying a result from an older dataset gets no placement.
The flag was turned on only after the staging checks below passed.

*Corrections:*
- *v2:* the first pass fetched every eligible `hq_score` in one request and
  used the array's length, which a 1,000-row API cap would silently truncate.
  `/rankings` now fails closed if its 200-row page comes back short of
  `min(200, total)`.
- *v3:* v2 used two separate count requests. Those read two different
  snapshots, and the check between them did not detect most concurrent changes.
  They were replaced by the single statement above.

**Moderation.** The server saves scores of 90 or above as `pending` and lower
scores as `approved` (`REVIEW_THRESHOLD = 90`). Approving a score of 90 or above,
or rejecting any row, now needs a deliberate SQL update that records
`moderated_at` and a non-blank `moderated_by`. The app never writes those
fields, and no public key can.

**Legacy routes.** `POST`/`GET` `/api/submit` and `/api/rank` return **HTTP
410** with "Please refresh the page and try again." They no longer read or
write the database.

**Athlete Review.** The calculator stores the saved result's
`datasetVersionId` and `scoreVersion` in the review snapshot. The review sends
them, and the route loads **that** frozen, hash-verified dataset, whether it is
active or retired.
- **Refused with a recalculate request (HTTP 409 `RECALCULATE_REQUIRED`):** a
  missing, malformed or unknown ID, or a different score version. These never
  fall back to the active dataset.
- **Snapshots saved before this change:** the review page shows the same
  request before the questionnaire starts.
- **Response:** includes `meta.datasetVersionId` and `meta.scoreVersion`.
- **Privacy:** there is no saved-row lookup.

## Staging permission findings (2026-09-29)

**Confirmed by the catalog audit** of staging (`rnifjhxnxopyrueakxpz`), run by
the owner with `migrations/verify/20260929_verify_submissions_permissions.sql`:
- **`submissions`:** anon and authenticated have **SELECT only**, granted
  directly. They have no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or
  TRIGGER, and no column-level grants. With SELECT they can read **every
  column** of the rows RLS allows, including `original_*`, `idempotency_key`,
  `request_fingerprint`, `admin_note` and `public_result_id`. RLS is enabled
  but not forced. The two policies allow approved rows only, and only NULL or
  public visibility.
- **`scoring_dataset_versions`:** anon and authenticated have no access. RLS is
  enabled and forced.
- **`score_result_insert(jsonb)`:** SECURITY DEFINER, executable by postgres
  and service_role only.
- **`ai_rl_hit(text, text, bigint)`:** SECURITY INVOKER. PUBLIC, anon and
  authenticated may execute it (`{=X/postgres, …, anon=X, authenticated=X,
  service_role=X}`).
- **Default privileges in `public`**, for both the postgres and supabase_admin
  owners: every **new** table gets full rights for anon and authenticated
  (`arwdDxtm`), and every new function and sequence gets EXECUTE or usage. So
  any future object needs explicit revokes. `20260929_04` does this for its
  function and asserts the result.
- **Live `submissions_status_by_score`:** `(hq_score >= 90 AND status =
  'pending') OR (hq_score < 90 AND status IN ('approved','pending'))`, with no
  NULL branch (a NULL score passes a CHECK anyway). `20260929_01`'s
  preconditions match this definition.

**What this means for the migrations:**
- `20260929_02` (revoke writes) is a **no-op on staging**, since no public
  write privilege exists. It stays in the plan as a defensive guard for
  production, which hasn't been audited.
- `20260929_03` (revoke SELECT) removes the column exposure above once the
  server-rendered `/rankings` is live.

**Not established:** `ai_rl_hit` runs with the caller's rights, and the audit
doesn't cover the table it writes or that table's policies. Whether a public
caller could actually change a rate-limit counter is therefore **unknown**.
Public EXECUTE is simply unnecessary: every legitimate caller uses the service
role (see `20260929_05`).

**Earlier probe (GET requests with the public key)**, consistent with the
above: 524 of 545 rows readable (517 legacy, 7 public); 0 of 16 pending and 0
of 6 private rows visible; raw input columns readable on public rows; `42501`
on `scoring_dataset_versions`.

**Audit.** The verify file is **one read-only statement** returning one result
set (`ord | section | subject | detail`). Its sections are RLS, policies, table
ACLs (read from the catalog, **including PUBLIC**), column ACLs, effective table
and column privileges, default privileges, CHECKs, function EXECUTE rights, and
role membership. Run it on production before its migrations, and keep every
export; the rollbacks re-grant from them.

**Tested on throwaway local PostgreSQL 17 clusters only**, deleted afterwards.
No project database was involved.
- **Audit and `_01` to `_03`:** the mock had SELECT granted to PUBLIC, INSERT
  to anon and a column-level UPDATE(status) to authenticated.
  - The audit reported all three.
  - Moderation guards: approving a 95 is refused with no record, a blank
    operator or a timestamp only, and succeeds with both. Rejecting needs a
    record. A new 90+ insert as `approved` is refused.
  - `_02` removed the writes and left reads working.
  - `_03` aborted without its confirmation setting. With it, the public roles
    got "permission denied" and service_role still read.
- **`_04` and `_05`:** the mock used staging's default privileges and
  `ai_rl_hit`'s exact audited ACL.
  - `leaderboard_placement` returned `{higher: 2, total: 7}` for a tied score
    and excluded every ineligible kind of row.
  - Re-applying `_04` aborts.
  - anon and authenticated got "permission denied" on both functions.
  - service_role still executes `ai_rl_hit`, which stays SECURITY INVOKER with
    ACL `{postgres, service_role}`.

## Migrations (staging: all five applied. Production: none)

| File | What it does | When |
|---|---|---|
| `20260929_01_submissions_moderation.sql` | Adds `moderated_at` and `moderated_by` (nullable, no backfill). Replaces `submissions_status_by_score` so approving a score of 90+ or rejecting anything needs a complete moderation record. Stores the old definition in a constraint comment for rollback. | Any time |
| `20260929_02_submissions_revoke_public_writes.sql` | Revokes all write privileges on `submissions` from PUBLIC, anon and authenticated. Column-level grants go with them. Postconditions check *effective* privileges. | Any time; no browser code writes |
| `20260929_03_submissions_revoke_public_select.sql` | Revokes public SELECT. Refuses to run without `SET strendex.confirm_rankings_server_rendered = 'yes';` | **Only after** the server-rendered `/rankings` is live on that environment |
| `20260929_04_leaderboard_placement_function.sql` | Creates `leaderboard_placement(uuid, text, numeric)`: STABLE, SECURITY INVOKER, fixed `search_path`. It returns `{higher, total}` from one statement. It is revoked from PUBLIC, anon and authenticated despite the default privileges, and granted to service_role. Postconditions assert all of this. | **Before** the Group 3 deploy on that environment |
| `20260929_05_ai_rl_hit_revoke_public_execute.sql` | Revokes EXECUTE on `ai_rl_hit(text, text, bigint)` from PUBLIC, anon and authenticated, and keeps service_role. It aborts on any other overload, and asserts the body, security mode, owner and settings are unchanged. | Any time: every caller, on this branch and on `origin/main`, uses the service role |
| `20260929_06_public_role_privilege_cleanup.sql` | **Added after the production audit (2026-09-29); not yet applied anywhere.** It covers what production grants and the earlier files miss. On `ai_rate_limits` and `ai_analysis_cache` it revokes every table privilege from PUBLIC, anon and authenticated, including PostgreSQL 17's MAINTAIN. On `submissions` it revokes everything except SELECT (adding MAINTAIN, which `_02` misses), and public SELECT stays until `_03`. It revokes EXECUTE on the unused `ai_rate_limit_increment(text,text,bigint)`. service_role is unchanged, and postconditions assert that. Tested on a disposable Postgres 17 replica of production's grants. Its rollback has two variants: A for the planned order, B only if run before `_02`. Compare with the audit taken immediately before `_06` before using either. | After `_05`, before the release |

## Deployment order

The production app currently deployed reads `/rankings` in the browser with the
public key and scores through `/api/rank` and `/api/submit`. Revoking SELECT,
or retiring those routes, before the new build is live breaks production.

1. **Staging:** the verify SQL has run (2026-09-29, findings above). Apply
   `20260929_01`, `20260929_02`, `20260929_04` and `20260929_05`, then run the
   verify SQL again.
2. **Staging:** deploy a preview of this branch pointing at staging. Run the
   checks below.
3. **Staging:** `SET strendex.confirm_rankings_server_rendered = 'yes';`, apply
   `20260929_03`, run the verify SQL again, and confirm `/rankings` still
   loads.
4. **Production, before deploying:** run the verify SQL and keep the export.
   Apply the Group 1 migrations and dataset per `docs/group-1-runbook.md`, then
   `20260928_01`, `20260929_01`, `20260929_02`, `20260929_04` and
   `20260929_05`, then `20260929_06`. All of these are compatible with the app currently deployed:
   its `ai_rl_hit` callers use the service role, and nothing it runs calls
   `leaderboard_placement`.
5. **Production:** deploy the new app **in one deploy**: the calculator on
   `/api/score`, server-rendered `/rankings`, and the retired legacy routes.
   Never ship the 410 routes without the new calculator.
6. **Production:** confirm `/rankings` loads. It is **empty at first**:
   production has no eligible results until new public submissions are
   approved.
7. **Production, only then:** confirm the setting and apply `20260929_03`.
8. **Placement:** `LEADERBOARD_PLACEMENT_AVAILABLE` is on in this working
   tree, verified on staging. It ships with step 5. Setting it to `false`
   withholds placement again without affecting anything else.

## Manual moderation (SQL Editor, after `20260929_01`)

Use a short operator identifier, not an email. Every statement targets one row
by its public result id and says which state it expects.

```sql
-- Review the queue
SELECT public_result_id, athlete_name, hq_score, tier, visibility, created_at
FROM public.submissions
WHERE status = 'pending' AND dataset_version_id IS NOT NULL
ORDER BY created_at;

-- Approve a pending high score
UPDATE public.submissions
SET status = 'approved', moderated_at = now(), moderated_by = 'founder'
WHERE public_result_id = 'res_xxxxxxxxxxxxxxxxxxxxxxxx' AND status = 'pending'
RETURNING public_result_id, status, hq_score, moderated_at, moderated_by;

-- Reject a result (any score)
UPDATE public.submissions
SET status = 'rejected', moderated_at = now(), moderated_by = 'founder'
WHERE public_result_id = 'res_xxxxxxxxxxxxxxxxxxxxxxxx' AND status IN ('pending', 'approved')
RETURNING public_result_id, status, hq_score, moderated_at, moderated_by;

-- Put a moderated result back in the queue (the record stays on the row)
UPDATE public.submissions
SET status = 'pending', moderated_at = now(), moderated_by = 'founder'
WHERE public_result_id = 'res_xxxxxxxxxxxxxxxxxxxxxxxx'
RETURNING public_result_id, status;
```

Each statement should report `UPDATE 1`. `UPDATE 0` means the id or the expected
state was wrong. These updates are refused:
- approving a score of 90+, or rejecting, without both `moderated_at` and
  `moderated_by`;
- a blank `moderated_by`;
- `moderated_at` without `moderated_by`, or the reverse.

## Tests (local, 2026-09-29)

`npm test` passes **356 of 356**, `tsc --noEmit` is clean, and `next build`
succeeds.
- **New Group 3 tests (71):** 38 in `tests/group3Leaderboard.test.ts`, 16 in
  `tests/group3Routes.test.ts` and 17 in `tests/group3Review.test.ts`.
- **Replaced (v3):** in `tests/scoreRepository.test.ts`, five single-RPC
  fail-closed tests replace the eight score-list tests.

**Capped-API regression.** A simulated PostgREST caps every row response at
1,000 but runs `leaderboard_placement` over everything. Its population is:
- 2,600 eligible results, stored lowest score first, so every higher score is
  beyond row 1,000;
- 700 ties at 70;
- one ineligible row of every kind.

It proves:
- a capped list read returns only 1,000 rows;
- placement equals the competition rank over all 2,600 for scores 20, 59, 70,
  71, 99 and 100 (70 is #801 of 2,600), using exactly one RPC and no row reads;
- `/rankings` shows the true top 200 with the full count, and fails closed when
  the cap is smaller than the page.

**Other coverage:**
- eligibility, for every excluded category;
- ties and their deterministic order;
- sorting that preserves rank;
- counts past 200;
- failing closed on a bad count, RPC result or row;
- the exact leaderboard query;
- the SQL function's `WHERE` clause matching the application's filters;
- both functions' permission statements, and every `ai_rl_hit` caller using a
  service-role client;
- empty and unavailable states, and the rendered copy;
- placement with the shared rule, including replays of results from an older
  dataset, and a placement failure leaving the saved result intact;
- retired routes returning 410;
- the review using saved dataset A while B is active, through the real route
  with a mocked `fetch` (no OpenAI cost);
- a missing, malformed or unknown dataset ID, or another score version,
  returning 409 with no fallback;
- snapshots with and without the benchmark IDs;
- static checks on the migrations.

**Updated existing tests:**
- `tests/group1Consistency.test.ts`: placement is now one scoped RPC, and the
  review loads the saved dataset.
- `tests/scoreRepository.test.ts`: placement now goes through
  `leaderboard_placement`.
- `tests/scoreService.test.ts`: the fake repository implements `loadPlacement`
  and `loadDatasetVersion`.
- `tests/athleteReviewGroup2.test.ts`: its fixture carries benchmark IDs.

## Staging results (2026-09-29)

**Applied by the owner on `rnifjhxnxopyrueakxpz`:** `20260929_01`, `_02`, `_04`
and `_05`. `_03` was applied later, after the preview was checked (see "Final
staging verification"). The follow-up SQL confirmed:
- `ai_rl_hit`, `leaderboard_placement` and `score_result_insert`: anon and
  authenticated false, service_role true;
- both moderation constraints are present and validated;
- `submissions`: anon and authenticated have SELECT only, and service_role
  keeps SELECT, INSERT, UPDATE and DELETE.

**Integration run: 37/37 checks passed.** The run used the local `next dev` and
test clients against staging only, with the URL and keys from
`.env.development.local` and no production env. OpenAI was never called.

| Area | Result |
|---|---|
| Active dataset | Exactly one for 2.0.0: `8bd76e2f-4cfb-47f0-8407-e5b812a6709d` |
| `leaderboard_placement` (service role) | 7 eligible results, scores 81, 79, 73, 63, 62, 62, 58. For every score, `{higher, total}` matched an independent calculation from the eligible rows, including the **existing tie at 62 (#5, #5, then #7)**. Scores 100, 85 and 0, which aren't in the population, also matched. |
| `leaderboard_placement` (public key) | Refused: HTTP 401, `42501` |
| `/rankings` | Ranks `[81→1, 79→2, 73→3, 63→4, 62→5, 62→5, 58→7]` equal the independent competition ranks |
| `ai_rl_hit` (service role, test-only key) | Counter 1, then 2 |
| `ai_rl_hit` (public key) | Refused: HTTP 401, `42501`. The next service hit returned 3, so the refused call did not increment anything |
| `POST /api/score` | 201. A 90+ test result (Hybrid Score 100) saved as **pending**, with no placement and not on `/rankings` |
| Approving without a complete record | Refused (`23514`) in all four forms: no record (`submissions_status_by_score`), timestamp only, blank operator, and operator only (`submissions_moderation_record_complete`). The row stayed pending and unmoderated |
| Approving with timestamp and operator | Succeeded (one row). The result appeared on `/rankings` at **#1**, equal to the independent rank of 1 of 8. `leaderboard_placement` agreed (`{higher 0, total 8}`) and the count went 7 → 8 |
| Rejecting with a record | Succeeded. The result left `/rankings` and the count returned to 7 |
| Existing rows | The eligible population was identical before and after the run |

**Test data kept (nothing deleted):**
- Submission `ZZ Staging G3 lw00xg`: id `3bcf1062-b739-4421-9686-9adf2c48d11a`,
  result `res_nvbv2r380xxnkzw8bay6vyaf`, idempotency key `sx-staging-g3-lw00xg`.
  It finished **rejected and private**, with `moderated_by = 'g3-staging-test'`.
  Its visibility was changed after saving, so its stored request fingerprint
  still reflects `public`. It is a test row only.
- A rate-limit counter for the test-only key `zz-staging-g3-test:lw00xg`,
  bucket `minute` / `9000475479`, now at 3. No real visitor's key was touched.

## Final staging verification (2026-09-29)

**`_03` applied by the owner.** Its checks confirmed anon and authenticated can't
read `submissions` at table or column level, and service_role keeps SELECT.

**Test deployment: a separate Vercel project, `strendex-staging`.** It has no
Git connection and no custom domains. Its only variables are the three staging
Supabase ones (Production and Preview), plus Vercel's own `NX_DAEMON`/`TURBO_*`
build variables.
- **No OpenAI or PostHog variables, and no marketplace integrations.** The
  service-role key is stored as Sensitive.
- **Deployed from a fresh isolated copy** of the working tree. It is
  byte-identical except the excluded files, plus a `vercel.json` setting the
  framework to Next.js.
- **Upload exclusions:** `.vercelignore` keeps out env files, archives, review
  exports, agent/config folders and `.vercel`. The dry run showed 147 files
  with none of those.
- **Unchanged:** the repository's own Vercel link (`strendex-krk1`), the index
  and the stashes.

| Check | Result |
|---|---|
| Public key reading `submissions` (table, `hq_score`, `athlete_name`) | Denied: HTTP 401, `42501` |
| Deployed `/rankings` vs a direct service-role read of staging's eligible rows | Identical: 8 rows, including a founder test row; 9 after the placement test below |
| Labelled test through deployed `/api/score` (score 70, approved, public) | 201. The returned placement `{rank 4, total 9}` equals the independent competition rank. Deployed `/rankings` lists it at #4 with 9 results |
| Founder browser checks, laptop and mobile, on the first preview | Passed |
| Tests after enabling placement | `npm test` 365/365; `tsc` clean; `next build` succeeds; lint shows only the old `ArchetypeIcon` warning |
| Updated preview, `https://strendex-staging-2k73yw3od-strendexs-projects.vercel.app` | `/tool` and `/rankings` return 200. `/rankings` shows 9 results identical to staging, with ranks 1, 2, 3, 4, 5, 5, 7, 7, 9 |
| Preview config | `POST /api/athlete-review` returns "Server configuration error." (no OpenAI key; exits before any database or OpenAI call). The browser bundle has the placement line and no PostHog key, Supabase project ref, service-role string or JWT |
| Labelled 90+ test through the updated preview | 201, pending, `leaderboard: null`, not on `/rankings` |

**Test data kept on staging (nothing deleted):**
- `ZZ Staging G3 placement lx0var`: id `9af6fbda-dfad-4697-bf1a-0cfcf97f750f`,
  result `res_fx2gr050x24f7r55rp28fb6m`, key `sx-staging-g3p-lx0var`. Approved
  and public; it **is on the staging leaderboard** at #4.
- `ZZ Staging G3 pending lx6w1u`: id `defca4b7-acb9-47b1-bd93-551aaa9f67d4`,
  result `res_et1vph5bdnagj2r9fsjtb4ep`, key `sx-staging-g3q-lx6w1u`. Pending
  and public; not listed.
- Earlier: `ZZ Staging G3 lw00xg` (rejected, private) and the rate-limit key
  `zz-staging-g3-test:lw00xg`.

## Remaining limitations

1. **The paid Athlete Review end-to-end check** is deferred to final launch
   testing. It is disabled on the staging preview (no OpenAI key).
2. **The placement line's null states** are checked by unit tests and by the
   API returning `null`. The pending, rejected and private lines have not been
   seen rendered in a browser. The ranked line was covered by the founder's
   browser pass only if a public test result was submitted there.
3. **Placement's snapshot** reflects the moment the placement statement ran,
   not the moment of saving (see "What the null check means").
4. **`strendex-staging`** is a test project with Deployment Protection on. Its
   first deployment is its own Production. It is not production for strendex.fit.
5. **Production:** none of the Group 3 migrations (`_01`–`_05`) are applied
   there, and nothing is deployed. Follow "Deployment order", with `_03` only
   after the new `/rankings` is live.

## Not changed here (noted)

- **Opt-in copy:** the homepage (`components/home/LeaderboardPreview.tsx`) says
  joining the leaderboard is "optional", but the calculator submits every
  result publicly. Choosing between real opt-in and different copy is a product
  decision.
- **Accent colour:** `/rankings` still uses lime on the background glow and the
  tier dots, which predates this work. The brand rule limits lime to the
  primary CTA and the score.
- **Browser SELECT policy:** once `20260929_03` runs, the approved-only SELECT
  policy and the restrictive visibility policy become inert. They are left in
  place.
