-- =============================================================================
-- 20260924_02 — score_result_insert persists and returns the exact inputs
--                                                        (FORWARD MIGRATION)
-- =============================================================================
--
-- Replaces the function created by 20260802_03 with CREATE OR REPLACE. That
-- file is left untouched because it may already have been applied; this is the
-- forward correction, and it is the only version that agrees with
-- lib/server/scoreRepository.ts on this branch.
--
-- WHAT CHANGES (three additions, nothing else — the idempotency contract, the
-- bounded retry loop, the security settings and every existing column are
-- byte-for-byte the text of 20260802_03):
--   1. INSERT writes original_bodyweight / _bench / _squat / _deadlift.
--   2. RETURN includes those four plus original_unit_system.
--   3. Nothing else. No UPDATE is introduced; the stored row is still never
--      overwritten.
--
-- WHY (2) IS REQUIRED, NOT COSMETIC
--   parsePersistedResult() in lib/server/scoreRepository.ts fails closed on a
--   missing field. Without these keys in the returned jsonb, every call to
--   POST /api/score raises RepositoryError and returns 500. So this migration
--   and 20260924_01 must both be applied BEFORE this branch is deployed.
--
-- SCHEMA ASSUMPTIONS
--   * 20260802_03 applied (the function exists with this signature).
--   * 20260924_01 applied (the four columns exist).
--
-- DEPENDENCY NOTE
--   CREATE OR REPLACE keeps the same OID, so existing GRANTs survive. The
--   REVOKE/GRANT block is repeated anyway because it is idempotent and makes
--   the privilege state explicit. DROP FUNCTION is never used — it would
--   require CASCADE and silently discard dependent privileges.
--
-- ROLLBACK
--   Re-run 20260802_03 verbatim. It is a CREATE OR REPLACE of the same
--   signature, so it restores the previous body exactly. Do that BEFORE any
--   rollback of 20260924_01, or the older body will insert into columns that
--   no longer exist.
--
-- DO NOT RUN until docs/group-1-runbook.md has been followed.
-- =============================================================================

BEGIN;

DO $pre$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions'
      AND column_name = 'original_bodyweight'
  ) THEN
    RAISE EXCEPTION 'apply 20260924_01_submissions_original_inputs.sql first';
  END IF;
END $pre$;

