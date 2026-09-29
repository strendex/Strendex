-- =============================================================================
-- 20260929_05 — ai_rl_hit: service role only               (FORWARD MIGRATION)
-- =============================================================================
--
-- FINDING (staging audit, 2026-09-29, section 9)
--   public.ai_rl_hit(text, text, bigint) is SECURITY INVOKER, and its ACL is
--   {=X/postgres, postgres=X, anon=X, authenticated=X, service_role=X}:
--   PUBLIC, anon and authenticated may all execute it.
--
--   What that does and does not show: the function takes the rate-limit key
--   (p_ip) from its caller, so a public caller could invoke it with any key.
--   Because it runs with the CALLER's rights, whether such a call can actually
--   change a counter depends on the grants and policies of the table it
--   writes — which this audit did not inspect. Counter tampering is therefore
--   NOT established. Public EXECUTE is simply not needed by anything.
--
-- CALLERS (checked in this branch AND in origin/main, which production runs)
--   lib/server/rateLimit.ts (POST /api/score; on main also /api/rank and
--   /api/submit) and app/api/athlete-review/route.ts — every one through a
--   service-role client. No browser code calls it. So revoking public EXECUTE
--   is safe before or after the Group 3 deploy, on staging and production.
--
-- WHAT CHANGES
--   REVOKE EXECUTE from PUBLIC, anon and authenticated; GRANT to service_role.
--   The body, SECURITY INVOKER mode, owner and settings are not touched — the
--   file asserts they are byte-for-byte unchanged.
--
-- DO NOT RUN until reviewed. Staging first.
-- =============================================================================

BEGIN;

DO $pre$
DECLARE
  v_fn        regprocedure := to_regprocedure('public.ai_rl_hit(text, text, bigint)');
  v_overloads integer;
BEGIN
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'ABORT: public.ai_rl_hit(text, text, bigint) not found.';
  END IF;

  -- Another overload would stay publicly executable; stop and inspect it.
  SELECT count(*) INTO v_overloads
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ai_rl_hit';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'ABORT: % overloads of public.ai_rl_hit exist; expected exactly 1.', v_overloads;
  END IF;

  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: service_role cannot execute ai_rl_hit today; the application depends on it.';
  END IF;

  -- Fingerprint what must NOT change, for the postcondition (transaction-local).
  PERFORM set_config(
    'strendex.ai_rl_hit_before',
    (SELECT md5(p.prosrc) || '|' || p.prosecdef || '|' || p.proowner || '|' || coalesce(p.proconfig::text, '')
     FROM pg_proc p WHERE p.oid = v_fn),
    true
  );
END $pre$;

REVOKE EXECUTE ON FUNCTION public.ai_rl_hit(text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rl_hit(text, text, bigint)
  TO service_role;

DO $post$
DECLARE
  v_fn regprocedure := 'public.ai_rl_hit(text, text, bigint)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE')
     OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: anon or authenticated can still execute ai_rl_hit (inherited through another role?)';
  END IF;
  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: service_role lost EXECUTE on ai_rl_hit';
  END IF;
  IF (SELECT md5(p.prosrc) || '|' || p.prosecdef || '|' || p.proowner || '|' || coalesce(p.proconfig::text, '')
      FROM pg_proc p WHERE p.oid = v_fn)
     IS DISTINCT FROM current_setting('strendex.ai_rl_hit_before') THEN
    RAISE EXCEPTION 'ABORT: ai_rl_hit body, security mode, owner or settings changed unexpectedly';
  END IF;
END $post$;

COMMIT;

-- =============================================================================
-- ROLLBACK — restores the ACL the audit recorded.
-- =============================================================================
/*
GRANT EXECUTE ON FUNCTION public.ai_rl_hit(text, text, bigint) TO PUBLIC, anon, authenticated;
*/
