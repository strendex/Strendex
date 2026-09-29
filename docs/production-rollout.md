# Production rollout — Groups 1–5

Outstanding launch tasks only, in execution order. Each step says who does it.
Only read-only checks have been run against production.

## Production today

**Read-only API inspection and the owner-run catalog audit** (`migrations/verify/20260930_verify_production_prelaunch.sql`),
both 2026-09-29.

**Where it runs**
- **Supabase:** project `rgnwrlivldzqeaxhhvet`, PostgreSQL 17.6. It serves
  `www.strendex.fit` and `strendex.fit`.
- **Vercel:** project `strendex-krk1`. Deployment
  `dpl_4GwGZTU5A59yvuBjY9LvCJKf47HY` was built from `main` (`4dd3cb4`) on
  2026-09-21. Pushing to `main` deploys production.

**Confirmed by the audit**
- **Rows:** 534 submissions. 519 are approved; the other 15 are pending, all
  scoring 90 or more. None is rejected, none lacks a score, and none is out of
  range.
- **Rounding proof:** **0 counterexamples** over all 1,002,001 percentile pairs.
  9 legacy rows differ between the old and new rounding rules, all stored per
  the old trigger. They're legacy rows, and the new rules exempt them.
- **Not applied:** the governance schema, the frozen dataset table,
  `score_result_insert` and `leaderboard_placement` are absent.
  `set_canonical_hq_score()` and `trg_set_canonical_hq_score` are present, and
  it's the only trigger.
- **`bw_range` is already 40–250 kg.** Skip the conditional `20260604`.
- **Constraint definitions** (`endurance_seconds_range` 2400–18000,
  `submissions_status_by_score`, `submissions_status_check`) match what
  `20260924_04` and `20260929_01` expect. The lift ranges (`bench` ≤ 318,
  `squat` ≤ 409, `deadlift` ≤ 454 kg) equal the app's `VALIDATION_BOUNDS`
  exactly.
- **`ai_rl_hit(text, text, bigint)`:** exactly one overload, SECURITY INVOKER.
  It's a single atomic
  `INSERT … ON CONFLICT (ip, bucket, bucket_id) DO UPDATE SET count = count + 1 … RETURNING count`
  on the full `p_ip`, backed by `PRIMARY KEY (ip, bucket, bucket_id)`. Group
  4's cap precondition is satisfied.
- **Dataset: complete, not yet eligible.** All 519 approved rows pass the
  audit's approximation: complete, indexes 0–100, endurance 4200–28800. The
  builder also needs `provenance = 'legacy_unknown'`, which exists only after
  `20260802_02`. **The eligible count comes only from the bootstrap inspect
  run** (step 7.1).
- **Vercel variable names:**
  - **No `OPENAI_REVIEW_MODEL`,** so the default `gpt-4.1-mini` applies.
  - **No `ATHLETE_REVIEW_DAILY_CAP`,** so the cap is 50.
  - The service-role, secret and OpenAI keys are stored as "Config", not
    Sensitive.

**Permissions**
- **`submissions`:** anon and authenticated have SELECT (needed by the live
  `/rankings` until the release), plus MAINTAIN, REFERENCES, TRIGGER and
  TRUNCATE. They have no INSERT, UPDATE or DELETE.
  - RLS is on, with one policy: SELECT of approved rows.
  - `20260929_02` revokes TRUNCATE, REFERENCES and TRIGGER, but **not
    MAINTAIN**.
- **`ai_rate_limits` and `ai_analysis_cache`:** anon and authenticated hold
  **every** table privilege, including MAINTAIN, through the project's default
  privileges.
  - RLS is on with **no policies**.
  - No earlier migration touches these tables.
- **Functions:** every function in `public` is executable by PUBLIC, anon and
  authenticated. Of the two counters:
  - `ai_rl_hit` is handled by `20260929_05`;
  - `ai_rate_limit_increment` has **no caller** anywhere: not in this branch,
    `origin/main`, any branch, the stashes, or the live site's public code.
    Its only historical caller, `app/api/ai-analysis` (service role), was
    removed on 2026-08-02.
