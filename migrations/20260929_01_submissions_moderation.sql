-- =============================================================================
-- 20260929_01 — Deliberate, recorded moderation            (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY
--   The live CHECK submissions_status_by_score (not defined in this repository;
--   recorded in docs/group-1-runbook.md as ">= 90 requires pending; < 90 allows
--   approved or pending") makes moderation impossible:
--     * a score of 90 or higher can never be approved, and
--     * no scored row can ever be rejected.
--
-- WHAT CHANGES
--   1. Two nullable columns, no backfill:
--        moderated_at  timestamptz
--        moderated_by  text        (operator identifier, not an email)
--      submissions_moderation_record_complete: both set, or both NULL, and a
--      set operator identifier is not blank (1-100 characters after trimming).
--   2. submissions_status_by_score is replaced. A row may be:
--        * pending                                   (any score);
--        * approved with a score below 90, or none   (the initial server rule);
--        * approved or rejected WITH a complete moderation record.
--      So the initial rule is unchanged — the server still saves >= 90 as
--      pending and < 90 as approved — and only a deliberate, recorded SQL
--      update can approve a high score or reject anything.
--
-- WHY PUBLIC CALLERS CANNOT USE THIS
--   * score_result_insert (the only write path for POST /api/score) names its
--     columns explicitly and never writes moderated_at / moderated_by; status
--     comes from the server's own threshold. It is executable by service_role
--     only.
--   * 20260929_02 revokes every write privilege on submissions from PUBLIC,
--     anon and authenticated, so no public key can UPDATE status or these
--     columns directly. Apply it with this file.
--
-- EXISTING ROWS
--   Nothing is rescored, relabelled, backfilled or deleted. Every row that
--   satisfies the old rule satisfies the new one (it is a strict widening);
--   section 0 counts violations anyway and aborts on any.
--
-- THRESHOLD
--   90 = REVIEW_THRESHOLD in lib/scoring/core/constants.ts. Keep in step.
--
-- DO NOT RUN until reviewed. Staging first. Safe to apply before the Group 3
-- deploy: the currently deployed app never writes these columns or 'rejected'.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions. Every failure is an EXCEPTION.
-- -----------------------------------------------------------------------------

DO $pre$
DECLARE
  v_def text;
  v_bad bigint;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'submissions_status_by_score'
    AND conrelid = 'public.submissions'::regclass
    AND contype = 'c';

  IF v_def IS NULL THEN
    RAISE EXCEPTION
      'ABORT: CHECK submissions_status_by_score not found on public.submissions. It may exist under another name and would keep blocking moderation. Inspect with migrations/verify/20260929_verify_submissions_permissions.sql.';
  END IF;

  -- The rule this file replaces must still be the score-coupled one.
  IF v_def !~ 'hq_score' OR v_def !~ '90' OR v_def !~ 'pending' THEN
    RAISE EXCEPTION
      'ABORT: submissions_status_by_score is not the expected ">= 90 requires pending" rule. Live definition: %', v_def;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions'
      AND column_name IN ('moderated_at', 'moderated_by')
  ) THEN
    RAISE EXCEPTION
      'ABORT: moderated_at or moderated_by already exists. Inspect it rather than adopting an unknown column.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'ABORT: submissions.status not found.';
  END IF;

  -- Every stored row must already satisfy the NEW rule, evaluated as if no row
  -- had a moderation record (none can, the columns are new).
  SELECT count(*) INTO v_bad
  FROM public.submissions
  WHERE hq_score IS NOT NULL
    AND NOT (
      status = 'pending'
      OR (status = 'approved' AND hq_score < 90)
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ABORT: % scored row(s) would violate the new status rule without a moderation record.', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.submissions
  WHERE hq_score IS NULL AND status NOT IN ('pending', 'approved');
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'ABORT: % unscored row(s) are neither pending nor approved.', v_bad;
  END IF;
END $pre$;

-- -----------------------------------------------------------------------------
-- 1. Moderation record columns. NULL on every existing row; no backfill.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  ADD COLUMN moderated_at timestamptz,
  ADD COLUMN moderated_by text;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_moderation_record_complete CHECK (
    (moderated_at IS NULL AND moderated_by IS NULL)
    OR (
      moderated_at IS NOT NULL
      AND moderated_by IS NOT NULL
      AND char_length(btrim(moderated_by)) BETWEEN 1 AND 100
    )
  ) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_moderation_record_complete;

-- -----------------------------------------------------------------------------
-- 2. Replace the status rule. The previous definition is kept in a comment on
--    the new constraint so the rollback can restore it exactly.
-- -----------------------------------------------------------------------------

DO $replace$
DECLARE
  v_old text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_old
  FROM pg_constraint
  WHERE conname = 'submissions_status_by_score'
    AND conrelid = 'public.submissions'::regclass;

  ALTER TABLE public.submissions DROP CONSTRAINT submissions_status_by_score;

  ALTER TABLE public.submissions
    ADD CONSTRAINT submissions_status_by_score CHECK (
      status = 'pending'
      OR (status = 'approved' AND (hq_score IS NULL OR hq_score < 90))
      OR (
        status IN ('approved', 'rejected')
        AND moderated_at IS NOT NULL
        AND moderated_by IS NOT NULL
        AND char_length(btrim(moderated_by)) >= 1
      )
    ) NOT VALID;

  ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_status_by_score;

  EXECUTE format(
    'COMMENT ON CONSTRAINT submissions_status_by_score ON public.submissions IS %L',
    'Since 20260929_01: approving a score >= 90, or rejecting any row, requires moderated_at and moderated_by. Previous definition: '
      || v_old
  );
END $replace$;

COMMENT ON COLUMN public.submissions.moderated_at IS
  'When an operator deliberately approved or rejected this row by SQL. NULL = never moderated (initial server status). Never written by the app.';
COMMENT ON COLUMN public.submissions.moderated_by IS
  'Non-blank operator identifier for the moderation (not an email). Set together with moderated_at. Never written by the app.';

-- -----------------------------------------------------------------------------
-- 3. Postconditions.
-- -----------------------------------------------------------------------------

DO $post$
DECLARE
  v_def text;
  v_ok  boolean;
BEGIN
  SELECT pg_get_constraintdef(oid), convalidated INTO v_def, v_ok
  FROM pg_constraint
  WHERE conname = 'submissions_status_by_score'
    AND conrelid = 'public.submissions'::regclass;
  IF v_def IS NULL OR NOT v_ok OR v_def !~ 'moderated_at' THEN
    RAISE EXCEPTION 'ABORT: postcondition failed for submissions_status_by_score: %', v_def;
  END IF;

  SELECT convalidated INTO v_ok
  FROM pg_constraint
  WHERE conname = 'submissions_moderation_record_complete'
    AND conrelid = 'public.submissions'::regclass;
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ABORT: submissions_moderation_record_complete missing or not validated';
  END IF;
END $post$;

COMMIT;

-- =============================================================================
-- 4. ROLLBACK
-- =============================================================================
-- Restores the previous status rule from the comment written in section 2.
-- It FAILS AT VALIDATE once any high score has been approved or any row
-- rejected — correct: those decisions exist. Dropping the columns destroys the
-- moderation record; do that only if no row has been moderated.
/*
BEGIN;
DO $rb$
DECLARE
  v_comment text;
  v_old     text;
BEGIN
  SELECT obj_description(oid, 'pg_constraint') INTO v_comment
  FROM pg_constraint
  WHERE conname = 'submissions_status_by_score'
    AND conrelid = 'public.submissions'::regclass;
  v_old := substring(v_comment FROM 'Previous definition: (.*)$');
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'previous definition not recorded; restore by hand';
  END IF;
  ALTER TABLE public.submissions DROP CONSTRAINT submissions_status_by_score;
  EXECUTE format(
    'ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_by_score %s NOT VALID',
    v_old
  );
  ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_status_by_score;
END $rb$;
ALTER TABLE public.submissions DROP CONSTRAINT submissions_moderation_record_complete;
ALTER TABLE public.submissions DROP COLUMN moderated_by, DROP COLUMN moderated_at;
COMMIT;
*/
