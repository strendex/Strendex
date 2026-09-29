# Group 1 — Score consistency: ordered runbook

Branch: `launch/group-1-score-consistency`

**Executed on staging only** — see [Checkpoint](#checkpoint--2026-09-28). Nothing
has been run against production, and nothing has been committed or deployed.
This is the order to do it in.

Group 1 is **not ready for production promotion on its own** — see
[Temporary limitations](#temporary-limitations).

---

## Checkpoint — 2026-09-28

Staging project `rnifjhxnxopyrueakxpz` only. **Production is unchanged.**
Uncommitted working tree on this branch; no commit, push or deploy.

**Done on staging (by the owner)**
- All four `20260924_*` migrations applied; the five new/changed constraints
  present and validated.
- Rounding verification Query 2: 1,002,001 pairs, zero mismatches.
- Existing 9 governed rows pass completeness, score and tier checks.
- Active frozen dataset `8bd76e2f-4cfb-47f0-8407-e5b812a6709d`, score version
  2.0.0, 517 entries. `score_result_insert` executable by `service_role` only.

**`POST /api/score` integration run** (local `next dev` → staging, 40/40 checks)

| Test | Result |
|---|---|
| Valid complete submission | 201; response matches saved row (score, tier, percentiles, dataset + score version, original inputs) |
| Same key, same inputs | 200, `idempotentReplay: true`, same row, no duplicate |
| Same key, changed inputs | 409 `IDEMPOTENCY_CONFLICT`, original row unchanged |
| Invalid input (bodyweight 5) | 400 `OUT_OF_RANGE`, no row inserted |

Row created and kept: `ZZ Staging G1 lsxyrv`, key `sx-staging-g1-lsxyrv`,
result `res_snh49t27afhgczrn77se9n4v`, id `53ed8e76-5ea3-4952-9e3c-e685b093aa14`.
Net rows added: 1.

**Manual browser check, `localhost:3000/tool` (founder)**
- 195 lb, 275/365/425 lb, 5K 22:30 → 81 / ELITE, percentiles 99.7 / 61.7.
- Editing inputs keeps the previous result and chart with the stale-input
  notice; recalculating updates the result; Reset clears it.

**Still untested:** production target (step 1), preview deploy and mobile +
laptop verification (step 7), and every item in
[Staging checks still required](#staging-checks-still-required) not marked done.

---

## What Group 1 changes, in one paragraph

The calculator used to call `/api/rank` to get a score to display, then
`/api/submit` to save one. Each route ran its own live query of approved
submissions and its own calculation, so the number on screen and the number in
the database were computed from two different reference pools at two different
moments — and a database trigger then rewrote the saved score with slightly
different rounding. After Group 1 there is one request (`POST /api/score`), one
frozen reference population, one calculation, and the screen renders the saved
row. The database no longer computes a score at all.

---

## Order of operations

Steps 1–3 are read-only. Do not skip them: step 2 is the only thing that
establishes whether the rounding fix is correct **on your actual Postgres**.

### 1. Confirm which database you are looking at

Establish which Supabase project serves `www.strendex.fit`, and which of the two
Vercel projects (`strendex-krk1`, `strendex`) is production. Every step below
depends on this and it is still unconfirmed.

### 2. Inspect the live schema — READ ONLY, and check DEFINITIONS not just names

```
migrations/inspect_submissions_check_constraints.sql
```

Record the exact current **definition** of each of these, not merely whether the
name exists:

| Object | What this branch assumes |
|---|---|
| `bw_range` | `bodyweight >= 40 AND bodyweight <= 250` |
| `endurance_seconds_range` | NULL or `2400 .. 18000` |
| `submissions_hq_score_canonical_check` | the float blend/round/clamp expression |
| `submissions_status_by_score` | `>= 90` requires pending; `< 90` allows approved/pending |
| `submissions_status_check` | approved / pending / rejected |
| trigger `trg_set_canonical_hq_score` | `BEFORE INSERT OR UPDATE OF strength_percentile, endurance_percentile` |

Also list every trigger on the table, not just the expected one:

```sql
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.submissions'::regclass AND NOT tgisinternal
ORDER BY tgname;
```

**A matching name is not a satisfied prerequisite.** `20260924_04` widens
constraints it identifies by name, so a constraint that kept its name but changed
its bounds would be silently narrowed or left alone; it therefore checks the live
definition too and aborts on a mismatch. `20260924_03` aborts if the trigger or
CHECK is missing **or** if any other trigger touches `hq_score`.

Every one of these preconditions is now a **hard abort**, not a warning. That is
deliberate: a missing object could mean "already removed" (harmless) or "exists
under another name" (dangerous), and no migration can tell those apart. None of
them will hunt down and drop a differently named object. If one aborts, inspect
and resolve the schema by hand — do not comment the guard out.

### 3. Prove the rounding fix on real Postgres — READ ONLY

```
migrations/verify/20260924_verify_score_rounding.sql
```

Safe on any database, including production. Creates nothing, writes nothing.

Queries **1–4 need no governance columns** and can be run right now, before any
migration:

* **Query 1** shows what this server's `round(double precision)` does at a tie.
  Expect `74.5 → 74` and `39.5 → 40`, `59.5 → 60`, `89.5 → 90`.
* **Query 2 must return zero rows.** It compares the new constraint expression
  against the application's arithmetic for all 1,002,001 supported percentile
  pairs. Any row is a counter-example — **do not apply `20260924_03`.**
* **Query 3** counts the divergence actually present. Expect ~9 rows in 534.
* **Query 4** stored-score sanity: range, and scored rows missing a percentile.

**Query 5 requires `20260802_02`** — `dataset_version_id` and `tier` do not exist
before it. It is guarded, so it reports `NOT_APPLICABLE` instead of failing, and
**a missing column is never reported as a clean zero governed-row count.** Run it
after `20260802_02` and before `20260924_03` (every count must be 0), then again
after go-live as an ongoing audit.

`tests/scoreRounding.test.ts` proves the same equivalence in JavaScript, but that
is not proof of Postgres behaviour — `round(double precision)` is
platform-dependent. Query 2 is the proof.

### 4. Rehearse on staging

Resume the paused **Strendex Staging** project and confirm its schema matches
production first — by definition, per step 2. If it does not, the rehearsal
proves nothing.

### 5. Apply the migrations — COMPLETE dependency order

#### Case A — a database missing `20260802_01–03`

Believed to be production's state, still unconfirmed. Determine what is present
before choosing a path:

```sql
SELECT to_regclass('public.scoring_dataset_versions')            AS has_01,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='submissions'
                 AND column_name='original_unit_system')          AS has_02,
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public' AND p.proname='score_result_insert')
                                                                  AS has_03,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='submissions'
                 AND column_name='original_bodyweight')           AS has_2409_01;
```

Then, in order:

| Order | File | Condition | Why here |
|---|---|---|---|
| 1 | `20260604_submissions_kg_check_constraints.sql` | **only if** `bw_range` is still pound-era (`>= 80`) | It DROPs and re-ADDs `bw_range`. Running it *after* step 7 would silently revert the bodyweight floor from 36 back to 40. Evidence says the live range is already 40–250, i.e. applied — verify, then skip. |
| 2 | `20260802_01_scoring_dataset_versions.sql` | if `has_01` is null | Creates the frozen-dataset table and the one-active-per-version index |
| 3 | `20260802_02_submissions_result_governance.sql` | if `has_02` is false | Adds the governance columns, backfills `provenance = 'legacy_unknown'`, creates the `idempotency_key` unique index |
| 4 | `20260802_03_score_result_insert_rpc.sql` | if `has_03` is false | Creates the RPC |
| 5 | `20260924_01_submissions_original_inputs.sql` | always | ABORTS unless step 3 is done |
| 6 | `20260924_02_score_result_insert_originals.sql` | always | ABORTS unless step 5 is done |
| 7 | `20260924_03_submissions_score_authority.sql` | always | ABORTS on any unexpected trigger/CHECK |
| 8 | `20260924_04_submissions_group1_input_bounds.sql` | always | ABORTS if a definition differs or a row would fall outside |

Hard dependencies, stated plainly:

* **3 → 5.** `20260924_01` checks for `original_unit_system` and aborts without it.
* **5 → 6.** `20260924_02` checks for `original_bodyweight` and aborts without it.
* **4 → 6.** `20260924_02` is a `CREATE OR REPLACE` of the function step 4
  creates. Applying 6 without 4 would work but leaves the repository and database
  disagreeing about provenance. Apply 4 first.
* **5 and 6 BOTH before deploy.** `parsePersistedResult()` fails closed on a
  missing field, so without the `original_*` keys in the RPC's returned JSON,
  every `POST /api/score` returns HTTP 500.
* **3 before step 6 of this runbook (the bootstrap).** The bootstrap requires
  `provenance = 'legacy_unknown'`, which `20260802_02` is what backfills. Run it
  earlier and **zero rows are eligible**.
* **1 before 8**, if step 1 is needed at all. Never after.
* **8** is otherwise independent and may run at any point before deploy.

#### Case B — staging, where earlier versions may already exist

Re-running the `20260802` files is *mostly* safe but **not sufficient, and one of
them is actively harmful**:

* `20260802_01` — `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.
  Re-running is a no-op. Safe.
* `20260802_02` — `ADD COLUMN IF NOT EXISTS`, and its CHECKs are created inside a
  `DO` block guarded by `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`.
  Re-running **skips any constraint that already exists** and does **not** update
  a changed definition. This is exactly why `20260924_01` explicitly DROPs and
  re-ADDs `submissions_governed_row_complete` instead of relying on it.
* `20260802_03` — **DO NOT re-run over `20260924_02`.** It is a
  `CREATE OR REPLACE FUNCTION`, so re-running **restores the OLD function body**,
  which does not write or return the `original_*` columns. On a database that
  already has `20260924_02`, this regresses the RPC and every
  `POST /api/score` starts returning 500. Re-run it only as the deliberate,
  documented rollback for `20260924_02`.

**Never blindly re-run an older migration over a newer one.** Query the actual
state (the snippet above), apply only what is genuinely missing, then apply
`20260924_01 → 02 → 03 → 04` in order.

No file in this branch rewrites applied migration history. The two corrections
that would otherwise have required editing `20260802_02`/`_03` in place are
delivered as the new forward files `20260924_01` and `20260924_02`.

### 6. Create the bootstrap dataset — REVIEW BEFORE COMMITTING

**Requires `20260802_02` first** — see the dependency note above.

```bash
# Inspect only. Writes nothing.
npx tsx scripts/bootstrapLegacyDatasetVersion.ts --label "2026-09 provisional legacy"
```

**Read the summary before going further.** Existing rows are not automatically
the eligible reference population.

What the builder **actually** filters on, verified against
`scripts/bootstrapLegacyDatasetVersion.ts` and `scripts/lib/datasetDraft.ts`:

1. `status = 'approved'` — pending and rejected rows never enter a reference
   population.
2. `provenance = 'legacy_unknown'` — governed rows belong to the observed builder.
   This column is backfilled by `20260802_02`; before that migration **nothing
   qualifies**.
3. **Completeness** — `bodyweight`, `bench`, `squat`, `deadlift` and
   `endurance_seconds` must all be non-null.
4. **Index validity** — `strength_index` and `endurance_index` must parse as
   finite numbers within 0–100 inclusive. Exactly 0 and exactly 100 are valid and
   are kept.
5. **Endurance bounds** — `endurance_seconds` must fall inside
   `VALIDATION_BOUNDS.canonicalEnduranceSeconds` (4200–28800).

What it does **NOT** do, contrary to an earlier draft of this runbook:

* It does **not** apply `VALIDATION_BOUNDS.bodyweightKg` (36–181 kg). A row with a
  200 kg bodyweight is eligible if it is complete and its indexes and endurance
  seconds are in range. The claim that rows above 181 kg are excluded was wrong.
* It does not check the individual lift bounds either.

That is a description of current behaviour, not an endorsement of it. Tightening
the reference population's input validation belongs to **Group 2**, alongside the
per-distance redesign; it is deliberately not changed here, because changing
eligibility changes every percentile and would have to be coordinated with a new
dataset version.

So `519 approved` does **not** mean `519 eligible`. If fewer than 30 rows survive,
`computeCanonicalScore` raises `DATASET_INSUFFICIENT` and scoring returns 503 —
correct behaviour, and it means Group 1 cannot ship until the population is large
enough.

The dataset is recorded as `kind = 'legacy_mixed_provisional'`: these rows mix
seeded and real entries and nothing in the repository can tell them apart. That
label reaches athletes through `scoreExplanation()`. **Never infer provenance from
`data_source='real'`.**

```bash
# Create a DRAFT (still not active, still not scoring anything).
CONFIRM_LEGACY_MIXED_BOOTSTRAP="I understand this dataset mixes unknown real and simulated legacy data" \
  npx tsx scripts/bootstrapLegacyDatasetVersion.ts --label "2026-09 provisional legacy" --commit
```

Then activate **exactly one** version manually. The partial unique index
`scoring_dataset_versions_one_active` makes "one active per score version" a
database guarantee, so a second activation fails rather than silently competing.

Neither script runs during build, dev or deploy, and neither activates anything.

### 7. Deploy and verify

Deploy to a preview first. Verify on **mobile and laptop** per `CLAUDE.md`.

Keep `/api/rank` and `/api/submit` deployed. **Their presence is not by itself a
proven rollback path** — see [Rollback](#rollback).

---

## Temporary limitations

### Leaderboard placement is withheld from the calculator

Canonical placement counts only governed results sharing this dataset **and**
score version, approved and public. `/rankings` still lists every approved row,
including the 519 legacy ones. So the first athlete through the new path would
honestly be "#1 of 1" beside a public board showing hundreds.

Rather than print a number that contradicts the page one tap away, the calculator
withholds it. Specifically:

* The "You beat X% of athletes" tile and the "Leaderboard #N of M" tile are
  replaced by the **strength and endurance percentiles**, which are genuine —
  both come straight off the saved row and are measured against the frozen
  reference population, not the leaderboard.
* The share card's "Better than X%" badge is replaced by the archetype.
* The card footer falls back to "CAN YOU BEAT THIS?".
* `AthleteReviewCTA` receives `rank`, `totalAthletes` and `betterThanPercent` as
  `null`.

The server still computes placement; the UI simply does not claim it. One flag,
`LEADERBOARD_PLACEMENT_AVAILABLE` in `app/tool/page.tsx`, gates all of it.
**Group 3 flips it**, once `/rankings` and the canonical population are the same
set.

Hybrid Score, tier, archetype and both component percentiles are all shown
normally.

### Athlete Review: version consistency

The review now scores against the same frozen dataset, so its percentiles match
what `/api/score` would produce from identical inputs. Two gaps remain:

1. It computes from the **client-supplied benchmark snapshot**, not from a saved
   result row. If the athlete's result was scored against dataset version A and
   they open the review after version B is activated, the review's numbers will
   differ from their saved score. Nothing currently detects this.
2. It records no `score_version` or `dataset_version_id` on its output, so a
   review cannot be traced to the benchmark that produced it.

Both need a Group 2/3 decision: either the review reads the saved row by
`public_result_id`, or it discloses the dataset it used.

### Not in this group

* `SCORE_VERSION` stays at `2.0.0`. Group 2's run-time validation was done as
  a validation-only change without the `stash@{1}` version bump — see
  `docs/group-2-run-time-validation.md`. It needs migration `20260928_01`.
* **Required before launch — Group 3:** retire `/api/submit` and `/api/rank`.
  Both still accept incomplete benchmarks and trust values converted by the
  browser, and `/api/submit` saves them as `approved` (public leaderboard).
* The client's own bounds still disagree with the server at the top end: 400 lb
  is 181.44 kg and the server's cap is 181 kg. **Group 2.**
* `submissions_status_by_score` still blocks rejecting any row with a non-null
  score. Group 1 never needs `rejected`. **Group 3.**
* `CLAUDE.md` still says "All scoring lives in lib/scoring.ts. Both /api/submit
  and /api/rank import it." That is now stale — scoring lives in
  `lib/scoring/core`, and the canonical route is `/api/score`. Left unedited
  because it is your document of record; worth updating when you are ready.

---

## Effects on existing data and legacy writes

### Stored values

No migration rewrites, rescores, reclassifies or deletes a stored row. The nine
rows whose saved score differs by one point from the application's arithmetic are
left exactly as they are — they are legacy (`dataset_version_id IS NULL`) and
exempt from the new consistency checks. The 253 rows that would recalculate
differently against the current pool are untouched.

### This is a metadata change, not a no-op

Migration `20260924_01` **adds columns to every existing row** (as SQL NULLs).
Combined with `20260802_02`, historical rows now carry governance columns —
`provenance`, `visibility`, `verification_status` and the `original_*` set — that
they did not have before. Their *performance and score fields* are unchanged, but
the rows themselves are not byte-for-byte what they were, and any `provenance`
default of `legacy_unknown` is a **statement about what is unknown**, not a
finding. It does not make a row genuine, verified, or comparable with a governed
result.

### `NOT VALID` is not a compatibility guarantee

Worth being precise, because it is easy to over-read. `NOT VALID` skips the
initial full-table scan; it does **not** exempt future writes or updates. And
every constraint in `20260802_02` is added `NOT VALID` **and then immediately
`VALIDATE`d** in the same `DO` block — so those constraints are fully enforced
today, for legacy writers as well. The new migrations follow the same pattern for
the same reason, and they are safe to validate because:

* the `original_*` checks are NULL-tolerant and the columns are brand new;
* the `hq_score` and tier consistency checks are scoped to governed rows, of
  which there are zero;
* the two bound changes in `20260924_04` are strict **widenings**, and the file
  counts violating rows first and aborts rather than half-applying.

### `/api/submit` behaviour does change

Once the trigger is detached, `/api/submit` stores the score it computed in
JavaScript instead of having it silently rewritten by Postgres. For the ~2.5% of
percentile pairs where the two rules disagreed, its saved score will now be one
point higher — which is the score it already displayed. This makes the legacy
route *more* self-consistent, but it is a real change in what that endpoint
writes, and it is why `20260924_03` scopes the new CHECK to governed rows: an
unscoped check would reject those writes outright.

### Moderation is unaffected

The review threshold is 90, whose tie is 89.5. Because 89 is odd, ties-to-even
and ties-up both round it to 90. No submission changes moderation state as a
result of the rounding fix. Asserted in `tests/scoreRounding.test.ts`.

---

## Rollback

Each migration carries its own rollback block, commented out at the bottom of the
file. Notes:

* `20260924_02` rolls back by **re-running `20260802_03` verbatim** — it is a
  `CREATE OR REPLACE` of the same signature. Do that **before** rolling back
  `20260924_01`, or the older function body will insert into columns that no
  longer exist.
* `20260924_03` reattaches cleanly: `set_canonical_hq_score()` is never dropped,
  only detached. `DROP FUNCTION` is deliberately avoided — it would need
  `CASCADE` and would discard dependent privileges.
* `20260924_04` **cannot** be rolled back once a 36–40 kg athlete or a canonical
  time above 18000 has been accepted. The re-add will fail at `VALIDATE`. Run the
  rollback block as **one transaction**, so a failure rolls it back and leaves the
  current constraint in place. Then **stop and assess**: which rows, and whether
  reverting the application is the better fix. Do **not** drop the constraint
  automatically. (The migration file's own comment still says "drop the
  constraint instead". This note supersedes it; the file is left unchanged
  because it's already applied on staging.)
* `20260924_01`'s full rollback **destroys the only record of raw submitted
  inputs.** Prefer the constraint-only rollback.

**On the deploy side:** `/api/rank` and `/api/submit` are still deployed and
still functional, and nothing in the app calls them. That gives a previous build
somewhere to land — but it is not a tested rollback path, and it does not undo:

* rows already written by `POST /api/score` (a pre-Group-1 build has no UI for
  them, and they stay on the leaderboard if approved and public);
* the trigger detachment, if a pre-Group-1 build's writes depended on it.

Treat "the old routes still exist" as a starting point for a rollback plan, not
as the plan.

---

## Staging checks still required

Everything below is unproven by the local suite. Mocks and SQL-text assertions
are not evidence of Postgres behaviour. Items marked **DONE** were proven on
staging on 2026-09-28; everything else remains **untested**.

**Rounding and constraints**
1. **DONE.** Run `verify/20260924_verify_score_rounding.sql`. Query 2 returns zero rows.
2. Confirm `trg_set_canonical_hq_score` is gone from `pg_trigger` and
   `set_canonical_hq_score()` still exists in `pg_proc`.
3. Insert a governed row whose percentiles blend to exactly `74.5`. It must save
   as **75 / ELITE**, and reading it back must show 75.
4. Attempt a governed row with a deliberately wrong `hq_score`. It must be
   rejected by `submissions_hq_score_governed_consistent`.
5. Attempt a governed row whose `tier` disagrees with its score. It must be
   rejected by `submissions_tier_matches_score`.
6. `UPDATE` a percentile on a **legacy** row and confirm `hq_score` is no longer
   auto-recomputed. This is the Group 3 moderation hazard.

**Idempotency, for real, concurrently**
7. Two simultaneous `POST /api/score` calls with the same key and same inputs →
   exactly one row; one response has `idempotentReplay: true`.
   *Untested concurrently — only a sequential retry has been proven.*
8. **DONE.** Same key, different inputs → `409`, and the stored row is unchanged.
9. Kill the connection mid-request, then retry with the same key → one row.
10. Confirm the bounded retry loop in `score_result_insert` behaves under a real
    uncommitted concurrent insert (the `P0002` path is untested).

**Permissions**
11. With the anon/publishable key: `SELECT` on `submissions` works for approved
    public rows; `INSERT`/`UPDATE`/`DELETE` are refused.
12. With the anon key, `score_result_insert` is not executable.
13. `/rankings` still loads with the publishable key.

**Bounds**
14. An 85 lb bodyweight saves (was a hard insert failure).
15. A 5K of 1:10:00 saves (canonical ≈ 19,900 s — was a hard insert failure).
16. A 5K of 15:00 is still refused by the server's canonical floor. This is
    expected in Group 1 and is what Group 2 fixes. *With Group 2 in the
    working tree it is accepted; see `docs/group-2-run-time-validation.md`.*

**Old-route compatibility**
17. `POST /api/rank` and `POST /api/submit` still return their frozen contracts
    (`hq/…/rank/total` and `{ok:true}`) after all four migrations.
18. A legacy `/api/submit` write whose percentiles land on a divergent half now
    stores the JS value and is **not** rejected.

**Dataset**
19. With no active dataset, `/api/score` returns **503**, not a wrong score.
20. With an active dataset, tamper with one reference value and confirm the hash
    check turns it into a 503 rather than a silently different score.
21. The Athlete Review uses the same dataset: a review and a score from identical
    inputs report identical percentiles.
