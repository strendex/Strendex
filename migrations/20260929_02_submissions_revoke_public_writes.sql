-- =============================================================================
-- 20260929_02 — No public writes to submissions            (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY
--   Status, moderation fields and scores must be set only by the server. The
--   repository contains no policies or grants for public.submissions, and a
--   read-only probe of staging (2026-09-29) could not establish whether the
--   public (anon) key can INSERT or UPDATE: PostgREST's schema endpoint is
--   secret-key-only and no catalog connection was available. This file removes
--   any such privilege rather than assume it is absent.
--
-- WHAT CHANGES
--   REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on
--   public.submissions from PUBLIC, anon and authenticated. Revoking a
--   table-level privilege also revokes the matching column-level privileges on
--   every column, so column grants (e.g. UPDATE (status)) cannot survive.
--   SELECT is NOT touched here — see 20260929_03 and its deployment ordering.
--   service_role is not touched.
--
-- SAFE BEFORE THE GROUP 3 DEPLOY
--   Every current write is server-side with the service role: POST /api/score
--   (score_result_insert, service_role only) and the legacy /api/submit.
--   Nothing in the browser writes to this table.
--
-- VERIFY with migrations/verify/20260929_verify_submissions_permissions.sql.
-- DO NOT RUN until reviewed. Staging first.
-- =============================================================================

BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.submissions
  FROM PUBLIC, anon, authenticated;

-- Postconditions: EFFECTIVE privilege, which includes anything inherited
-- through PUBLIC or role membership — not merely the direct grants.
DO $post$
DECLARE
  r    record;
  priv text;
BEGIN
  FOR r IN SELECT unnest(ARRAY['anon', 'authenticated']) AS role LOOP
    FOREACH priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(r.role, 'public.submissions', priv) THEN
        RAISE EXCEPTION
          'ABORT: % still has % on public.submissions (inherited through another role?)', r.role, priv;
      END IF;
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT role, a.attname
    FROM unnest(ARRAY['anon', 'authenticated']) AS role
    CROSS JOIN pg_attribute a
    WHERE a.attrelid = 'public.submissions'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    IF has_column_privilege(r.role, 'public.submissions', r.attname, 'INSERT')
       OR has_column_privilege(r.role, 'public.submissions', r.attname, 'UPDATE')
       OR has_column_privilege(r.role, 'public.submissions', r.attname, 'REFERENCES') THEN
      RAISE EXCEPTION
        'ABORT: % still has a column-level write privilege on submissions.%', r.role, r.attname;
    END IF;
  END LOOP;
END $post$;

COMMIT;

-- =============================================================================
-- ROLLBACK — only if something public genuinely needs to write (nothing should).
-- Re-grant exactly what the verify query showed BEFORE this file ran.
-- =============================================================================
-- /* GRANT INSERT ON TABLE public.submissions TO anon; */
