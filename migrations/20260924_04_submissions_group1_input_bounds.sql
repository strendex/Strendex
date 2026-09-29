-- =============================================================================
-- 20260924_04 — Let the Group 1 path store the values it already accepts
--                                                        (FORWARD MIGRATION)
-- =============================================================================
--
-- SCOPE DISCIPLINE
--   This file contains ONLY the two widenings without which POST /api/score
--   cannot persist a value its own validator already accepted. It is not the
--   input-validation redesign. Both changes are strict widenings of an existing
--   CHECK, so no stored row can be invalidated and VALIDATE cannot fail.
--
-- ---------------------------------------------------------------------------
-- (a) bw_range: bodyweight >= 40  ->  >= 36
-- ---------------------------------------------------------------------------
--   VALIDATION_BOUNDS.bodyweightKg.min in lib/scoring/core/constants.ts is 36,
--   and the calculator's own floor is 80 lb = 36.29 kg. The live constraint
--   floor of 40 kg is 88.2 lb, so every athlete between 80 lb and 88.2 lb
--   passes client validation, passes server validation, and then FAILS THE
--   INSERT. Ceiling 250 is left alone — the application's 181 kg cap is the
--   binding limit and is well inside it.
--
-- ---------------------------------------------------------------------------
-- (b) endurance_seconds_range: <= 18000  ->  <= 28800
-- ---------------------------------------------------------------------------
--   This column receives CANONICAL half-marathon-equivalent seconds, not the
--   raw entered time (see score_result_insert: endurance_seconds is written from
--   canonical_endurance_seconds). VALIDATION_BOUNDS.canonicalEnduranceSeconds
--   allows up to 28800, and sibling constraint
--   submissions_canonical_endurance_range — added by 20260802_02 — already
--   permits 4200-28800 on canonical_endurance_seconds. So today the two columns
--   receive the SAME number under two different limits, and any canonical value
--   above 18000 fails. Concretely, these all pass both validators and then fail
--   to save:
--        3 mi slower than 1:02:51
--        5 K  slower than 1:05:13
--        10 K slower than 2:15:59
--        half slower than 5:00:01
--   The floor stays at 2400. It is BELOW the application minimum of 4200, so it
--   binds nothing — and raising it would invalidate stored legacy rows, whose
--   range starts at 2400. Widening only; never narrowing.
--
-- ---------------------------------------------------------------------------
-- OVERLAP WITH GROUP 2 — READ BEFORE PLANNING THAT WORK
-- ---------------------------------------------------------------------------
--   Group 2 is expected to land the per-distance validation redesign currently
--   held in stash@{1}, which DERIVES the canonical window from RUN_DISTANCES
--   instead of hardcoding it. That widens the accepted canonical range to
--   roughly 3151-51560 and bumps SCORE_VERSION to 2.1.0. When it lands:
--     * endurance_seconds_range and submissions_canonical_endurance_range BOTH
--       need widening again, in one migration, to the derived bounds;
--     * a scoring_dataset_versions row for score_version 2.1.0 must exist and
--       be active before deploy, or loadActiveDataset() returns null and every
--       request 503s.
--   None of that is in this file. This migration is deliberately the smaller,
--   compatible step, and it does not need revisiting if Group 2 slips.
--
--   Also still outstanding, and deliberately NOT here:
--     * submissions_status_by_score blocks rejecting any row with a non-null
--       score. Group 1 never needs 'rejected' (new rows are approved or
--       pending), so it is left untouched. Group 3 owns it.
--     * The calculator's own client-side bounds (80-400 lb) still disagree with
--       the server's kg bounds at the top end: 400 lb = 181.44 kg is refused by
--       the server's 181 kg cap. A UI-side concern, and Group 2's.
--
-- SCHEMA ASSUMPTIONS — section 0 ABORTS if any is unmet
--   * CHECK constraints bw_range and endurance_seconds_range exist BY NAME, and
--     their live DEFINITIONS still contain the 40 and 18000 bounds this file
--     widens. A matching name proves nothing about what is enforced, so both are
--     checked. If either differs, the transaction aborts and you must re-inspect
--     with migrations/inspect_submissions_check_constraints.sql.
--   * No stored row falls outside the widened ranges.
--
--   These are EXCEPTIONS, not warnings, and this file never drops a constraint
--   it did not expect to find.
--
-- DO NOT RUN until docs/group-1-runbook.md has been followed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions — assert the widening really is a widening.
--     Every currently stored row must satisfy the NEW predicate. If any does
--     not, the transaction aborts and nothing changes.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_bad bigint;
  v_def text;