- **No column-level grants. No PUBLIC table grants.**
- **Not demonstrated as exploitable.** Both counter functions are SECURITY
  INVOKER, and with RLS on and no policies, public-key row reads and writes on
  the AI tables return nothing or fail. On a disposable replica, anon calls to
  both counters already failed on RLS before any change.

  What RLS doesn't cover is TRUNCATE, REFERENCES, TRIGGER and MAINTAIN. On
  the replica, a session running **as** anon could truncate and lock these
  tables. The public API offers no way to issue those statements, and nothing
  was tried against production. They're removed because nothing needs them.
- **Closed by** the new `20260929_06_public_role_privilege_cleanup.sql` (step 6).

## How the live app keeps working while migrations run

Between the first migration (step 6) and the release (step 10), production is
still `main` (`4dd3cb4`) running on the migrated schema.

| `main` does | Key | Affected before the release? |
|---|---|---|
| `/tool` → `POST /api/rank`: reads approved rows | service role | No. The migrations only add columns. The revokes (`_02`, `_05`, `_06`) touch PUBLIC, anon and authenticated only. |
| `/tool` → `POST /api/submit`: inserts a **legacy** row (no `dataset_version_id`) with its own `hq_score`, and `status` = pending at 90 or more, approved below | service role | No. Every new CHECK allows NULLs or exempts rows without a `dataset_version_id`. The new status rule allows exactly what `main` writes. Bounds only widen. |
| `/rankings`: reads approved rows in the browser | publishable key | No, as long as `20260929_03` isn't applied. `_06` keeps public SELECT. |
| Athlete Review: `ai_rl_hit`, plus a submissions read | service role | No. `_05` and `_06` keep service-role EXECUTE and table access, and assert it. |

**Evidence:**
- **Database level: tested.** On a disposable replica of production's schema,
  constraints, trigger, grants and default privileges, all 13 migrations plus
  `_06` applied in the step 6 order. Afterwards `main`'s two `/api/submit`
  insert shapes (below 90 approved, and 90 or more pending) succeeded. The
  public roles could still read approved `submissions`; service_role could
  still use both counters and both AI tables.
- **Application level: tested on staging** (step 4.2, 8/8): the live app's
  `/api/rank` and `/api/submit` on the fully migrated schema, `_06` included.

**One side effect:** after `20260802_02`, rows `main` writes default to
`provenance = 'self_reported'`, so the legacy bootstrap excludes them.

## Tasks

### 1. Owner decisions (before touching production)
- **Launch window:** run migrations (step 6) through release (step 10) in one
  session.
- **Review model:** keep `gpt-4.1-mini`, or set `OPENAI_REVIEW_MODEL`.
- **Daily cap:** set `ATHLETE_REVIEW_DAILY_CAP`; unset means 50.
- **OpenAI budget:** set a project budget or limit.
- **Empty leaderboard:** accept that `/rankings` starts empty after the
  release.
- **Staging review:** authorise the one paid staging review (step 5). A
  dedicated, revocable staging key with a low budget is recommended.
- **Review `20260929_06`.**

### 2. Production catalog audit — done (2026-09-29)
**Result: go.** See "Production today". Keep the export: the `_06` and `_02`
rollbacks re-grant from it. Re-run the audit after step 6 and again after
step 12.

### 3. Backup (owner): next concrete action
Before step 6, take a restorable copy. Details are at the end of this file.

### 4. Staging: apply `_06` and rehearse the window (owner authorises staging DB changes)
The migrations say "staging first", and the application-level window test is
still owed. Staging already has every migration up to `_05`, including `_03`.
1. **Apply `20260929_06` on staging.** Staging's grants differ from
   production's: its `submissions` had SELECT only for public roles, and its AI
   tables were never audited. The postconditions check the result either way.
   Re-run the verify SQL. Then confirm the staging preview still works: `/tool`
   scores, `/rankings` loads, and the review route reaches its configuration
   check.
2. **Deploy `origin/main`** (`4dd3cb4`) to `strendex-staging` as a preview,
   from a fresh `git archive` copy. Make one `POST /api/rank` and one
   `POST /api/submit`, which writes one labelled staging row. Expect the frozen
   contracts, and no constraint or permission errors.
3. **Optional:** run `20260929_03`'s rollback block on staging. Confirm the old
   `/rankings` loads with the publishable key, then re-apply `_03` (with its
   confirmation setting) and re-run the verify SQL. That tests the most likely
   production rollback.

