-- =============================================================================
-- 20260928_01 — Let fast runners' canonical times be stored
--                                                        (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY
--   Group 2 makes the per-distance entered-time windows (RUN_DISTANCES in
--   lib/scoring/core/units.ts) the binding run-time limit. Their minimums sit
--   just under each world record, and convert to canonical half-marathon-
--   equivalent seconds as low as 3151 (3 mi in 11:00). Validation now bounds
--   the canonical value by SUBMISSION_CANONICAL_ENDURANCE_SECONDS = 3151–28800
--   (lib/scoring/core/constants.ts), which is exactly the converted span of
--   those windows.
--
--   submissions_canonical_endurance_range, added by 20260802_02, still floors
--   canonical_endurance_seconds at 4200. Without this file every athlete faster
--   than a 1:10:00 half equivalent — a 5K under 15:13, a 10K under 31:44, a
--   half under 1:10:00, a marathon under 2:25:56 — passes both the calculator
--   and the server validator and then FAILS THE INSERT (HTTP 500).
--
-- WHAT CHANGES
--   submissions_canonical_endurance_range:
--       canonical_endurance_seconds >= 4200  ->  >= 3151
--   The 28800 ceiling is unchanged. Strict widening: no stored row can become
--   invalid, and VALIDATE cannot fail.
--
-- WHAT DOES NOT CHANGE, AND WHY THAT IS SUFFICIENT
--   score_result_insert writes the SAME canonical value to two columns, so both
--   constraints were checked:
--     * endurance_seconds_range (endurance_seconds 2400–28800 after
--       20260924_04) already admits 3151. Left alone; section 0 aborts if it
--       is not in that state.
--     * submissions_original_run_seconds_range (0 < original_run_seconds <=
--       43200) already admits every entered time in every window, the largest
--       being the 43200 s marathon maximum. Left alone.
--   No other CHECK on the table references these columns and no trigger reads
--   them; section 0 PROVES that on the live database rather than assuming it.
--
--   Nothing is rescored. Formulas, tiers, SCORE_VERSION (2.0.0) and every
--   dataset are untouched. The dataset builder's eligibility bound is still
--   4200–28800 (VALIDATION_BOUNDS.canonicalEnduranceSeconds) and is enforced in
--   the application, not by this constraint, so no reference population
--   changes. A time below 4200 scores the same endurance index (100) as 4200.
--
-- KEEP IN STEP WITH THE APPLICATION
--   3151 mirrors SUBMISSION_CANONICAL_ENDURANCE_SECONDS.min exactly. If a run
--   window is ever widened again, this constraint needs another forward
--   migration; tests/runTimeBounds.test.ts pins the application side.
--
-- PREREQUISITES — section 0 ABORTS if any is unmet
--   * 20260802_02 (creates submissions_canonical_endurance_range) and
--     20260924_04 (widens endurance_seconds_range to 28800) are applied.
--   * Both constraints exist BY NAME with the expected DEFINITIONS.
--   * No other CHECK constraint or trigger touches the endurance columns.
--
-- APPLY ORDER
--   Apply BEFORE deploying the Group 2 application code. Old code never sends a
--   canonical value below 4200, so applying this first is safe; deploying the
--   code first makes fast runners' submissions fail to save until it is run.
--
-- DO NOT RUN until the owner has reviewed it. Staging first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions. Read-only; every failure is an EXCEPTION, not a warning.
-- -----------------------------------------------------------------------------

DO $pre$
DECLARE
  v_def   text;
  v_bad   bigint;
  v_names text;
BEGIN
  -- (a) The constraint this file widens: present, and still the 4200–28800
  --     definition from 20260802_02. A different definition means someone has
  --     already changed it; stop rather than overwrite an unknown bound.
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'submissions_canonical_endurance_range'
    AND conrelid = 'public.submissions'::regclass
    AND contype = 'c';

  IF v_def IS NULL THEN
    RAISE EXCEPTION
      'ABORT: CHECK submissions_canonical_endurance_range not found on public.submissions. Apply 20260802_02 first, or find the constraint''s real name — it may exist under another name and would keep rejecting fast runners after this migration.';
  END IF;

  IF v_def !~ 'canonical_endurance_seconds >= \(?4200[^0-9]'
     OR v_def !~ 'canonical_endurance_seconds <= \(?28800[^0-9]' THEN
    RAISE EXCEPTION
      'ABORT: submissions_canonical_endurance_range is not the expected "NULL or 4200..28800". Live definition: %. Review before proceeding.', v_def;
  END IF;

  -- (b) The sibling column receives the same value. Its floor (2400) is below
  --     3151, and its ceiling must already be 28800 (20260924_04).
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'endurance_seconds_range'
    AND conrelid = 'public.submissions'::regclass
    AND contype = 'c';

  IF v_def IS NULL THEN
    RAISE EXCEPTION
      'ABORT: CHECK endurance_seconds_range not found on public.submissions. Resolve its real name with migrations/inspect_submissions_check_constraints.sql first.';
  END IF;

  IF v_def !~ 'endurance_seconds >= \(?2400[^0-9]'
     OR v_def !~ 'endurance_seconds <= \(?28800[^0-9]' THEN
    RAISE EXCEPTION
      'ABORT: endurance_seconds_range is not the expected "NULL or 2400..28800" — apply 20260924_04 first. Live definition: %', v_def;
  END IF;

  -- (c) The entered-time column must admit every window, up to 43200 s.
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'submissions_original_run_seconds_range'
    AND conrelid = 'public.submissions'::regclass
    AND contype = 'c';

  IF v_def IS NULL OR v_def !~ 'original_run_seconds <= \(?43200[^0-9]' THEN
    RAISE EXCEPTION
      'ABORT: submissions_original_run_seconds_range is missing or not "0 < original_run_seconds <= 43200". Live definition: %', coalesce(v_def, '(none)');
  END IF;

  -- (d) No OTHER check constraint may bound these columns — otherwise the save
  --     would simply fail at a second constraint instead.
  SELECT string_agg(conname || ': ' || pg_get_constraintdef(oid), E'\n')
    INTO v_names
  FROM pg_constraint
  WHERE conrelid = 'public.submissions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ~ '(endurance_seconds|run_seconds)'
    AND conname NOT IN (
      'submissions_canonical_endurance_range',
      'endurance_seconds_range',
      'submissions_original_run_seconds_range'
    );

  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORT: unexpected CHECK constraint(s) reference the endurance columns and could still reject fast runners:%', E'\n' || v_names;
  END IF;

  -- (e) No trigger on the table may read or rewrite them either.
  SELECT string_agg(t.tgname, ', ')
    INTO v_names
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.submissions'::regclass
    AND NOT t.tgisinternal
    AND pg_get_functiondef(p.oid) ~ '(endurance_seconds|run_seconds)';

  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORT: trigger(s) % reference the endurance columns. Inspect them before widening this bound.', v_names;
  END IF;

  -- (f) Belt and braces: nothing stored falls outside the new range. Cannot
  --     happen under the current 4200 floor, but VALIDATE must not be the
  --     first thing to find out.
  SELECT count(*) INTO v_bad
  FROM public.submissions
  WHERE canonical_endurance_seconds IS NOT NULL
    AND (canonical_endurance_seconds < 3151 OR canonical_endurance_seconds > 28800);

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ABORT: % row(s) fall outside 3151..28800', v_bad;
  END IF;
END $pre$;

-- -----------------------------------------------------------------------------
-- 1. Widen the floor. Same NOT VALID + VALIDATE pattern as 20260802_02.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  DROP CONSTRAINT submissions_canonical_endurance_range;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_canonical_endurance_range
  CHECK (
    canonical_endurance_seconds IS NULL
    OR (
      canonical_endurance_seconds >= 3151
      AND canonical_endurance_seconds <= 28800
    )
  ) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_canonical_endurance_range;

COMMENT ON COLUMN public.submissions.canonical_endurance_seconds IS
  'Half-marathon-equivalent seconds (Riegel, exponent 1.06), server-computed from original_run_seconds and original_run_distance. Range 3151-28800 mirrors SUBMISSION_CANONICAL_ENDURANCE_SECONDS since 20260928_01. Dataset eligibility (4200-28800) is a separate, application-side bound.';

-- -----------------------------------------------------------------------------
-- 2. Postconditions. Prove the result rather than assume it.
-- -----------------------------------------------------------------------------

DO $post$
DECLARE
  v_def       text;
  v_validated boolean;
BEGIN
  SELECT pg_get_constraintdef(oid), convalidated INTO v_def, v_validated
  FROM pg_constraint
  WHERE conname = 'submissions_canonical_endurance_range'
    AND conrelid = 'public.submissions'::regclass;

  IF v_def IS NULL
     OR v_def !~ 'canonical_endurance_seconds >= \(?3151[^0-9]'
     OR v_def !~ 'canonical_endurance_seconds <= \(?28800[^0-9]'
     OR NOT v_validated THEN
    RAISE EXCEPTION
      'ABORT: postcondition failed — submissions_canonical_endurance_range is % (validated: %)', v_def, v_validated;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'endurance_seconds_range'
    AND conrelid = 'public.submissions'::regclass;

  IF v_def !~ 'endurance_seconds >= \(?2400[^0-9]'
     OR v_def !~ 'endurance_seconds <= \(?28800[^0-9]' THEN
    RAISE EXCEPTION
      'ABORT: postcondition failed — endurance_seconds_range changed unexpectedly: %', v_def;
  END IF;
END $post$;

COMMIT;

-- =============================================================================
-- 3. READ-ONLY CHECK — run after applying
-- =============================================================================
-- SELECT conname, convalidated, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.submissions'::regclass
--   AND contype = 'c'
--   AND pg_get_constraintdef(oid) ~ '(endurance_seconds|run_seconds)'
-- ORDER BY conname;
--
-- Expect exactly three rows:
--   endurance_seconds_range                 2400 .. 28800
--   submissions_canonical_endurance_range   3151 .. 28800, convalidated = true
--   submissions_original_run_seconds_range  0 < x <= 43200

-- =============================================================================
-- 4. ROLLBACK
-- =============================================================================
-- Restores the 4200 floor. It FAILS AT VALIDATE once any fast runner
-- (canonical < 4200) has been saved — which is correct: that data exists and
-- the old floor would reject it. In that case keep this migration, and revert
-- the application instead if fast runners must be refused again.
/*
BEGIN;
ALTER TABLE public.submissions DROP CONSTRAINT submissions_canonical_endurance_range;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_canonical_endurance_range CHECK (
    canonical_endurance_seconds IS NULL
    OR (canonical_endurance_seconds >= 4200 AND canonical_endurance_seconds <= 28800)
  ) NOT VALID;
ALTER TABLE public.submissions VALIDATE CONSTRAINT submissions_canonical_endurance_range;
COMMIT;
*/