BEGIN
  -- ABORT, not warn. This file DROPs each constraint by name and re-ADDs a wider
  -- one. If the live constraint sits under a different name, the DROP matches
  -- nothing, the wider constraint is added alongside the narrower original, and
  -- the NARROWER one still governs every write — so the migration would COMMIT
  -- reporting success while an 85 lb bodyweight and a 5 K over 1:05 continued to
  -- fail on insert, which is the exact bug this file exists to fix.
  --
  -- This migration will NOT hunt for and drop a differently named constraint: it
  -- cannot know that some other CHECK is the one meant. Inspect instead.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bw_range'
      AND conrelid = 'public.submissions'::regclass
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION
      'ABORT: CHECK constraint bw_range not found on public.submissions. Do not assume the bodyweight bound is absent — it may exist under another name and would keep rejecting 36-40 kg after this migration. Run migrations/inspect_submissions_check_constraints.sql and resolve the real name first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'endurance_seconds_range'
      AND conrelid = 'public.submissions'::regclass
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION
      'ABORT: CHECK constraint endurance_seconds_range not found on public.submissions. It may exist under another name and would keep rejecting canonical times above 18000 after this migration. Run migrations/inspect_submissions_check_constraints.sql and resolve the real name first.';
  END IF;

  -- Names matched. Now check the DEFINITIONS, because a matching name proves
  -- nothing about what the constraint actually enforces. If either has already
  -- been widened (or was never what this file assumes), stop: re-running would
  -- be a no-op at best, and at worst would NARROW a bound somebody widened on
  -- purpose.
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'bw_range' AND conrelid = 'public.submissions'::regclass;

  IF v_def NOT LIKE '%40%' THEN
    RAISE EXCEPTION
      'ABORT: bw_range does not look like the expected "bodyweight >= 40 AND bodyweight <= 250". Live definition: %. Review before proceeding — this file assumes it is widening a 40 kg floor to 36.', v_def;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'endurance_seconds_range'
      AND conrelid = 'public.submissions'::regclass;

  IF v_def NOT LIKE '%18000%' THEN
    RAISE EXCEPTION
      'ABORT: endurance_seconds_range does not look like the expected NULL-or-2400-to-18000. Live definition: %. Review before proceeding — this file assumes it is widening an 18000 ceiling to 28800, and must not narrow an already-wider bound.', v_def;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.submissions
  WHERE bodyweight IS NOT NULL AND (bodyweight < 36 OR bodyweight > 250);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'aborting: % row(s) fall outside the new bodyweight range', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.submissions
  WHERE endurance_seconds IS NOT NULL
    AND (endurance_seconds < 2400 OR endurance_seconds > 28800);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'aborting: % row(s) fall outside the new endurance range', v_bad;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. (a) bodyweight floor 40 -> 36 kg. Ceiling unchanged.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS bw_range;

ALTER TABLE public.submissions
  ADD CONSTRAINT bw_range
  CHECK (bodyweight >= 36 AND bodyweight <= 250) NOT VALID;

ALTER TABLE public.submissions VALIDATE CONSTRAINT bw_range;

-- -----------------------------------------------------------------------------
-- 2. (b) canonical endurance ceiling 18000 -> 28800. Floor unchanged at 2400.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS endurance_seconds_range;

ALTER TABLE public.submissions
  ADD CONSTRAINT endurance_seconds_range
  CHECK (
    endurance_seconds IS NULL
    OR (endurance_seconds >= 2400 AND endurance_seconds <= 28800)
  ) NOT VALID;

ALTER TABLE public.submissions VALIDATE CONSTRAINT endurance_seconds_range;

COMMENT ON COLUMN public.submissions.endurance_seconds IS
  'CANONICAL half-marathon-equivalent seconds, not the raw entered time. Written from canonical_endurance_seconds by score_result_insert. Range widened to 4200-28800 territory by 20260924_04; the 2400 floor is legacy and below the application minimum.';

COMMIT;

-- =============================================================================
-- 3. ROLLBACK
--     Only safe while no row violates the narrower predicate. After Group 1 has
--     accepted a 36-40 kg athlete or a canonical time above 18000, these
--     re-adds WILL fail at VALIDATE — which is the correct outcome: the data
--     exists and the old limits were wrong. Drop the constraint instead of
--     forcing it back.
-- =============================================================================
/*
BEGIN;
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS bw_range;
ALTER TABLE public.submissions
  ADD CONSTRAINT bw_range CHECK (bodyweight >= 40 AND bodyweight <= 250) NOT VALID;
ALTER TABLE public.submissions VALIDATE CONSTRAINT bw_range;

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS endurance_seconds_range;
ALTER TABLE public.submissions
  ADD CONSTRAINT endurance_seconds_range CHECK (
    endurance_seconds IS NULL
    OR (endurance_seconds >= 2400 AND endurance_seconds <= 18000)
  ) NOT VALID;
ALTER TABLE public.submissions VALIDATE CONSTRAINT endurance_seconds_range;
COMMIT;
*/