CREATE OR REPLACE FUNCTION public.score_result_insert(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key         text := p_payload->>'idempotency_key';
  v_fingerprint text := p_payload->>'request_fingerprint';
  v_row         public.submissions%ROWTYPE;
  v_attempt     integer := 0;
  v_replayed    boolean := false;
BEGIN
  IF v_key IS NULL OR char_length(v_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key is required' USING ERRCODE = '22023';
  END IF;

  IF v_fingerprint IS NULL OR v_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'request_fingerprint must be 64 lowercase hex characters'
      USING ERRCODE = '22023';
  END IF;

  -- Bounded loop: under READ COMMITTED a concurrent, not-yet-committed insert
  -- makes DO NOTHING skip AND the follow-up SELECT miss. Retry a few times
  -- rather than returning a false "not found".
  LOOP
    v_attempt := v_attempt + 1;

    INSERT INTO public.submissions (
      athlete_name,
      bodyweight,
      bench,
      squat,
      deadlift,
      endurance_seconds,
      total_lift,
      strength_ratio,
      strength_index,
      endurance_index,
      strength_percentile,
      endurance_percentile,
      hq_score,
      rank,
      tier,
      archetype,
      status,
      public_result_id,
      score_version,
      dataset_version_id,
      calculated_at,
      idempotency_key,
      visibility,
      provenance,
      verification_status,
      original_unit_system,
      original_run_distance,
      original_run_seconds,
      original_bodyweight,
      original_bench,
      original_squat,
      original_deadlift,
      canonical_endurance_seconds,
      dataset_sample_size,
      dataset_confidence,
      dataset_label,
      dataset_kind,
      request_fingerprint
    )
    VALUES (
      p_payload->>'athlete_name',
      (p_payload->>'bodyweight')::double precision,
      (p_payload->>'bench')::double precision,
      (p_payload->>'squat')::double precision,
      (p_payload->>'deadlift')::double precision,
      (p_payload->>'endurance_seconds')::integer,
      (p_payload->>'total_lift')::double precision,
      (p_payload->>'strength_ratio')::double precision,
      (p_payload->>'strength_index')::double precision,
      (p_payload->>'endurance_index')::double precision,
      (p_payload->>'strength_percentile')::double precision,
      (p_payload->>'endurance_percentile')::double precision,
      (p_payload->>'hq_score')::double precision,
      p_payload->>'tier',            -- legacy `rank` column holds the tier string
      p_payload->>'tier',
      p_payload->>'archetype',
      p_payload->>'status',
      p_payload->>'public_result_id',
      p_payload->>'score_version',
      (p_payload->>'dataset_version_id')::uuid,
      COALESCE((p_payload->>'calculated_at')::timestamptz, now()),
      v_key,
      p_payload->>'visibility',
      p_payload->>'provenance',
      p_payload->>'verification_status',
      p_payload->>'original_unit_system',
      p_payload->>'original_run_distance',
      (p_payload->>'original_run_seconds')::integer,
      -- Stored in original_unit_system, NOT converted. double precision is
      -- binary64, so the validated JavaScript number survives the round trip
      -- unchanged; no rounding happens on either side of this cast.
      (p_payload->>'original_bodyweight')::double precision,
      (p_payload->>'original_bench')::double precision,
      (p_payload->>'original_squat')::double precision,
      (p_payload->>'original_deadlift')::double precision,
      (p_payload->>'canonical_endurance_seconds')::integer,
      (p_payload->>'dataset_sample_size')::integer,
      p_payload->>'dataset_confidence',
      p_payload->>'dataset_label',
      p_payload->>'dataset_kind',
      v_fingerprint
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
      EXIT;
    END IF;

    -- The key already exists (or a concurrent insert has not committed yet).
    SELECT * INTO v_row
    FROM public.submissions
    WHERE idempotency_key = v_key;

    IF FOUND THEN
      -- A retry must describe the SAME submission. If it does not, the caller
      -- reused someone's key for different inputs: refuse, and leave the stored
      -- row exactly as it is. No UPDATE happens anywhere in this function.
      IF v_row.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION
          'STRENDEX_IDEMPOTENCY_CONFLICT: idempotency key reused with different request inputs'
          USING ERRCODE = 'P0409';
      END IF;

      v_replayed := true;
      EXIT;
    END IF;

    IF v_attempt >= 3 THEN
      RAISE EXCEPTION 'score_result_insert could not persist or locate the result'
        USING ERRCODE = 'P0002';
    END IF;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN jsonb_build_object(
    'replayed',                    v_replayed,
    'public_result_id',            v_row.public_result_id,
    'created_at',                  v_row.created_at,
    'calculated_at',               v_row.calculated_at,
    'athlete_name',                v_row.athlete_name,
    'hq_score',                    v_row.hq_score,
    'strength_index',              v_row.strength_index,
    'endurance_index',             v_row.endurance_index,
    'strength_percentile',         v_row.strength_percentile,
    'endurance_percentile',        v_row.endurance_percentile,
    'tier',                        v_row.tier,
    'archetype',                   v_row.archetype,
    'status',                      v_row.status,
    'visibility',                  v_row.visibility,
    'provenance',                  v_row.provenance,
    'verification_status',         v_row.verification_status,
    'score_version',               v_row.score_version,
    'dataset_version_id',          v_row.dataset_version_id,
    'dataset_sample_size',         v_row.dataset_sample_size,
    'dataset_confidence',          v_row.dataset_confidence,
    'dataset_label',               v_row.dataset_label,
    'dataset_kind',                v_row.dataset_kind,
    'canonical_endurance_seconds', v_row.canonical_endurance_seconds,
    -- Returned from the SAVED row so the caller verifies what Postgres actually
    -- stored rather than what it tried to write. On a replay these are the
    -- ORIGINAL row's values. parsePersistedResult reads them back; they
    -- deliberately never reach CanonicalResultView or a browser.
    'original_unit_system',        v_row.original_unit_system,
    'original_bodyweight',         v_row.original_bodyweight,
    'original_bench',              v_row.original_bench,
    'original_squat',              v_row.original_squat,
    'original_deadlift',           v_row.original_deadlift
  );
END;
$$;

REVOKE ALL ON FUNCTION public.score_result_insert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_result_insert(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_result_insert(jsonb) TO service_role;

COMMENT ON FUNCTION public.score_result_insert(jsonb) IS
  'Atomic, idempotent persistence of one canonical Strendex result. service_role only. Called by POST /api/score. Persists and returns the athlete''s exact pre-conversion inputs.';

COMMIT;