**Step 4 results (2026-09-29, staging `rnifjhxnxopyrueakxpz` only): 4.1 and 4.2 done. No blocker found for production.**

**4.1 — `20260929_06` applied on staging, with its guards unchanged.**
- **Target:** checked before connecting (`postgres.rnifjhxnxopyrueakxpz`,
  session pooler, port 5432).
- **Fingerprint (read-only):** PostgreSQL 17.6, dataset table and
  `leaderboard_placement` present, anon SELECT on `submissions` already
  revoked by `_03`, exactly one `ai_rate_limit_increment`, 553 submissions.
- **Audits:** before (175 rows) and after (159 rows), saved in
  `~/strendex-backups/staging-step4-20260929T150328Z/`.
- **Staging grants before `_06` weren't the same as production's:**
  - **AI tables:** anon and authenticated had SELECT, INSERT, UPDATE and
    DELETE on `ai_rate_limits` and `ai_analysis_cache`, but not TRUNCATE,
    REFERENCES, TRIGGER or MAINTAIN, which production has.
  - **`submissions`:** anon and authenticated had nothing at all (`_03`
    applied, and no MAINTAIN).
  - **`ai_rate_limit_increment`:** executable by PUBLIC, anon and
    authenticated.
- **After `_06`:**
  - anon and authenticated have **no** privilege on any audited table
    (`submissions`, `scoring_dataset_versions`, `ai_rate_limits`,
    `ai_analysis_cache`), MAINTAIN included;
  - `ai_rl_hit`, `ai_rate_limit_increment`, `score_result_insert` and
    `leaderboard_placement` are executable by postgres and service_role only;
  - the only changes are those 16 table-ACL entries and the counter's EXECUTE.
    Nothing outside the permission sections changed.
- **Still open:** `rls_auto_enable()` (a SECURITY DEFINER event-trigger
  function) is still executable by the public roles. It's outside `_06`'s
  scope, so decide later.

**4.2 — old app on the migrated staging database: 8/8.**
- **Deployment:** the current production app (`origin/main` `4dd3cb4`) as an
  isolated `strendex-staging` preview,
  `strendex-staging-hway7qfrz-strendexs-projects.vercel.app`. It references
  only staging.
- **`POST /api/rank`:** 200, with the unchanged contract (`hq` 83, `rank` 23 of
  536).
- **`POST /api/submit`:** 200 `{ok:true}`. It saved exactly one row,
  `ZZ Staging Rehearsal main mt46c1`
  (`857b283a-4048-4ccd-a02f-485256f94663`, kept):
  - a **legacy** row: no `dataset_version_id`, `score_version`, visibility,
    idempotency key or original inputs;
  - `provenance = self_reported`, so the legacy bootstrap will exclude it;
  - no moderation record, and `status = approved` by the old 90 threshold;
  - the stored `hq_score` (83) is the old app's own value, not re-rounded,
    because the trigger is detached.
- **What this confirms:** the migration window is safe for `/tool` scoring and
  submitting on the fully migrated schema, `_06` included, now tested at
  application level.
- **Not covered here:** the old `/rankings` page can't list results on staging,
  because `_03` is already applied there (public-key read gives `42501`). In
  production `_03` comes last, so this doesn't affect the window. Step 4.3,
  the optional `_03` rollback test, was not run.

**New app after `_06`: 13/13** on the approved Group 5 preview
(`strendex-staging-ou8nyugf9`, unchanged):
- `/`, `/tool`, `/rankings` and `/methodology` return 200;
- `/rankings` = 11 = staging's eligible rows, so the rehearsal's legacy row is
  correctly excluded;
- the `/api/score` idempotent replay works (service-role `ai_rl_hit` and
  `score_result_insert`), with no new rows;
- the review route still stops at its missing-OpenAI configuration check;
- the bundle has no keys.

**Tooling note:** `staging-apply-06.sh`'s post-apply diff printout used the
wrong separator and exited after `_06` had already committed. The fix is
display-only, and the saved audits above were analysed separately.

### 5. Real Athlete Review on staging (owner authorises one paid call; before any production change)
No real review has ever run: `strendex-staging` has no OpenAI key. This is the
first end-to-end run of Group 2's review/dataset consistency and Group 4's cap
against a real model. It must pass before the release.
1. **Add Preview-target variables** to `strendex-staging`:
   - `OPENAI_API_KEY` (Sensitive; preferably a dedicated staging key);
   - `ATHLETE_REVIEW_DAILY_CAP=1`;
   - the chosen `OPENAI_REVIEW_MODEL`, if any.

   Note the time.
