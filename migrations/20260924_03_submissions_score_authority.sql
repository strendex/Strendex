-- =============================================================================
-- 20260924_03 — The server owns the Hybrid Score   (FORWARD MIGRATION)
-- =============================================================================
--
-- THE PROBLEM
--   Two implementations currently compute the Hybrid Score, and they disagree.
--
--   1. The server:  Math.round(0.5 * sp + 0.5 * ep)
--      canonicalScoreFromPercentiles() in lib/scoring/core/formulas.ts.
--      Math.round breaks ties toward +Infinity, which for our non-negative
--      scores means upward.
--
--   2. The database: trigger trg_set_canonical_hq_score
--      (BEFORE INSERT OR UPDATE OF strength_percentile, endurance_percentile)
--      calls public.set_canonical_hq_score(), which OVERWRITES hq_score with
--        greatest(0, least(100, round(0.5 * strength_percentile
--                                  + 0.5 * endurance_percentile)))
--      Both percentile columns are double precision, so this is round(double
--      precision) — implemented with rint(), which is platform-dependent and on
--      the usual build breaks ties to EVEN.
--
--   CHECK submissions_hq_score_canonical_check repeats expression (2), so the
--   two cannot be changed independently: dropping the trigger alone leaves the
--   CHECK rejecting the server's value, and changing the CHECK alone leaves the
--   trigger overwriting it. This migration changes both, together.
--
--   Ties-to-even only diverges from ties-up when the value below the tie is
--   EVEN. Over the supported domain that is 25,050 of 1,002,001 percentile
--   pairs (2.50%), always by exactly one point:
--     74.5 -> server 75, database 74   <-- DIVERGES (74 is even)
--     39.5 -> server 40, database 40       agree (39 is odd)
--     59.5 -> server 60, database 60       agree (59 is odd)
--     89.5 -> server 90, database 90       agree (89 is odd)
--   So of the five tier thresholds only 75 / ELITE is reachable by this bug
--   (511 pairs), and the >= 90 review threshold is NEVER affected — no
--   moderation outcome changes either way.
--
-- THE FIX
--   The server becomes the single authority (CLAUDE.md: all scoring lives in
--   lib/scoring). The database stops COMPUTING the score and only refuses to
--   store a governed result that is internally inconsistent.
--
--   1. Drop the TRIGGER ATTACHMENT only. public.set_canonical_hq_score() is
--      left in place, unused. DROP FUNCTION is deliberately NOT used: it would
--      need CASCADE and would silently discard dependent objects and grants.
--      Keeping the function also makes the rollback a one-line CREATE TRIGGER.
--   2. Replace submissions_hq_score_canonical_check with a numeric-path
--      equivalent, scoped to governed rows.
--
-- WHY THE NUMERIC PATH, AND WHY IT IS PROVABLY EQUIVALENT
--   round((strength_percentile::numeric + endurance_percentile::numeric) / 2)
--
--   Casting the COLUMNS (not the already-computed float blend) is the point.
--   Casting a float result to numeric would only re-encode whatever error the
--   float arithmetic already made. Casting each column first gives exact
--   decimal arithmetic from there on:
--     * float8 -> numeric in Postgres goes via the float's shortest
--       round-trip text form, so a stored 1-decimal value casts back to that
--       exact 1-decimal numeric;
--     * percentileMidrank() returns Number(p.toFixed(1)) clamped to [0,100], so
--       every percentile IS a 1-decimal value in that range;
--     * numeric addition and division by 2 are exact at <= 2 decimal places;
--     * round(numeric) breaks ties away from zero = upward for non-negatives,
--       matching Math.round on non-negative input.
--
--   This is asserted exhaustively over all 1,002,001 supported percentile
--   pairs in tests/scoreRounding.test.ts (JS side) and must also be confirmed
--   on real Postgres with migrations/verify/20260924_verify_score_rounding.sql
--   before this is trusted in staging. The JS test is not proof of Postgres
--   behaviour; the .sql file is the check that is.
--
-- SCOPED TO GOVERNED ROWS — AND WHY THAT IS NOT A LOOPHOLE
--   The predicate is `dataset_version_id IS NULL OR (...)`.
--     * Historical rows keep their stored hq_score EXACTLY as it is. Nine of
--       them differ by one point from the server's arithmetic; they are not
--       rescored, not relabelled and not deleted. An unscoped CHECK would abort
--       this migration on those nine rows at VALIDATE time.
--     * The deprecated POST /api/submit writes dataset_version_id NULL, so it
--       stays exempt and keeps working. That matters: it sends a JS-rounded
--       score, which the OLD CHECK would have rejected on the divergent 2.50%
--       once the trigger stopped normalising it. Scoping is what keeps the
--       legacy route alive during the staged transition.
--     * Every row POST /api/score writes is governed, so every new result is
--       covered.
--
-- BEHAVIOUR CHANGE TO RECORD (relevant to Group 3 moderation)
--   With the trigger gone, UPDATEing strength_percentile or endurance_percentile
--   no longer recomputes hq_score. Any moderation tooling that edits percentiles
--   must recompute the score itself, or go through the server. On a governed row
--   the new CHECK turns that mistake into a loud failure instead of a silent
--   inconsistency; on a legacy row it does not.
--
-- SCHEMA ASSUMPTIONS — section 0 ABORTS if any is unmet
--   * Trigger trg_set_canonical_hq_score exists on public.submissions.
--   * CHECK submissions_hq_score_canonical_check exists.
--   * No OTHER trigger on the table references hq_score.
--   * Columns hq_score, strength_percentile, endurance_percentile,
--     dataset_version_id, tier exist (the last two come from 20260802_02).
--
--   These are EXCEPTIONS, not warnings. An unexpected schema means this file
--   cannot know whether an object is absent or merely renamed, and the two have
--   opposite consequences — so it stops and requires inspection rather than
--   guessing, and it never searches out and removes a differently named object.
--
-- DO NOT RUN until docs/group-1-runbook.md has been followed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.submissions') IS NULL THEN
    RAISE EXCEPTION 'public.submissions does not exist';
  END IF;

  -- ABORT, not warn. A missing object here has two very different causes and
  -- this migration cannot tell them apart:
  --
  --   (a) it was already removed by hand  -> continuing is harmless;
  --   (b) it exists under a DIFFERENT NAME -> continuing is actively dangerous.
  --
  -- In case (b) the DROP statements below match nothing, the new CHECK is added
  -- anyway, and the file COMMITS reporting success — leaving the old trigger
  -- still rewriting hq_score with round(double precision) while the new CHECK
  -- demands the numeric ties-up value. Those disagree on 2.50% of percentile
  -- pairs, so roughly one governed INSERT in forty would then fail, silently and
  -- unpredictably, in production.
  --
  -- Guessing is not an option either: this migration will NOT search for and
  -- remove a differently named trigger or constraint, because it cannot know
  -- that some other object is the one it means. So it stops and asks a human.
  --
  -- If you land here: run migrations/inspect_submissions_check_constraints.sql,
  -- establish the real names AND the real definitions, and only then decide
  -- whether to rename the objects to match this file or to adapt this file. Do
  -- not comment these checks out.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_canonical_hq_score'
      AND tgrelid = 'public.submissions'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'ABORT: trigger trg_set_canonical_hq_score not found on public.submissions. Either it was already removed, or it exists under another name. Inspect the schema (migrations/inspect_submissions_check_constraints.sql plus a pg_trigger listing) before running this migration. If the trigger is genuinely already gone AND no other trigger writes hq_score, re-run with the guard adjusted deliberately — never by disabling it blindly.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'submissions_hq_score_canonical_check'
      AND conrelid = 'public.submissions'::regclass
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION
      'ABORT: CHECK constraint submissions_hq_score_canonical_check not found on public.submissions. It may exist under another name and would then conflict with submissions_hq_score_governed_consistent. Inspect the live constraint definitions before running this migration.';
  END IF;
