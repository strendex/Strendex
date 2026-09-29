-- =============================================================================
-- READ ONLY — production pre-launch audit for Groups 1–5. ONE statement, ONE
-- result set (ord | section | subject | detail), so the Supabase SQL Editor
-- exports it in one go. Creates nothing, writes nothing, takes no locks beyond
-- ordinary reads. Safe on any database. Guarded: works whether or not any
-- Group 1–3 migration has been applied (missing objects are reported, never
-- assumed).
--
-- Run it BEFORE the first production migration and keep the CSV export: the
-- permission rollbacks re-grant from it, and several migrations abort unless
-- the live definitions below match what they expect.
--
-- Sections
--   1 server           Postgres version and round() tie behaviour (runbook query 1)
--   2 rounding_proof   counter-examples to the 20260924_03 expression over all
--                      1,002,001 percentile pairs — MUST be 0 (runbook query 2;
--                      takes a few seconds)
--   3 presence         which Group 1–3 objects already exist
--   4 constraint       every CHECK on submissions, with its live definition
--   5 trigger          every non-internal trigger on submissions
--   6 index            every index on submissions
--   7 function_def     full body of ai_rl_hit (all overloads) and the other
--                      rate-limit / scoring functions
--   8 function_acl     every function in public: security mode, owner,
--                      search_path, ACL, anon/authenticated EXECUTE
--   9 rls              RLS on submissions and the rate-limit/cache tables
--  10 policy           every policy on those tables
--  11 table_acl        catalog ACL including PUBLIC
--  12 column_acl       column-level grants
--  13 effective_table  what anon / authenticated can actually do, including
--                      PostgreSQL 17's MAINTAIN
--  14 default_acl      default privileges that re-grant on new objects
--  15 role_membership  roles anon / authenticated inherit from
--  16 ratelimit_keys   unique keys on ai_rate_limits (ai_rl_hit's ON CONFLICT)
--  17 data             rounding divergence present, score sanity (runbook
--                      queries 3–4), and a bootstrap APPROXIMATION: complete vs
--                      in-bounds counts. It cannot check provenance (absent
--                      before 20260802_02) and is NOT the eligible count; only
--                      scripts/bootstrapLegacyDatasetVersion.ts (inspect) is.
-- =============================================================================

WITH
tbl AS (
  SELECT c.oid, c.relname, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname IN ('submissions', 'scoring_dataset_versions', 'ai_rate_limits', 'ai_analysis_cache')
),
public_roles AS (
  SELECT unnest(ARRAY['anon', 'authenticated']::name[]) AS role
),
cols AS (
  SELECT t.relname, a.attname, a.attacl
  FROM tbl t
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
),
fns AS (
  SELECT p.oid, p.proname, p.prosecdef, p.proowner, p.proacl, p.proconfig, p.prokind
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
rounding AS (
  SELECT count(*) AS counterexamples
  FROM generate_series(0, 1000) AS s(t)
  CROSS JOIN generate_series(0, 1000) AS e(t)
  WHERE round((((s.t / 10.0)::double precision)::numeric
             + ((e.t / 10.0)::double precision)::numeric) / 2)
        <> ((s.t + e.t + 10) / 20)
),
subs AS (
  SELECT
    hq_score, status, strength_percentile, endurance_percentile,
    bodyweight, bench, squat, deadlift, endurance_seconds,
    strength_index, endurance_index
  FROM public.submissions
)

SELECT 1 AS ord, 'server' AS section, 'version' AS subject, version() AS detail
UNION ALL
SELECT 1, 'server', 'round() ties',
       format('float 74.5->%s 39.5->%s 59.5->%s 89.5->%s | numeric 74.5->%s (expect float 74/40/60/90, numeric 75)',
              round(74.5::double precision), round(39.5::double precision),
              round(59.5::double precision), round(89.5::double precision),
              round(74.5::numeric))

UNION ALL
SELECT 2, 'rounding_proof', '20260924_03 expression vs application',
       format('counterexamples=%s (MUST be 0)', r.counterexamples)
FROM rounding r

UNION ALL
SELECT 3, 'presence', x.subject, x.detail
FROM (VALUES
  ('20260802_01 scoring_dataset_versions', (to_regclass('public.scoring_dataset_versions') IS NOT NULL)::text),
  ('20260802_02 submissions.original_unit_system', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'original_unit_system')::text),
  ('20260802_02 submissions.provenance', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'provenance')::text),
  ('20260802_03 score_result_insert()', EXISTS (SELECT 1 FROM fns WHERE proname = 'score_result_insert')::text),
  ('20260924_01 submissions.original_bodyweight', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'original_bodyweight')::text),
  ('20260929_01 submissions.moderated_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'moderated_at')::text),
  ('20260929_04 leaderboard_placement()', EXISTS (SELECT 1 FROM fns WHERE proname = 'leaderboard_placement')::text),
  ('ai_rl_hit overloads', (SELECT count(*) FROM fns WHERE proname = 'ai_rl_hit')::text),
  ('set_canonical_hq_score()', EXISTS (SELECT 1 FROM fns WHERE proname = 'set_canonical_hq_score')::text)
) AS x(subject, detail)