2. **Deploy one preview** (isolated-copy workflow). Deploy nothing else to
   `strendex-staging` until cleanup is finished.
3. **Run once in a browser** (protected preview: `vercel curl` or the OIDC
   header): score a private labelled row, open Athlete Review, and submit the
   questionnaire once.
4. **Expect:**
   - a 200 response with a report;
   - `meta.datasetVersionId = 8bd76e2f-4cfb-47f0-8407-e5b812a6709d`;
   - `review-cap:global` for the UTC day = 1, and a second attempt that day
     refused with 503 and no model call;
   - no retry;
   - allow-listed log fields only.
5. **Clean up.** A deployment keeps the variables it was built with, so deleting
   the project variable doesn't disarm deployments already built with the key.
   1. `vercel ls strendex-staging`: list every deployment since the step 1
      time.
   2. Remove each of them: `vercel remove <deployment-url> --yes`.
   3. Delete the variables from the project.
   4. **Revoke** the dedicated staging key in OpenAI. That catches anything
      missed.
   5. Deploy a fresh keyless preview. Confirm `POST /api/athlete-review {}`
      gives "Server configuration error.", and that the removed URLs return 404.

**Step 5 results (2026-09-29, staging only): passed. One owner action remains: revoke the key.**
- **Setup:**
  - **Key:** a dedicated OpenAI key (project `strendex-staging`, key
    `strendex-staging-step5`), added by the owner to `strendex-staging` as
    `OPENAI_API_KEY`, Sensitive, **Preview only**, at about 15:23 UTC. It was
    never printed or handled here.
  - **Cap:** `ATHLETE_REVIEW_DAILY_CAP=1`, Preview only, added at 15:24:15 UTC.
    No `OPENAI_REVIEW_MODEL`, so the code default `gpt-4.1-mini` was used, as in
    production today.
- **The app:** one keyed preview, `strendex-staging-lpiivrlj6`, deployed from
  the exact source of the approved `strendex-staging-ou8nyugf9` (156 files,
  nothing forbidden).
- **The result:** the private staging result
  `ZZ Staging G4 private ly3ogq` (`res_7ayz9aw1k7ahakbqyaz59e58`, score 70,
  dataset `8bd76e2f-4cfb-47f0-8407-e5b812a6709d`, score version `2.0.0`).
  - **Inputs:** read from the saved row, with answers built from `QUESTIONS`,
    like `tests/group4ReviewCap.test.ts`.
  - **Checked first:** both passed the route's own validators locally before
    any call.
- **Probe (free):** a malformed body got 400 from validation, and the global
  counter stayed at 0. That proves the key was configured and nothing was
  reserved.
- **Request 1 (the only paid call):** HTTP 200 with a report in about 15 s.
  - `meta.datasetVersionId` was the result's dataset, and `meta.scoreVersion`
    was `2.0.0`.
  - `review-cap:global` for UTC day 20725 went **0 → 1**.
- **Request 2 (65 s later, a new per-IP minute window):** HTTP **503**, "Athlete
  Reviews have reached today's limit…", in 2.5 s, with no report. The counter
  went 1 → 2: the refused attempt is still recorded and still refused.
- **Evidence that request 2 made no model call:**
  - the Vercel runtime log shows exactly probe 400, request 1 200, and request 2
    503 with `{"level":"warn","msg":"athlete review daily cap reached","route":"/api/athlete-review","code":"review_cap_reached"}`;
  - there are no OpenAI log entries, and only allow-listed fields;
  - the cap reservation happens before the OpenAI call in the route.
  - **Owner check:** the OpenAI project's usage should show exactly one
    request.
- **Cleanup:**
  - **Deployments:** only `lpiivrlj6` was built after the key was added. The
    other recent deployments predate it: `hway7qfrz` at 14:57 UTC, and
    `ou8nyugf9` the day before. `lpiivrlj6` was removed and now returns 404.
  - **Variables:** `OPENAI_API_KEY` and `ATHLETE_REVIEW_DAILY_CAP` were removed.
    The project is back to the three staging Supabase variables.
  - **Fresh keyless preview:** `strendex-staging-5452crevw`, from the same
    source. `/` and `/tool` return 200, and `POST /api/athlete-review {}` returns
    500 "Server configuration error.", so no key is present.
  - **Unchanged:** the approved `ou8nyugf9` still returns 200.
  - **Owner action:** revoke `strendex-staging-step5` in OpenAI. Nothing uses
    it any more.
