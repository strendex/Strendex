-- =============================================================================
-- 20260924_01 — Exact submitted inputs on public.submissions  (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY THIS IS A NEW FILE AND NOT AN EDIT TO 20260802_02
--   20260802_02 may already have been applied (staging). Editing an applied
--   migration in place makes the repository disagree with a live database and
--   gives no way to tell which version ran. Every correction from here on is a
--   forward migration.
--
-- WHAT IT DOES
--   1. Adds the four original_* weight columns.
--   2. Replaces submissions_governed_row_complete so a governed row must carry
--      them (the 20260802_02 version predates these columns, and its DO-block
--      guard is `IF NOT EXISTS`, so re-running that file would NOT update it —
--      the constraint has to be dropped and re-added explicitly).
--
-- SCHEMA ASSUMPTIONS (verify with section 0 before running)
--   * public.submissions exists.
--   * 20260802_02 has been applied: columns original_unit_system,
--     original_run_distance, original_run_seconds, dataset_version_id,
--     score_version, calculated_at, visibility, idempotency_key,
--     request_fingerprint, dataset_kind, dataset_label all exist, and
--     constraint submissions_governed_row_complete exists.
--   * No governed rows exist yet (dataset_version_id IS NOT NULL returns 0).
--     Section 0 asserts this; if it fails, STOP — the new NOT NULL requirement
--     would be unsatisfiable for rows already written without the originals.
--
-- LEGACY WRITE COMPATIBILITY
--   The four columns are nullable with no default, and every new CHECK is
--   NULL-tolerant. The deprecated POST /api/submit writes none of them and
--   leaves dataset_version_id NULL, so it stays exempt from
--   submissions_governed_row_complete and keeps working unchanged.
--
-- ROLLBACK
--   See section 4. Dropping the columns is destructive to audit data once
--   governed rows exist; prefer the constraint-only rollback.
--
-- DO NOT RUN until docs/group-1-runbook.md has been followed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions. Fail loudly and roll back rather than half-apply.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.submissions') IS NULL THEN
    RAISE EXCEPTION 'public.submissions does not exist — apply the base schema first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions'
      AND column_name = 'original_unit_system'
  ) THEN
    RAISE EXCEPTION
      '20260802_02 has not been applied (original_unit_system missing) — apply it first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.submissions WHERE dataset_version_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'governed rows already exist; requiring original_* on them needs a backfill plan first';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. The columns.
--
--    Stored in original_unit_system, NOT kilograms: exactly the numbers the
--    athlete typed. The kg columns are server-derived and rounded to 2dp, and
--    request_fingerprint is a one-way hash, so without these the raw submission
--    is unrecoverable.
--
--    double precision is IEEE-754 binary64 — the same representation as a
--    JavaScript number — so a validated value round-trips exactly with no
--    application-side rounding, matching how the kg columns are cast in
--    20260802_03.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS original_bodyweight double precision,
  ADD COLUMN IF NOT EXISTS original_bench      double precision,
  ADD COLUMN IF NOT EXISTS original_squat      double precision,
  ADD COLUMN IF NOT EXISTS original_deadlift   double precision;

-- -----------------------------------------------------------------------------
-- 2. Range CHECKs.
--
--    The kilogram ranges in bw_range/bench_range/... deliberately do NOT apply
--    here: 198 is a valid lb bodyweight and an impossible kg one. The only
--    invariant assertable without knowing the unit system is "a positive, real
--    number". The finite ceiling is what enforces "real" — Postgres sorts
--    'NaN'::float8 and 'Infinity'::float8 above every other float, so an upper
--    bound is the check that excludes both. Range plausibility belongs to
--    VALIDATION_BOUNDS in the application, which knows the unit system.
--
--    ORIGINAL_WEIGHT_MAX in lib/server/scoreRepository.ts mirrors the 2000.
--
--    NOT VALID then VALIDATE, matching 20260802_02's pattern: NOT VALID only
--    skips the initial full-table scan, it is not a permanent exemption. The
--    VALIDATE is safe because every expression is NULL-tolerant and all
--    existing rows have NULL in these brand-new columns.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('submissions_original_bodyweight_positive',
       $chk$original_bodyweight IS NULL OR (original_bodyweight > 0 AND original_bodyweight <= 2000)$chk$),
      ('submissions_original_bench_positive',
       $chk$original_bench IS NULL OR (original_bench > 0 AND original_bench <= 2000)$chk$),
      ('submissions_original_squat_positive',
       $chk$original_squat IS NULL OR (original_squat > 0 AND original_squat <= 2000)$chk$),
      ('submissions_original_deadlift_positive',
       $chk$original_deadlift IS NULL OR (original_deadlift > 0 AND original_deadlift <= 2000)$chk$)
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
-- 3. Replace submissions_governed_row_complete.
--
--    A governed row whose raw inputs cannot be recovered is not auditable, and
--    four weights are meaningless without the unit system that gives them
--    scale, so all five are required together or not at all.
--
--    DROP then ADD, because 20260802_02's DO-block skips a constraint that
--    already exists and would silently leave the old definition in place.
--    Legacy rows (dataset_version_id IS NULL) remain exempt, so nothing
--    existing breaks and the deprecated POST /api/submit keeps working.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_governed_row_complete;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_governed_row_complete CHECK (
    dataset_version_id IS NULL OR (
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
    )
  ) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_governed_row_complete;

COMMENT ON COLUMN public.submissions.original_bodyweight IS
  'Bodyweight exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_bench IS
  'Bench exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_squat IS
  'Squat exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';
COMMENT ON COLUMN public.submissions.original_deadlift IS
  'Deadlift exactly as submitted, in original_unit_system — NOT kilograms. Never derived from the rounded kg column and never rounded on write. NULL only on legacy rows.';

COMMIT;

-- =============================================================================
-- 4. ROLLBACK
-- =============================================================================
-- Constraint-only (non-destructive, keeps the audit columns and their data):
/*
BEGIN;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_governed_row_complete;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_governed_row_complete CHECK (
    dataset_version_id IS NULL OR (
          score_version       IS NOT NULL
      AND calculated_at       IS NOT NULL
      AND visibility          IS NOT NULL
      AND idempotency_key     IS NOT NULL
      AND request_fingerprint IS NOT NULL
      AND dataset_kind        IS NOT NULL
      AND dataset_label       IS NOT NULL
    )
  ) NOT VALID;
ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_governed_row_complete;
COMMIT;
*/
--
-- Full (DESTROYS the only record of raw submitted inputs — only while no
-- governed row exists, and note 20260924_02's RPC replacement writes these
-- columns, so revert that function first or its INSERT will fail):
/*
BEGIN;
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_original_bodyweight_positive,
  DROP CONSTRAINT IF EXISTS submissions_original_bench_positive,
  DROP CONSTRAINT IF EXISTS submissions_original_squat_positive,
  DROP CONSTRAINT IF EXISTS submissions_original_deadlift_positive;
ALTER TABLE public.submissions
  DROP COLUMN IF EXISTS original_bodyweight,
  DROP COLUMN IF EXISTS original_bench,
  DROP COLUMN IF EXISTS original_squat,
  DROP COLUMN IF EXISTS original_deadlift;
COMMIT;
*/
