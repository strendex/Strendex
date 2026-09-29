-- =============================================================================
-- 20260929_06 — Remove unneeded public-role privileges      (FORWARD MIGRATION)
-- =============================================================================
--
-- WHY
--   The production catalog audit (migrations/verify/20260930_verify_production_prelaunch.sql,
--   run on rgnwrlivldzqeaxhhvet, PostgreSQL 17.6) showed privileges the public
--   roles do not need, which earlier migrations do not remove:
--
--   * ai_rate_limits, ai_analysis_cache — anon and authenticated hold EVERY
--     table privilege (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
--     TRIGGER and PostgreSQL 17's MAINTAIN), inherited from the project's
--     default privileges. No column-level grants were listed.
--   * submissions — anon and authenticated hold MAINTAIN, REFERENCES, TRIGGER,
--     TRUNCATE and SELECT. 20260929_02 revokes TRUNCATE/REFERENCES/TRIGGER (and
--     the writes) but predates the MAINTAIN audit and does not revoke it.
--   * ai_rate_limit_increment(text, text, bigint) — EXECUTE for PUBLIC, anon
--     and authenticated. It has NO caller: not in this branch, origin/main, any
--     other branch or the stashes; the only historical caller was the removed
--     server route app/api/ai-analysis (service role, removed 2026-08-02).
--
--   Not claimed exploitable. Both counter functions are SECURITY INVOKER, and
--   both AI tables have RLS enabled with no policies, so row reads and writes
--   through the public key already return nothing or fail. The privileges are
--   simply unnecessary; RLS does not govern TRUNCATE, REFERENCES, TRIGGER or
--   MAINTAIN, so they are removed rather than left to RLS.
--
-- WHAT CHANGES (PUBLIC, anon, authenticated only — service_role untouched)
--   1. ai_rate_limits, ai_analysis_cache: REVOKE ALL (table level; revoking a
--      table privilege also revokes it on every column). On PostgreSQL 17 ALL
--      includes MAINTAIN.
--   2. submissions: revoke every privilege EXCEPT SELECT — INSERT, UPDATE,
--      DELETE, TRUNCATE, REFERENCES, TRIGGER and (PG 17+) MAINTAIN. Idempotent
--      with 20260929_02, and self-sufficient if run without it. Public SELECT
--      is preserved exactly; 20260929_03 removes it after the release.
--   3. ai_rate_limit_increment(text, text, bigint): REVOKE EXECUTE.
--      ai_rl_hit is left to 20260929_05 (unchanged).
--
-- SAFE WITH THE CURRENTLY DEPLOYED APP AND WITH THIS BRANCH
--   Every caller of ai_rl_hit and every reader/writer of these tables uses the
--   service role (origin/main: app/api/athlete-review, app/api/rank,
--   app/api/submit; this branch: the same plus /api/score). The only public-key
--   access anywhere is the old /rankings SELECT on submissions, which is kept.
--
-- ORDER  After 20260929_05, before the release. Any time before is also safe.
-- VERIFY Re-run migrations/verify/20260930_verify_production_prelaunch.sql.
-- DO NOT RUN until reviewed. Staging first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Preconditions — abort rather than guess.
-- -----------------------------------------------------------------------------
DO $pre$
DECLARE
  t text;
  n int;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.submissions', 'public.ai_rate_limits', 'public.ai_analysis_cache'] LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE EXCEPTION 'ABORT: % not found.', t;
    END IF;
  END LOOP;

  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'ai_rate_limit_increment';
  IF n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % overloads of public.ai_rate_limit_increment exist; expected exactly 1.', n;
  END IF;
  IF to_regprocedure('public.ai_rate_limit_increment(text, text, bigint)') IS NULL THEN
    RAISE EXCEPTION 'ABORT: public.ai_rate_limit_increment(text, text, bigint) not found.';
  END IF;

  -- What must survive. If service_role cannot do these today, something is
  -- already different from the audit: stop and look.
  IF NOT (has_table_privilege('service_role', 'public.ai_rate_limits', 'SELECT')
      AND has_table_privilege('service_role', 'public.ai_rate_limits', 'INSERT')
      AND has_table_privilege('service_role', 'public.ai_rate_limits', 'UPDATE')
      AND has_table_privilege('service_role', 'public.ai_analysis_cache', 'SELECT')
      AND has_table_privilege('service_role', 'public.ai_analysis_cache', 'INSERT')
      AND has_table_privilege('service_role', 'public.submissions', 'SELECT')
      AND has_table_privilege('service_role', 'public.submissions', 'INSERT')
      AND has_function_privilege('service_role', 'public.ai_rate_limit_increment(text, text, bigint)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'ABORT: service_role lacks an expected privilege before this migration; compare with the audit export.';
  END IF;
END $pre$;

-- Snapshot what must NOT change: service_role's ACL entries on the three
-- tables and the function, and the public roles' SELECT on submissions.
CREATE TEMP TABLE _m06_before ON COMMIT DROP AS
SELECT 'table:' || c.relname AS obj, x.privilege_type, x.is_grantable
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
WHERE ns.nspname = 'public'
  AND c.relname IN ('submissions', 'ai_rate_limits', 'ai_analysis_cache')
  AND x.grantee = 'service_role'::regrole
UNION ALL
SELECT 'function:ai_rate_limit_increment', x.privilege_type, x.is_grantable
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
WHERE p.oid = 'public.ai_rate_limit_increment(text, text, bigint)'::regprocedure
  AND x.grantee = 'service_role'::regrole
UNION ALL
SELECT 'submissions-select:' || r, 'SELECT', has_table_privilege(r, 'public.submissions', 'SELECT')
FROM unnest(ARRAY['anon', 'authenticated']) AS r;

-- -----------------------------------------------------------------------------
-- 1. AI tables: nothing for the public roles.
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.ai_rate_limits    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_analysis_cache FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. submissions: everything except SELECT.
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.submissions
  FROM PUBLIC, anon, authenticated;

-- MAINTAIN exists from PostgreSQL 17; the keyword is a syntax error before it.
DO $maint$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON TABLE public.submissions FROM PUBLIC, anon, authenticated';
  END IF;
END $maint$;

-- -----------------------------------------------------------------------------
-- 3. The unused counter function.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.ai_rate_limit_increment(text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_increment(text, text, bigint)
  TO service_role;

-- -----------------------------------------------------------------------------
-- Postconditions — EFFECTIVE privileges (includes PUBLIC and role membership).
-- -----------------------------------------------------------------------------
DO $post$
DECLARE
  r      text;
  t      text;
  a      record;
  priv   text;
  privs  text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  n      int;
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    privs := array_append(privs, 'MAINTAIN');
  END IF;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    -- AI tables: no table privilege at all.
    FOREACH t IN ARRAY ARRAY['public.ai_rate_limits', 'public.ai_analysis_cache'] LOOP
      FOREACH priv IN ARRAY privs LOOP
        IF has_table_privilege(r, t, priv) THEN
          RAISE EXCEPTION 'ABORT: % still has % on % (inherited through another role?)', r, priv, t;
        END IF;
      END LOOP;
    END LOOP;

    -- submissions: nothing but SELECT.
    FOREACH priv IN ARRAY privs LOOP
      IF priv <> 'SELECT' AND has_table_privilege(r, 'public.submissions', priv) THEN
        RAISE EXCEPTION 'ABORT: % still has % on public.submissions', r, priv;
      END IF;
    END LOOP;

    -- No column-level privilege on the AI tables, and no column-level write on submissions.
    FOR a IN
      SELECT c.relname, att.attname
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
      WHERE ns.nspname = 'public' AND c.relname IN ('ai_rate_limits', 'ai_analysis_cache', 'submissions')
    LOOP
      IF a.relname <> 'submissions'
         AND has_column_privilege(r, format('public.%I', a.relname), a.attname::text, 'SELECT') THEN
        RAISE EXCEPTION 'ABORT: % can still SELECT %.%', r, a.relname, a.attname;
      END IF;
      IF has_column_privilege(r, format('public.%I', a.relname), a.attname::text, 'INSERT')
         OR has_column_privilege(r, format('public.%I', a.relname), a.attname::text, 'UPDATE')
         OR has_column_privilege(r, format('public.%I', a.relname), a.attname::text, 'REFERENCES') THEN
        RAISE EXCEPTION 'ABORT: % still has a column-level write on %.%', r, a.relname, a.attname;
      END IF;
    END LOOP;

    IF has_function_privilege(r, 'public.ai_rate_limit_increment(text, text, bigint)', 'EXECUTE') THEN
      RAISE EXCEPTION 'ABORT: % can still execute ai_rate_limit_increment', r;
    END IF;
  END LOOP;

  -- Nothing that had to survive changed.
  SELECT count(*) INTO n FROM (
    (SELECT * FROM _m06_before
     EXCEPT
     (SELECT 'table:' || c.relname, x.privilege_type, x.is_grantable
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
      WHERE ns.nspname = 'public'
        AND c.relname IN ('submissions', 'ai_rate_limits', 'ai_analysis_cache')
        AND x.grantee = 'service_role'::regrole
      UNION ALL
      SELECT 'function:ai_rate_limit_increment', x.privilege_type, x.is_grantable
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
      WHERE p.oid = 'public.ai_rate_limit_increment(text, text, bigint)'::regprocedure
        AND x.grantee = 'service_role'::regrole
      UNION ALL
      SELECT 'submissions-select:' || rr, 'SELECT', has_table_privilege(rr, 'public.submissions', 'SELECT')
      FROM unnest(ARRAY['anon', 'authenticated']) AS rr))
  ) missing;
  IF n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % service_role privilege(s) or public SELECT changed unexpectedly', n;
  END IF;
END $post$;

COMMIT;

-- =============================================================================
-- ROLLBACK — READ ALL OF THIS FIRST. Nothing in either app needs these grants.
--
-- The right undo depends on the grants that existed IMMEDIATELY BEFORE this
-- file ran, which are not the same as the original production audit
-- (2026-09-29): in the planned order 20260929_02 and _05 run first and have
-- already removed TRUNCATE, REFERENCES and TRIGGER on submissions and EXECUTE
-- on ai_rl_hit. Re-granting the audit's full list would re-introduce those.
--
-- So: do NOT run either variant as an isolated undo without first comparing
-- with the actual pre-_06 grants. Run migrations/verify/20260930_verify_production_prelaunch.sql
-- immediately before applying _06, keep that export, and re-grant only the
-- table_acl / function_acl entries that export has and the post-_06 audit lacks.
--
-- Variant A — planned order (_02 and _05 already applied). Tested on a
-- disposable replica of production's grants: restores the exact pre-_06 ACL
-- (91 entries). _06 removes, and this re-grants, exactly: every privilege of
-- anon/authenticated on ai_rate_limits and ai_analysis_cache; MAINTAIN on
-- submissions for anon/authenticated; EXECUTE on ai_rate_limit_increment for
-- PUBLIC, anon, authenticated.
/*
BEGIN;
GRANT ALL ON TABLE public.ai_rate_limits    TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_cache TO anon, authenticated;
GRANT MAINTAIN ON TABLE public.submissions TO anon, authenticated;   -- PostgreSQL 17+
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_increment(text, text, bigint)
  TO PUBLIC, anon, authenticated;
COMMIT;
*/
--
-- Variant B — only if _06 was applied BEFORE _02 (not the plan). Restores the
-- original production audit state for these objects, i.e. it ALSO re-grants
-- TRUNCATE, REFERENCES and TRIGGER on submissions. Tested on the replica in
-- that order (restores the audit's 100-entry ACL). Never run it after _02.
/*
BEGIN;
GRANT ALL ON TABLE public.ai_rate_limits    TO anon, authenticated;
GRANT ALL ON TABLE public.ai_analysis_cache TO anon, authenticated;
GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.submissions TO anon, authenticated;
GRANT MAINTAIN ON TABLE public.submissions TO anon, authenticated;   -- PostgreSQL 17+
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_increment(text, text, bigint)
  TO PUBLIC, anon, authenticated;
COMMIT;
*/