- **Staging test data left:** `ai_rate_limits` has `review-cap:global` / day
  20725 = 2, plus per-IP review counters for this machine.
- **What this proves end to end with a real model:** Group 2's review/dataset
  consistency and Group 4's single-attempt daily cap.

### 6. Production migrations (owner, SQL Editor, in this order)
Stop at the first abort; don't edit guards. Skip `20260604` (the audit shows
`bw_range` already 40–250).
1. `20260802_01_scoring_dataset_versions.sql`
2. `20260802_02_submissions_result_governance.sql`: backfills
   `provenance = 'legacy_unknown'`, then changes the default to
   `self_reported`.
3. `20260802_03_score_result_insert_rpc.sql`
4. `20260924_01_submissions_original_inputs.sql`
5. `20260924_02_score_result_insert_originals.sql`
6. `20260924_03_submissions_score_authority.sql`
7. `20260924_04_submissions_group1_input_bounds.sql`
8. `20260928_01_submissions_canonical_endurance_fast_runners.sql`
9. `20260929_01_submissions_moderation.sql`
10. `20260929_02_submissions_revoke_public_writes.sql`
11. `20260929_04_leaderboard_placement_function.sql`
12. `20260929_05_ai_rl_hit_revoke_public_execute.sql`
    - Then **re-run the audit and keep that export.** It is the pre-`_06`
      state, which any `_06` undo must be compared against.
13. `20260929_06_public_role_privilege_cleanup.sql`: **new**

**Not yet:** `20260929_03`. That's step 12.

Then re-run the audit. Expect:
- `presence` all true;
- `effective_table` for anon and authenticated: SELECT only on `submissions`,
  nothing on the AI tables or `scoring_dataset_versions`, and `maintain=false`
  everywhere;
- `score_result_insert`, `leaderboard_placement`, `ai_rl_hit` and
  `ai_rate_limit_increment` executable by postgres and service_role only.

Then smoke-test the live (old) site: `/rankings` loads, and `/tool` scores with
`/api/rank`.

This exact sequence was applied cleanly to the disposable production replica
(see "Tested vs proposed").

**Step 6 results (2026-09-29, production `rgnwrlivldzqeaxhhvet`): all 13 migrations applied. `20260929_03` NOT applied. Dataset inspected only.**
- **Fresh backup:** `~/strendex-backups/strendex-prod-public-20260929T153254Z.dump`
  (SHA-256 `214115a3…d6a050f439`), taken read-only just before the migrations.
  - **Restore-tested:** into a temporary UTF-8 PostgreSQL 17 cluster, one
    transaction, stop on first error.
  - **Data:** all 3 tables identical (534 / 246 / 0 rows).
  - **Catalog:** identical (329 lines).
  - **Behaviour:** RLS, constraint, trigger and function checks pass.
  - **Production database:** UTF8, ICU `en_US.UTF-8`.
- **Migrations:**
  - **Runner:** `~/strendex-backups/tools/prod-step6-migrate.sh`. It checked the
    target before connecting, and refuses unless production is in the untouched
    pre-migration state, so it can never re-run over a half-migrated schema. A
    dry run on a local replica passed, and a re-run there correctly refused.
  - **Order:** `20260802_01`, `_02`, `_03`; `20260924_01`–`_04`;
    `20260928_01`; `20260929_01`, `_02`, `_04`, `_05`, `_06`. Each is one
    transaction, and every guard passed. `20260604` was skipped (`bw_range`
    was already 40–250).
  - **Audits:** in `~/strendex-backups/prod-step6-20260929T153426Z/`: before
    anything, **immediately before `_06`** (for any `_06` undo), and after.
    Per-migration logs are alongside.
