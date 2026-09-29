-- =============================================================================
-- 20260929_04 — Calculator placement from ONE snapshot     (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY
--   Placement needs two numbers about the eligible population: how many
--   results score strictly higher, and how many there are in total. Computing
--   them as two separate API requests reads the table at two different moments,
--   so a concurrent insert, moderation or visibility change between them can
--   pair a `higher` from one moment with a `total` from another. This function
--   computes both in ONE statement, so both come from the same snapshot.
--
-- WHAT
--   public.leaderboard_placement(dataset uuid, score_version text, score numeric)
--     -> jsonb {"higher": <int>, "total": <int>}
--   rank = higher + 1, total = total (lib/leaderboard.ts placementFromCounts).
--
--   The WHERE clause is the leaderboard eligibility rule, identical to
--   isLeaderboardEligible / scopedToLeaderboard in the application:
--     dataset_version_id = the active dataset, score_version = the current one,
--     status = 'approved', visibility = 'public', hq_score IS NOT NULL.
--   tests/group3Leaderboard.test.ts pins the two definitions together.
--
--   LANGUAGE sql, STABLE, SECURITY INVOKER (no elevated rights), fixed
--   search_path. Only aggregate counts leave the function — no row data.
--
-- PERMISSIONS
--   Staging's default privileges grant EXECUTE on every NEW function in
--   `public` to anon and authenticated (audit 2026-09-29, section 7). So
--   revoking from PUBLIC alone is not enough: this file revokes from PUBLIC,
--   anon and authenticated explicitly, grants service_role, and asserts the
--   EFFECTIVE result.
--
-- DEPLOYMENT
--   Apply BEFORE deploying the Group 3 build on that environment. Until it
--   exists, placement is recorded as unavailable (null) — the score itself is
--   unaffected — and placement is withheld in the UI regardless.
--
-- Read-only function. Changes no data. DO NOT RUN until reviewed; staging first.
-- =============================================================================

BEGIN;

DO $pre$
BEGIN
  IF to_regprocedure('public.leaderboard_placement(uuid, text, numeric)') IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORT: public.leaderboard_placement(uuid, text, numeric) already exists. Inspect it rather than replacing an unknown definition.';
  END IF;

  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions'
      AND column_name IN ('dataset_version_id', 'score_version', 'status', 'visibility', 'hq_score')
  ) <> 5 THEN
    RAISE EXCEPTION 'ABORT: submissions is missing a column the eligibility rule needs.';
  END IF;
END $pre$;

CREATE FUNCTION public.leaderboard_placement(
  p_dataset_version_id uuid,
  p_score_version text,
  p_score numeric
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'higher', count(*) FILTER (WHERE s.hq_score > p_score),
    'total',  count(*)
  )
  FROM public.submissions AS s
  WHERE s.dataset_version_id = p_dataset_version_id
    AND s.score_version = p_score_version
    AND s.status = 'approved'
    AND s.visibility = 'public'
    AND s.hq_score IS NOT NULL
$$;

COMMENT ON FUNCTION public.leaderboard_placement(uuid, text, numeric) IS
  'Calculator placement counts from one snapshot: {higher, total} over approved, public results of one dataset and score version. rank = higher + 1. Service role only.';

REVOKE ALL ON FUNCTION public.leaderboard_placement(uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_placement(uuid, text, numeric)
  TO service_role;

DO $post$
DECLARE
  v_fn regprocedure := 'public.leaderboard_placement(uuid, text, numeric)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE')
     OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: anon or authenticated can still execute leaderboard_placement';
  END IF;
  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: service_role cannot execute leaderboard_placement';
  END IF;
  IF (SELECT prosecdef OR provolatile <> 's' FROM pg_proc WHERE oid = v_fn) THEN
    RAISE EXCEPTION 'ABORT: leaderboard_placement must be SECURITY INVOKER and STABLE';
  END IF;
END $post$;

COMMIT;

-- =============================================================================
-- ROLLBACK — placement then reports unavailable (null) until re-created.
-- =============================================================================
/*
DROP FUNCTION public.leaderboard_placement(uuid, text, numeric);
*/