UNION ALL
SELECT 4, 'constraint', con.conname::text,
       format('validated=%s %s', con.convalidated, pg_get_constraintdef(con.oid, true))
FROM pg_constraint con
WHERE con.conrelid = 'public.submissions'::regclass
  AND con.contype = 'c'

UNION ALL
SELECT 5, 'trigger', tg.tgname::text,
       format('enabled=%s %s', tg.tgenabled, pg_get_triggerdef(tg.oid))
FROM pg_trigger tg
WHERE tg.tgrelid = 'public.submissions'::regclass
  AND NOT tg.tgisinternal

UNION ALL
SELECT 6, 'index', i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid)
FROM pg_index i
WHERE i.indrelid = 'public.submissions'::regclass

UNION ALL
SELECT 7, 'function_def', format('%s(%s)', f.proname, pg_get_function_identity_arguments(f.oid)),
       pg_get_functiondef(f.oid)
FROM fns f
WHERE f.prokind = 'f'
  AND f.proname IN ('ai_rl_hit', 'ai_rate_limit_increment', 'set_canonical_hq_score',
                    'score_result_insert', 'leaderboard_placement', 'rls_auto_enable')

UNION ALL
SELECT 8, 'function_acl', format('%s(%s)', f.proname, pg_get_function_identity_arguments(f.oid)),
       format('kind=%s security_definer=%s owner=%s config=%s anon_exec=%s authenticated_exec=%s acl=%s',
              f.prokind, f.prosecdef, pg_get_userbyid(f.proowner),
              coalesce(array_to_string(f.proconfig, ','), '-'),
              has_function_privilege('anon', f.oid, 'EXECUTE'),
              has_function_privilege('authenticated', f.oid, 'EXECUTE'),
              coalesce(f.proacl::text, '(NULL: default, PUBLIC may execute)'))
FROM fns f

UNION ALL
SELECT 9, 'rls', t.relname::text,
       format('enabled=%s forced=%s', t.relrowsecurity, t.relforcerowsecurity)
FROM tbl t

UNION ALL
SELECT 10, 'policy', format('%s.%s', p.tablename, p.policyname),
       format('%s cmd=%s roles=%s using=%s check=%s',
              p.permissive, p.cmd, p.roles::text,
              coalesce(p.qual, '-'), coalesce(p.with_check, '-'))
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (SELECT relname FROM tbl)

UNION ALL
SELECT 11, 'table_acl',
       format('%s -> %s', t.relname,
              CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END),
       format('%s%s (grantor %s)%s', x.privilege_type,
              CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END,
              pg_get_userbyid(x.grantor),
              CASE WHEN t.relacl IS NULL THEN ' [implicit default ACL]' ELSE '' END)
FROM tbl t
CROSS JOIN LATERAL aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) x