- **Post-migration checks:**
  - **Audit:** every `presence` row true. All 30 CHECK constraints validated.
    Rounding proof 0 counterexamples. No trigger on `submissions` (the old one
    is detached). RLS on everywhere, forced on `scoring_dataset_versions`.
    `submissions_hide_non_public` policy present.
  - **Public roles:** anon and authenticated have **only SELECT on
    `submissions`**, kept for the live `/rankings` until `_03`. They have
    nothing on `scoring_dataset_versions`, `ai_rate_limits` or
    `ai_analysis_cache`, MAINTAIN included.
  - **Functions:** `score_result_insert`, `leaderboard_placement`, `ai_rl_hit`
    and `ai_rate_limit_increment` are executable by postgres and service_role
    only. `_06` changed 48 permission lines.
  - **Data unchanged:** 534 rows (519 approved, 15 pending at 90 or more), all
    backfilled `provenance = legacy_unknown`. No governed rows, and no dataset
    version.
  - **Live site (old app) on the migrated schema: 11/11.**
    - `/`, `/tool` and `/rankings` return 200.
    - The public key still reads the 519 approved rows.
    - The public key gets 401 on the dataset table and `ai_rate_limits`.
    - `POST /api/rank` returned 200 with its contract (`hq` 82, rank 28 of 520).
- **Dataset builder, inspect only** (`bootstrapLegacyDatasetVersion.ts`, no
  `--commit`):
  - **Counts:** 534 rows scanned. **519 eligible**, all `legacy_unknown`, with
    confidence `established`. **15 excluded: "not approved"** (the pending
    scores of 90 or more). 0 not legacy, 0 incomplete, 0 corrupt.
    519 + 15 = 534, so no row cap was hit.
  - **Candidate:** kind `legacy_mixed_provisional`, score version `2.0.0`,
    hash `1f408ac2f0ca1d2e7d7c7de393e33fe0b45e0c544e5cd0371009001649aaf63f`.
  - **Not created or activated.** 0 dataset versions exist.
- **Window now open:** production runs the old app on the migrated schema
  until step 10. Continue with steps 7–10 in the same session where possible.

### 7. Frozen dataset (owner authorises; runs against production)
This lifts the standing "don't run dataset scripts" rule for this one step.
The script reads `.env.local` (production). Do it right after step 6.
1. **Inspect only:**
   `npx tsx scripts/bootstrapLegacyDatasetVersion.ts --label "2026-10 provisional legacy"`.
   - **This is the eligible count.** It must be at least 30.
   - Check that eligible + excluded (not approved / not legacy / incomplete /
     corrupt) = the total rows read.
2. **Create the draft:** the same command with `--commit` and the
   `CONFIRM_LEGACY_MIXED_BOOTSTRAP` phrase.
3. **Activate exactly one** version, in one statement (drafts start unfrozen):
   `UPDATE public.scoring_dataset_versions SET frozen = true, lifecycle = 'active' WHERE id = '<draft id>' AND lifecycle = 'draft' AND frozen = false;`
   Then confirm exactly one active row for score version `2.0.0`.

This is built from production's rows, not the staging dataset (`8bd76e2f`), so
percentiles can differ slightly from staging.

**Step 7 results (2026-09-29, production `rgnwrlivldzqeaxhhvet`): dataset created, frozen and active.**
- **Active dataset:** **`f810f1f8-c2bb-483a-bbc6-77a5e3088ea0`**,
  "2026-10 provisional legacy".
  - kind `legacy_mixed_provisional`, score version `2.0.0`, confidence
    `established`;
  - **519** eligible rows, provenance `{"legacy_unknown": 519}`. Nothing was
    relabelled verified, observed or real.
  - **Hash:** `1f408ac2f0ca1d2e7d7c7de393e33fe0b45e0c544e5cd0371009001649aaf63f`.
  - Activated at 2026-09-29T15:38:42Z.
- **Inspect re-run first:** identical to step 6: 534 scanned, 519 eligible,
  15 excluded "not approved", 0 not legacy, incomplete or corrupt. Same full
  hash.
- **Draft:** created by `scripts/bootstrapLegacyDatasetVersion.ts --commit`
  with its confirmation phrase. It wrote only the draft; no submission was
  modified.
- **Activation:** one transaction (psql, stop on error). It first asserted the
  stored draft matched the reviewed candidate: ID, unfrozen draft, kind,
  score version, 519, provenance counts, exact hash, no other row and no active
  dataset. Then it ran the documented
  `UPDATE … SET frozen = true, lifecycle = 'active' WHERE id = … AND lifecycle = 'draft' AND frozen = false`
  (1 row) and asserted exactly one frozen active dataset for `2.0.0`.
