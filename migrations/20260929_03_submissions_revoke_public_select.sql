-- =============================================================================
-- 20260929_03 — No public reads of submissions             (FORWARD MIGRATION)
-- =============================================================================
--
-- !! DEPLOYMENT ORDER — READ FIRST !!
--   The CURRENTLY DEPLOYED production /rankings reads submissions in the
--   browser with the public key. Running this before the Group 3 build (server-
--   rendered /rankings) is live on that environment EMPTIES THE PRODUCTION
--   LEADERBOARD. The guard below refuses to run unless you confirm, in the same
--   session, that the server-rendered /rankings is already deployed there:
--
--       SET strendex.confirm_rankings_server_rendered = 'yes';
--
-- WHY
--   A read-only probe of staging (2026-09-29) showed the public key can read,
--   on every public and legacy row, columns the leaderboard never needs:
--   original_bodyweight / bench / squat / deadlift, idempotency_key and
--   request_fingerprint. After Group 3 nothing in the browser reads this table:
--   /rankings reads it server-side with the service role and returns only
--   name, score, tier, archetype, date and rank.
--
-- WHAT CHANGES
--   REVOKE SELECT on public.submissions from PUBLIC, anon and authenticated.
--   Column-level SELECT grants are revoked with it. RLS policies are left in
--   place (inert without the privilege). service_role is not touched.
--
-- VERIFY with migrations/verify/20260929_verify_submissions_permissions.sql.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF coalesce(current_setting('strendex.confirm_rankings_server_rendered', true), '') <> 'yes' THEN
    RAISE EXCEPTION
      'ABORT: confirm the server-rendered /rankings is deployed on this environment first: SET strendex.confirm_rankings_server_rendered = ''yes''; Nothing has been changed.';
  END IF;
END $guard$;

REVOKE SELECT ON TABLE public.submissions FROM PUBLIC, anon, authenticated;

DO $post$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY['anon', 'authenticated']) AS role LOOP
    IF has_table_privilege(r.role, 'public.submissions', 'SELECT') THEN
      RAISE EXCEPTION
        'ABORT: % still has SELECT on public.submissions (inherited through another role?)', r.role;
    END IF;
  END LOOP;

  FOR r IN
    SELECT role, a.attname
    FROM unnest(ARRAY['anon', 'authenticated']) AS role
    CROSS JOIN pg_attribute a
    WHERE a.attrelid = 'public.submissions'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    IF has_column_privilege(r.role, 'public.submissions', r.attname, 'SELECT') THEN
      RAISE EXCEPTION
        'ABORT: % can still SELECT submissions.%', r.role, r.attname;
    END IF;
  END LOOP;
END $post$;

COMMIT;

-- =============================================================================
-- ROLLBACK — restores the pre-Group-3 browser leaderboard's access. Re-grant
-- exactly what the verify query showed before this file ran; typically:
-- =============================================================================
/*
GRANT SELECT ON TABLE public.submissions TO anon, authenticated;
*/