UNION ALL
SELECT 12, 'column_acl',
       format('%s.%s -> %s', c.relname, c.attname,
              CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END),
       format('%s%s', x.privilege_type,
              CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
FROM cols c
CROSS JOIN LATERAL aclexplode(c.attacl) x
WHERE c.attacl IS NOT NULL

UNION ALL
SELECT 13, 'effective_table', format('%s on %s', r.role, t.relname),
       format('select=%s insert=%s update=%s delete=%s truncate=%s references=%s trigger=%s maintain=%s',
              has_table_privilege(r.role, t.oid, 'SELECT'),
              has_table_privilege(r.role, t.oid, 'INSERT'),
              has_table_privilege(r.role, t.oid, 'UPDATE'),
              has_table_privilege(r.role, t.oid, 'DELETE'),
              has_table_privilege(r.role, t.oid, 'TRUNCATE'),
              has_table_privilege(r.role, t.oid, 'REFERENCES'),
              has_table_privilege(r.role, t.oid, 'TRIGGER'),
              -- MAINTAIN exists from PostgreSQL 17 (VACUUM/ANALYZE/REINDEX/LOCK…).
              CASE WHEN current_setting('server_version_num')::int >= 170000
                   THEN has_table_privilege(r.role, t.oid, 'MAINTAIN')::text
                   ELSE 'n/a (<17)' END)
FROM public_roles r
CROSS JOIN tbl t

UNION ALL
SELECT 14, 'default_acl',
       format('owner=%s schema=%s objtype=%s',
              pg_get_userbyid(d.defaclrole), coalesce(n.nspname, '(all schemas)'), d.defaclobjtype),
       d.defaclacl::text
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclnamespace = 0 OR n.nspname = 'public'

UNION ALL
SELECT 15, 'role_membership',
       format('%s is a member of %s', pg_get_userbyid(m.member), pg_get_userbyid(m.roleid)),
       format('admin_option=%s', m.admin_option)
FROM pg_auth_members m
WHERE pg_get_userbyid(m.member) IN ('anon', 'authenticated')

UNION ALL
SELECT 16, 'ratelimit_keys', con.conname::text, pg_get_constraintdef(con.oid, true)
FROM pg_constraint con
WHERE con.conrelid = to_regclass('public.ai_rate_limits')
  AND con.contype IN ('p', 'u')

UNION ALL
SELECT 17, 'data', 'rounding divergence present (runbook query 3)',
       format('rows_where_rules_differ=%s stored_agrees_old_trigger=%s stored_agrees_server=%s examined=%s',
              count(*) FILTER (WHERE d.differs),
              count(*) FILTER (WHERE d.differs AND d.hq_score = d.old_v),
              count(*) FILTER (WHERE d.differs AND d.hq_score = d.new_v),
              count(*))
FROM (
  SELECT hq_score,
         greatest(0, least(100, round(0.5 * coalesce(strength_percentile, 0) + 0.5 * coalesce(endurance_percentile, 0)))) AS old_v,
         round((coalesce(strength_percentile, 0)::numeric + coalesce(endurance_percentile, 0)::numeric) / 2) AS new_v,
         greatest(0, least(100, round(0.5 * coalesce(strength_percentile, 0) + 0.5 * coalesce(endurance_percentile, 0))))
           <> round((coalesce(strength_percentile, 0)::numeric + coalesce(endurance_percentile, 0)::numeric) / 2) AS differs
  FROM subs
  WHERE hq_score IS NOT NULL
) d

UNION ALL
SELECT 17, 'data', 'score sanity (runbook query 4)',
       format('total=%s scored=%s out_of_range=%s scored_missing_percentile=%s',
              count(*),
              count(*) FILTER (WHERE hq_score IS NOT NULL),
              count(*) FILTER (WHERE hq_score IS NOT NULL AND (hq_score < 0 OR hq_score > 100)),
              count(*) FILTER (WHERE hq_score IS NOT NULL AND (strength_percentile IS NULL OR endurance_percentile IS NULL)))
FROM subs

UNION ALL
SELECT 17, 'data', 'status by score',
       format('approved_ge90=%s pending_ge90=%s pending_lt90=%s approved_lt90=%s rejected=%s null_score=%s',
              count(*) FILTER (WHERE status = 'approved' AND hq_score >= 90),
              count(*) FILTER (WHERE status = 'pending' AND hq_score >= 90),
              count(*) FILTER (WHERE status = 'pending' AND hq_score < 90),
              count(*) FILTER (WHERE status = 'approved' AND hq_score < 90),
              count(*) FILTER (WHERE status = 'rejected'),
              count(*) FILTER (WHERE hq_score IS NULL))
FROM subs

UNION ALL
SELECT 17, 'data', 'bootstrap approximation (NOT the eligible count; provenance unchecked)',
       format('approved=%s complete=%s complete_and_in_bounds=%s (in bounds: indexes 0–100, endurance 4200–28800)',
              count(*) FILTER (WHERE status = 'approved'),
              count(*) FILTER (WHERE status = 'approved'
                                 AND bodyweight IS NOT NULL AND bench IS NOT NULL AND squat IS NOT NULL
                                 AND deadlift IS NOT NULL AND endurance_seconds IS NOT NULL),
              count(*) FILTER (WHERE status = 'approved'
                                 AND bodyweight IS NOT NULL AND bench IS NOT NULL AND squat IS NOT NULL
                                 AND deadlift IS NOT NULL AND endurance_seconds IS NOT NULL
                                 AND strength_index BETWEEN 0 AND 100
                                 AND endurance_index BETWEEN 0 AND 100
                                 AND endurance_seconds BETWEEN 4200 AND 28800))
FROM subs

ORDER BY ord, subject, detail;