- **Accepted by the new app's own code: 7/7** (`lib/server/scoreRepository.ts`
  and `lib/scoring/core` run against production, read-only):
  - `loadActiveDataset("2.0.0")` returns it. `verifiedDataset` recomputed and
    matched the hash, the reference arrays hold 519 values each, and kind,
    size and confidence match.
  - `loadDatasetVersion(id)`, the saved-result and Athlete Review path, accepts
    it.
  - `assertDatasetUsable` passes.
  - An in-memory `computeCanonicalScore` (82 kg, 110/150/190 kg, 5K 22:10) gave
    82, ELITE, STRENGTH BEAST, percentiles 98.8 / 65.7. Nothing was persisted.
- **Not done:** no submission rescored or linked (0 governed rows), no
  deployment, and `20260929_03` still NOT applied. The live old app ignores the
  dataset table.
- **Rollback note:** retiring this version is one-way. Restoring scoring would
  need a new draft.

### 8. Production Vercel settings (owner)
- **Required:** apply the step 1 decisions.
- **Recommended:** re-add the service-role, secret and OpenAI keys as
  Sensitive.
- **Optional:** delete the stale `launch-fixes/group-3-cutover-privacy`
  Preview overrides.
- **PostHog:** check the session replay settings.

These take effect for deployments built afterwards.

### 9. Commit, push and verify the preview (owner authorises the commit and push)
- **Commit** the Group 1–5 working tree, including the 12 staged entries.
  Never touch the 3 stashes.
- **Push** the branch for a `strendex-krk1` preview. Its Preview variables
  resolve to **production**.
- **Verify on laptop and mobile:**
  - `/`, `/tool` and `/rankings` (empty);
  - one **private** labelled score, `ZZ Launch check`, saved private with
    `leaderboard: null` against the new dataset.

### 10. Release (owner)
- Merge to `main`, which is the single production deployment.
- **Verify live on laptop and mobile:** `/`, `/tool`, `/rankings`, and
  `/api/rank` and `/api/submit` returning 410.

### 11. Optional: one production Athlete Review (owner authorises one paid call)
Step 5 proves the flow. **The reason to still run this:** production's key,
model setting, database and dataset differ from staging.
- **Expect:**
  - a 200 response;
  - the production dataset id in `meta`;
  - `review-cap:global` = 1.

### 12. Revoke public SELECT (owner, only after step 10 is confirmed)
`SET strendex.confirm_rankings_server_rendered = 'yes';`, then apply
`20260929_03`. Re-run the audit, and confirm `/rankings` still loads.

### 13. First moderation
Public results scoring 90 or more arrive as pending. Approve or reject them
with the Group 3 runbook SQL.

## Rollback

### Tested vs proposed

**Tested:**
- **Forward application:**
  - on staging: `20260924_01`–`_04`, `20260928_01` and `20260929_01`–`_05`;
  - on a **disposable Postgres 17 replica of production** (built from the
    audit export: schema, constraints, trigger, grants, default privileges):
    all 13 migrations in step 6 order, including `_06`.
- **`20260929_06`'s rollback variants,** on the replica:
  - **Variant A (planned order, after `_02` and `_05`)** restored the exact
    pre-`_06` ACL: 91 entries, compared line by line.
  - **Variant B (only if `_06` ran first)** restored the original audit ACL:
    100 entries.
- **Old writes on the migrated schema:** `main`'s `/api/submit` insert shapes
  succeeded after the full sequence, at database level.

- **Application level (step 4.2, staging):** the live app's `/api/rank` and
  `/api/submit` work end to end on the fully migrated schema, `_06` included.

**Not tested:**
- every other rollback block;
- Vercel Instant Rollback for this project;
- the old `/rankings` after an `_03` rollback (optional step 4.3).

