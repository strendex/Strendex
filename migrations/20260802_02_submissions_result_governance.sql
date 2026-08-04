-- =============================================================================
-- 20260802_02 — Result governance fields on public.submissions
-- =============================================================================
--
-- ADDITIVE ONLY. Every statement is ADD COLUMN / CREATE INDEX / ADD CONSTRAINT,
-- plus the privilege hardening in section 6 (REVOKE of write privileges from the
-- public roles — a permission change, not a schema or data change).
-- Nothing is dropped, renamed, rewritten, backfilled or reclassified.
--
-- Schema facts this migration relies on are proven by the repository:
--   app/api/submit/route.ts inserts athlete_name, bodyweight, bench, squat,
--   deadlift, endurance_seconds, hq_score, rank, archetype, strength_index,
--   endurance_index, total_lift, strength_ratio, strength_percentile,
--   endurance_percentile, status; app/rankings/page.tsx selects id, created_at.
--   No assumption is made about the type of `id` or about existing constraints.
--
-- Legacy-row policy:
--   * `provenance` IS backfilled: ADD COLUMN ... DEFAULT 'legacy_unknown' writes
--     that value into every existing row. This is deliberate and is the only
--     data write in this file. Nothing already in the table is presented as
--     reviewed, verified, or real, and no pre-existing column is modified.
--   * every other new column is NULLable with no backfill, so no existing row
--     can violate a new rule.
--   * CHECK constraints are written as "col IS NULL OR ..." and added NOT VALID,
--     then VALIDATE'd in the same transaction. VALIDATE DOES scan the table —
--     it takes a SHARE UPDATE EXCLUSIVE lock, not an ACCESS EXCLUSIVE one, so
--     reads and writes continue, but on a large table it is not instant. The
--     two-step exists so a constraint violation surfaces as a clean failure
--     rather than an aborted ALTER.
--
-- COST: one table rewrite is NOT expected. `DEFAULT 'legacy_unknown'` is a
-- non-volatile constant, so Postgres 11+ stores it as a fast default without
-- rewriting existing rows.
--
-- DO NOT RUN THIS FILE against production until the runbook has been followed.
-- Requires 20260802_01_scoring_dataset_versions.sql to be applied first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PREFLIGHT — abort before touching anything if the visibility guard added in
--    section 5 would be inert.
--
--    A RESTRICTIVE policy has no effect unless RLS is enabled on the table. If
--    RLS is off, anon can read every row and every column regardless of what
--    policy we add, and applying the rest of this migration would create a
--    false sense of protection.
--
--    RLS is deliberately NOT enabled automatically: existing policies and the
--    /rankings query must be reviewed first, and enabling it blind could empty
--    the public leaderboard. See docs/group-2-migration-runbook.md.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.submissions'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION
      'ABORT: row level security is DISABLED on public.submissions. The visibility guard in this migration would be inert and private results would be publicly readable. Review the existing policies and the /rankings query, enable RLS deliberately, then re-run. Nothing has been changed.'
      USING ERRCODE = '0A000';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. New columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  -- Opaque, non-enumerable public handle for a result. App-generated.
  ADD COLUMN IF NOT EXISTS public_result_id text,

  -- Which scoring algorithm produced the stored numbers.
  ADD COLUMN IF NOT EXISTS score_version text,

  -- Which immutable reference population the percentiles were measured against.
  ADD COLUMN IF NOT EXISTS dataset_version_id uuid,

  ADD COLUMN IF NOT EXISTS calculated_at timestamptz,

  -- Client-supplied retry token. Unique, so a retry can never double-insert.
  ADD COLUMN IF NOT EXISTS idempotency_key text,

  -- Server-computed SHA-256 of the request INPUTS. Proves that a reused
  -- idempotency key describes the same submission; a mismatch is a conflict,
  -- not a retry.
  ADD COLUMN IF NOT EXISTS request_fingerprint text,

  -- private | unlisted | public. NULL = legacy row, unclassified.
  ADD COLUMN IF NOT EXISTS visibility text,

  -- Moderation (status) and verification are deliberately separate concerns.
  ADD COLUMN IF NOT EXISTS verification_status text,

  -- Original, pre-conversion inputs, so a score can always be re-derived.
  --
  -- The weights are stored in `original_unit_system`, NOT in kilograms: they are
  -- exactly the numbers the athlete typed. The kg columns (bodyweight, bench,
  -- squat, deadlift) are server-derived and rounded, so they cannot reconstruct
  -- these, and the request fingerprint is a one-way hash. Without these four
  -- columns the original submission is unrecoverable.
  --
  -- `double precision` is IEEE-754 binary64 — the same representation as a
  -- JavaScript number — so a validated value round-trips exactly, with no
  -- application-side rounding. This matches how the existing kg weight columns
  -- are cast in 20260802_03_score_result_insert_rpc.sql.
  ADD COLUMN IF NOT EXISTS original_unit_system text,
  ADD COLUMN IF NOT EXISTS original_run_distance text,
  ADD COLUMN IF NOT EXISTS original_run_seconds integer,
  ADD COLUMN IF NOT EXISTS original_bodyweight double precision,
  ADD COLUMN IF NOT EXISTS original_bench double precision,
  ADD COLUMN IF NOT EXISTS original_squat double precision,
  ADD COLUMN IF NOT EXISTS original_deadlift double precision,

  -- Server-computed canonical (half-marathon-equivalent) seconds.
  ADD COLUMN IF NOT EXISTS canonical_endurance_seconds integer,

  ADD COLUMN IF NOT EXISTS dataset_sample_size integer,
  ADD COLUMN IF NOT EXISTS dataset_confidence text,

  -- Denormalised dataset disclosure. Stored on the row so a replayed result
  -- always reports the dataset it was ACTUALLY scored against, even after a
  -- newer version has been activated.
  ADD COLUMN IF NOT EXISTS dataset_label text,
  ADD COLUMN IF NOT EXISTS dataset_kind text,

  -- `rank` already holds the tier string for the legacy leaderboard; `tier` is
  -- the explicit, typed field going forward. `archetype` already exists.
  ADD COLUMN IF NOT EXISTS tier text;