END $$;

-- A second, independent guard: no OTHER trigger may be writing hq_score. The
-- name check above cannot see a differently named trigger, so this looks for any
-- non-internal trigger left on the table that fires on the percentile columns.
-- It lists what it found rather than removing anything.
DO $$
DECLARE
  v_names text;
BEGIN
  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_names
  FROM pg_trigger
  WHERE tgrelid = 'public.submissions'::regclass
    AND NOT tgisinternal
    AND tgname <> 'trg_set_canonical_hq_score'
    AND pg_get_triggerdef(oid) ILIKE '%hq_score%';

  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORT: another trigger still references hq_score on public.submissions (%). The server must be the only writer of that column. Inspect and resolve before running this migration; this file will not remove a trigger it did not expect.', v_names;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Stop the database rewriting the score.
--
--    The ATTACHMENT only. public.set_canonical_hq_score() survives, so this is
--    reversible with one CREATE TRIGGER and no function definition is lost.
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_set_canonical_hq_score ON public.submissions;

COMMENT ON FUNCTION public.set_canonical_hq_score() IS
  'DETACHED 20260924_03. No longer invoked by any trigger. The server (lib/scoring/core/formulas.ts canonicalScoreFromPercentiles) is the sole authority on hq_score. Retained only so the pre-Group-1 trigger can be restored during rollback; its round(double precision) tie-breaking does NOT match the application and it must not be reattached without also reverting submissions_hq_score_governed_consistent.';

