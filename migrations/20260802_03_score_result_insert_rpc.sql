-- =============================================================================
-- 20260802_03 — Idempotent canonical result insertion (RPC)
-- =============================================================================
--
-- ADDITIVE ONLY. Creates one function. Nothing is dropped or rewritten.
--
-- Why an RPC: POST /api/score must "insert this result, or give me back the one
-- already stored under this idempotency key" as a single atomic database
-- operation. Two separate HTTP round trips (SELECT then INSERT) are NOT atomic
-- and would race under concurrent retries. INSERT ... ON CONFLICT DO NOTHING
-- plus a bounded re-read inside one function is.
--
-- Security: SECURITY DEFINER, pinned search_path, EXECUTE granted to
-- service_role only. Public clients (anon, authenticated) cannot call it.
-- It writes ONLY to public.submissions and performs no dynamic SQL.
--
-- Requires 20260802_02_submissions_result_governance.sql (for the unique index
-- on idempotency_key, which is the conflict arbiter).
--
-- DO NOT RUN THIS FILE against production until the runbook has been followed.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.score_result_insert(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key     text := p_payload->>'idempotency_key';
  v_row     public.submissions%ROWTYPE;
  v_attempt integer := 0;
BEGIN
  IF v_key IS NULL OR char_length(v_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key is required' USING ERRCODE = '22023';
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
      canonical_endurance_seconds,
      dataset_sample_size,
      dataset_confidence
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
      (p_payload->>'canonical_endurance_seconds')::integer,
      (p_payload->>'dataset_sample_size')::integer,
      p_payload->>'dataset_confidence'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
      EXIT;
    END IF;

    SELECT * INTO v_row
    FROM public.submissions
    WHERE idempotency_key = v_key;

    IF FOUND THEN
      EXIT;
    END IF;

    IF v_attempt >= 3 THEN
      RAISE EXCEPTION 'score_result_insert could not persist or locate the result'
        USING ERRCODE = 'P0002';
    END IF;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN jsonb_build_object(
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
    'canonical_endurance_seconds', v_row.canonical_endurance_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.score_result_insert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_result_insert(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_result_insert(jsonb) TO service_role;

COMMENT ON FUNCTION public.score_result_insert(jsonb) IS
  'Atomic, idempotent persistence of one canonical Strendex result. service_role only. Called by POST /api/score.';

COMMIT;