| Rollback | Status | Notes |
|---|---|---|
| **App:** Vercel Instant Rollback to `dpl_4GwGZTU5A59yvuBjY9LvCJKf47HY`, or revert the merge | Proposed | Relies on `main` working on the migrated schema: tested at database level, app level in step 4. Rows written by `/api/score` stay. |
| `20260929_03`: re-grant public SELECT | Proposed; testable in step 4.3 | Required **before** an app rollback if step 12 is done. |
| `20260929_06`: variant A (planned order) | **Tested on the replica** | Re-grants only what `_06` removed after `_02` and `_05`. **Not an isolated undo:** first compare with the audit export taken immediately before `_06` (step 6) and re-grant only the entries that export has and the current audit lacks. Variant B restores the *original* production audit state; in the planned order it would re-introduce the TRUNCATE, REFERENCES and TRIGGER that `_02` removed, so never run it after `_02`. Nothing in either app needs these grants. |
| Dataset: retire the active version | Proposed | Not needed for an app rollback. **One-way**: restoring scoring needs a new draft. |
| `20260929_02`, `_04`, `_05` rollback blocks | Proposed | Re-grant or drop from the audit export. |
| `20260929_01` rollback block | Proposed | Restores the old `submissions_status_by_score` from the constraint comment. |
| `20260928_01`, `20260924_04` rollback blocks | Proposed; **may fail** | They restore narrower constraints. If `VALIDATE` fails because newer rows are outside the old bounds: run the block as **one transaction** so the failure rolls back and the current constraint stays, then **stop and assess** which rows and whether an app revert is the right fix. **Don't drop the constraint automatically.** This supersedes the "drop the constraint instead" comment in `20260924_04`, which is left unchanged because it's applied on staging. |
| `20260924_03` rollback block | Proposed | Reattaches the trigger and restores the float CHECK. Its exact old text is in the audit export (`submissions_hq_score_canonical_check`). |
| `20260924_02`: re-run `20260802_03` | Proposed | Before any `20260924_01` rollback. |
| `20260924_01` rollback block | Proposed | Constraint-only preferred; the full version destroys raw inputs. |
| `20260802_01`–`_03` | No rollback block | Additive. Leave in place. |
| Restore from backup (step 3) | Proposed; last resort | Discards every submission made since. |

## Step 3 detail: production backup (tools in `~/strendex-backups/tools`, outside the repo)

**Location.** Everything lives in `~/strendex-backups` (mode 700; not iCloud,
Dropbox or other synced storage), and every file is mode 600. The tools:
- `enter-credentials.py`: the one owner step. It prompts with **hidden input**
  for the Supabase **session** connection string (port 5432), and for the
  password if the string has the `[YOUR-PASSWORD]` placeholder.
  - It refuses anything that isn't `rgnwrlivldzqeaxhhvet`, and refuses the
    transaction pooler (port 6543).
  - It writes `.pg_service.conf` (no password) and `.pgpass`, both 0600.
  - Nothing appears on screen, in command arguments or in shell history.
- `backup.sh`: read-only.
  - **Before connecting:** checks the stored target is `rgnwrlivldzqeaxhhvet`
    on port 5432.
  - **On connecting:** refuses unless the session is read-only, PostgreSQL 17,
    and matches the audited fingerprint (dataset table absent, legacy trigger
    present, one `ai_rl_hit`).
  - **The dump:** records row counts, content hashes and a catalog snapshot,
    then runs `pg_dump` 17 on schema `public` (custom format, owners and
    privileges kept). It re-reads the hashes afterwards and writes a manifest
    with the SHA-256.
  - **Naming:** one exact name per run, `strendex-prod-public-<UTC timestamp>`,
    shared by every file of that backup.
- `restore-test.sh <name>`: restores that exact file into a temporary local
  PostgreSQL 17 cluster (socket only, deleted afterwards).
  - **External dependencies:** it reads them from the archive and recreates the
    Supabase roles locally.
  - **Strict restore:** `--single-transaction --exit-on-error`.
  - **Checks:** every table's row count and content hash, and the full catalog,
    against production. It also exercises RLS, a constraint, the trigger and
    service-role function access.
- **Self-test:** the whole pipeline passed against a local replica of
  production before first use.

**Limitations of a `public`-schema dump:**
- **Database-level objects** aren't included: the `rls_auto_enable` event
  trigger, roles and their passwords or attributes, extensions in other
  schemas, and publications.
- **Supabase-managed schemas** (`auth`, `storage` and so on) and project
  settings aren't included.
- **It fully covers what this rollout changes.** A restore into a fresh
  project would recreate the roles and the event trigger separately.