-- -----------------------------------------------------------------------------
-- 2. Replace the conflicting CHECK, in this same transaction.
-- -----------------------------------------------------------------------------

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_hq_score_canonical_check;

-- Range guard for every row, old and new. Separate from the consistency check
-- below so a legacy row is still protected against an out-of-range score.
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_hq_score_range;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_hq_score_range
  CHECK (hq_score IS NULL OR (hq_score >= 0 AND hq_score <= 100)) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_hq_score_range;

-- Consistency of a GOVERNED result. Exact numeric arithmetic, ties upward,
-- matching canonicalScoreFromPercentiles() in lib/scoring/core/formulas.ts.
--
-- NULL percentiles are tolerated rather than coalesced to zero: the old trigger
-- coalesced, but the canonical pipeline rejects an incomplete benchmark long
-- before persistence (parseCanonicalBenchmark), so a governed row can never
-- have one. Coalescing here would invent a score for data that should not exist.
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_hq_score_governed_consistent;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_hq_score_governed_consistent CHECK (
    dataset_version_id IS NULL
    OR strength_percentile IS NULL
    OR endurance_percentile IS NULL
    OR hq_score IS NULL
    OR hq_score = round(
         (strength_percentile::numeric + endurance_percentile::numeric) / 2
       )
  ) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_hq_score_governed_consistent;

-- Tier must agree with the score it was derived from. This is the invariant the
-- trigger was breaking: it rewrote hq_score after the server had already chosen
-- a tier from the pre-rewrite value, which is how a saved 74 could be labelled
-- ELITE. Thresholds mirror getTier() in lib/scoring/core/formulas.ts — if those
-- bands ever change, this constraint changes in the same migration.
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_tier_matches_score;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_tier_matches_score CHECK (
    dataset_version_id IS NULL
    OR hq_score IS NULL
    OR tier IS NULL
    OR tier = CASE
                WHEN hq_score >= 90 THEN 'WORLD CLASS'
                WHEN hq_score >= 75 THEN 'ELITE'
                WHEN hq_score >= 60 THEN 'ADVANCED'
                WHEN hq_score >= 40 THEN 'INTERMEDIATE'
                ELSE 'NOVICE'
              END
  ) NOT VALID;

ALTER TABLE public.submissions
  VALIDATE CONSTRAINT submissions_tier_matches_score;

COMMENT ON COLUMN public.submissions.hq_score IS
  'Hybrid Score 0-100, computed ONLY by the server (canonicalScoreFromPercentiles). Since 20260924_03 the database never derives or rewrites this value; for governed rows submissions_hq_score_governed_consistent asserts it agrees with the stored percentiles. Legacy rows predate that rule and are preserved as-is.';

COMMIT;

-- =============================================================================
-- 3. ROLLBACK — restores the pre-Group-1 behaviour exactly.
--     Run this BEFORE redeploying a pre-Group-1 build only if that build's
--     /api/submit writes are being rejected; the legacy route is exempt from
--     every constraint added above, so normally no rollback is needed.
-- =============================================================================
/*
BEGIN;
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_tier_matches_score,
  DROP CONSTRAINT IF EXISTS submissions_hq_score_governed_consistent,
  DROP CONSTRAINT IF EXISTS submissions_hq_score_range;

-- The original float-path CHECK. CONFIRM THE EXACT LIVE TEXT with the query in
-- migrations/inspect_submissions_check_constraints.sql before relying on this.
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_hq_score_canonical_check CHECK (
    hq_score = greatest(0, least(100, round(
      0.5 * COALESCE(strength_percentile, 0) + 0.5 * COALESCE(endurance_percentile, 0)
    )))
  ) NOT VALID;

-- set_canonical_hq_score() was never dropped, so the trigger simply reattaches.
CREATE TRIGGER trg_set_canonical_hq_score
  BEFORE INSERT OR UPDATE OF strength_percentile, endurance_percentile
  ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_canonical_hq_score();
COMMIT;
*/