-- Existing rows become 'legacy_unknown' — never 'verified', 'reviewed' or real.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS provenance text DEFAULT 'legacy_unknown';

-- ...but rows written from here on are self-reported until a real verification
-- process says otherwise. (Applies to /api/submit, which does not set the
-- column; /api/score always sets it explicitly.)
ALTER TABLE public.submissions
  ALTER COLUMN provenance SET DEFAULT 'self_reported';

-- Deliberately NO default on `visibility`: legacy rows and legacy /api/submit
-- rows stay NULL and keep exactly today's leaderboard behaviour. /api/score
-- always writes an explicit value. Group 3 backfills and tightens this.

-- -----------------------------------------------------------------------------
-- 2. Referential integrity
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'submissions_dataset_version_fk'
      AND conrelid = 'public.submissions'::regclass
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_dataset_version_fk
      FOREIGN KEY (dataset_version_id)
      REFERENCES public.scoring_dataset_versions (id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_dataset_version_fk;

-- -----------------------------------------------------------------------------
-- 3. CHECK constraints — every one tolerates NULL, so legacy rows always pass.
--    Added NOT VALID first, then validated, so the ALTER never blocks on a scan
--    of live data and can never abort the migration on unexpected legacy values.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('submissions_visibility_valid',
       $chk$visibility IS NULL OR visibility IN ('private','unlisted','public')$chk$),
      ('submissions_provenance_valid',
       $chk$provenance IS NULL OR provenance IN ('legacy_unknown','simulated','self_reported','reviewed','verified')$chk$),
      ('submissions_verification_status_valid',
       $chk$verification_status IS NULL OR verification_status IN ('unverified','in_review','verified','rejected')$chk$),
      ('submissions_original_unit_system_valid',
       $chk$original_unit_system IS NULL OR original_unit_system IN ('lb','kg')$chk$),
      ('submissions_original_run_distance_valid',
       $chk$original_run_distance IS NULL OR original_run_distance IN ('3mi','5k','10k','half','marathon')$chk$),
      ('submissions_dataset_confidence_valid',
       $chk$dataset_confidence IS NULL OR dataset_confidence IN ('provisional','established','high')$chk$),
      ('submissions_dataset_kind_valid',
       $chk$dataset_kind IS NULL OR dataset_kind IN ('observed','legacy_mixed_provisional')$chk$),
      -- Lowercase hex SHA-256, exactly 64 characters (SHA256_HEX_PATTERN).
      ('submissions_request_fingerprint_format',
       $chk$request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$'$chk$),
      ('submissions_original_run_seconds_range',
       $chk$original_run_seconds IS NULL OR (original_run_seconds > 0 AND original_run_seconds <= 43200)$chk$),
      -- Original weights are stored in the athlete's OWN unit system, so the
      -- kilogram ranges in bw_range/bench_range/... deliberately do NOT apply
      -- here: 198 is a valid lb bodyweight and an impossible kg one. The only
      -- invariant these columns can assert unit-agnostically is "a positive,
      -- real number". The generous ceiling is what enforces the "real" half —
      -- Postgres sorts 'NaN'::float8 ABOVE every other float and 'Infinity'
      -- likewise, so a finite upper bound is the check that excludes both.
      -- Range plausibility belongs to VALIDATION_BOUNDS in the application,
      -- which is the layer that knows which unit system was used.
      ('submissions_original_bodyweight_positive',
       $chk$original_bodyweight IS NULL OR (original_bodyweight > 0 AND original_bodyweight <= 2000)$chk$),
      ('submissions_original_bench_positive',
       $chk$original_bench IS NULL OR (original_bench > 0 AND original_bench <= 2000)$chk$),
      ('submissions_original_squat_positive',
       $chk$original_squat IS NULL OR (original_squat > 0 AND original_squat <= 2000)$chk$),
      ('submissions_original_deadlift_positive',
       $chk$original_deadlift IS NULL OR (original_deadlift > 0 AND original_deadlift <= 2000)$chk$),
      ('submissions_canonical_endurance_range',
       $chk$canonical_endurance_seconds IS NULL OR (canonical_endurance_seconds >= 4200 AND canonical_endurance_seconds <= 28800)$chk$),
      ('submissions_dataset_sample_size_min',
       $chk$dataset_sample_size IS NULL OR dataset_sample_size >= 30$chk$),
      ('submissions_public_result_id_len',
       $chk$public_result_id IS NULL OR char_length(public_result_id) BETWEEN 16 AND 64$chk$),
      ('submissions_idempotency_key_len',
       $chk$idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 128$chk$),
      -- A governed row must carry its full provenance set together. Legacy rows
      -- (dataset_version_id IS NULL) are exempt, so nothing existing breaks.
      --
      -- The original_* group is part of that set: a governed row whose raw
      -- inputs cannot be recovered is not auditable, and the four weights are
      -- ambiguous without the unit system that gives them meaning, so all five
      -- are required together or not at all.
      ('submissions_governed_row_complete',
       $chk$dataset_version_id IS NULL OR (
              score_version        IS NOT NULL
          AND calculated_at        IS NOT NULL
          AND visibility           IS NOT NULL
          AND idempotency_key      IS NOT NULL
          AND request_fingerprint  IS NOT NULL
          AND dataset_kind         IS NOT NULL
          AND dataset_label        IS NOT NULL
          AND original_unit_system IS NOT NULL
          AND original_bodyweight  IS NOT NULL
          AND original_bench       IS NOT NULL
          AND original_squat       IS NOT NULL
          AND original_deadlift    IS NOT NULL
        )$chk$)
    ) AS t(name, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c.name AND conrelid = 'public.submissions'::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.submissions ADD CONSTRAINT %I CHECK (%s) NOT VALID',
        c.name, c.expr
      );
      EXECUTE format(
        'ALTER TABLE public.submissions VALIDATE CONSTRAINT %I', c.name
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Uniqueness and indexes
--    Postgres unique indexes treat NULLs as distinct, so legacy rows (all NULL)
--    never collide.
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS submissions_public_result_id_key
  ON public.submissions (public_result_id);

-- The idempotency guarantee behind POST /api/score.
CREATE UNIQUE INDEX IF NOT EXISTS submissions_idempotency_key_key
  ON public.submissions (idempotency_key);

-- Leaderboard placement query: eligible + approved + public, per dataset.
CREATE INDEX IF NOT EXISTS submissions_dataset_leaderboard_idx
  ON public.submissions (dataset_version_id, hq_score DESC)
  WHERE status = 'approved' AND visibility = 'public';

-- Dataset-builder eligibility scan.
CREATE INDEX IF NOT EXISTS submissions_provenance_status_idx
  ON public.submissions (provenance, status);

-- -----------------------------------------------------------------------------
-- 5. Do not expose private or unlisted rows to public clients.
--    This is a RESTRICTIVE policy: it is AND-ed with whatever permissive
--    policies already exist, so it can only narrow access, never widen it.
--    Existing rows (visibility IS NULL) keep exactly today's behaviour.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS submissions_hide_non_public ON public.submissions;

CREATE POLICY submissions_hide_non_public
  ON public.submissions
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (visibility IS NULL OR visibility = 'public');

-- -----------------------------------------------------------------------------
-- 6. Table privileges — public roles read, only the server writes.
--
--    RLS decides which ROWS a role may see. Grants decide which STATEMENTS a
--    role may issue at all, and the two are independent. The guard in section 5
--    is FOR SELECT only, so on its own it does nothing to stop a holder of the
--    anon/publishable key from INSERTing a forged result, UPDATEing its own row
--    to status = 'approved', or DELETEing somebody else's submission.
--
--    Nothing legitimate needs those privileges: every write in this application
--    already goes through a service_role server route (POST /api/score via
--    public.score_result_insert, and the deprecated POST /api/submit).
--
--    SELECT is deliberately NOT revoked. app/rankings/page.tsx reads the public
--    leaderboard with the publishable key, and section 5 is what narrows those
--    reads to rows that are allowed to be public.
--
--    Idempotent: REVOKE of an absent privilege and GRANT of a held one are both
--    no-ops, so re-running this file cannot fail on an environment where the
--    hardening was already applied by hand.
-- -----------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON TABLE public.submissions FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.submissions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.submissions FROM authenticated;

-- The server identity keeps everything the score routes need. GRANT to
-- service_role is additive and cannot widen anon or authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.submissions TO service_role;

COMMENT ON COLUMN public.submissions.provenance IS
  'legacy_unknown = predates governance; simulated = seeded; self_reported = athlete entered; reviewed/verified = a human process confirmed it. Never inferred.';
COMMENT ON COLUMN public.submissions.visibility IS
  'NULL = legacy, unclassified (behaves as today). Group 3 backfills these and tightens submissions_hide_non_public to visibility = ''public''.';
COMMENT ON COLUMN public.submissions.idempotency_key IS
  'Unique retry token. The uniqueness of this index is the idempotency guarantee for POST /api/score.';
COMMENT ON COLUMN public.submissions.request_fingerprint IS
  'SHA-256 of buildRequestFingerprintPayload() in lib/scoring/core/hashing.ts. Same key + same fingerprint = retry (returns the original row). Same key + different fingerprint = conflict (rejected, original never overwritten).';
COMMENT ON COLUMN public.submissions.original_bodyweight IS
  'Bodyweight exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_bench IS
  'Bench exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_squat IS
  'Squat exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_deadlift IS
  'Deadlift exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';

COMMIT;
