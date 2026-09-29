-- =============================================================================
-- READ ONLY — who can do what to public.submissions (and the dataset table).
-- One statement, one result set (ord | section | subject | detail), so the
-- whole audit exports from the Supabase SQL Editor in one go. Creates and
-- writes nothing; safe on any database, including production.
--
-- Run BEFORE 20260929_02 / _03 (keep the export — rollbacks re-grant from it)
-- and again after each.
--
-- Sections
--   1 rls               row level security on each table
--   2 policy            every policy: which ROWS a role may see or write
--   3 table_acl         catalog ACL, INCLUDING grants to PUBLIC (grantee 0)
--                       and the implicit owner-only default when relacl IS NULL
--                       (information_schema.role_table_grants hides PUBLIC)
--   4 column_acl        column-level grants, including PUBLIC
--   5 effective_table   has_table_privilege for anon / authenticated — what the
--                       role can actually do via PUBLIC, membership or direct grant
--   6 effective_column  has_column_privilege, listed only where something is true
--   7 default_acl       default privileges that would re-grant on new objects
--   8 constraint        every CHECK on submissions (status / moderation rules)
--   9 function          EXECUTE on the write/rate-limit functions
--  10 role_membership   roles anon / authenticated inherit privileges from
--
-- A privilege says a role MAY read or write; a policy (section 2) decides
-- WHICH rows. Pending-row visibility needs both.
-- =============================================================================

WITH
tbl AS (
  SELECT c.oid, c.relname, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('submissions', 'scoring_dataset_versions')
),
public_roles AS (
  SELECT unnest(ARRAY['anon', 'authenticated']::name[]) AS role
),
cols AS (
  SELECT t.relname, a.attname, a.attacl
  FROM tbl t
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
)

SELECT 1 AS ord, 'rls' AS section, t.relname::text AS subject,
       format('enabled=%s forced=%s', t.relrowsecurity, t.relforcerowsecurity) AS detail
FROM tbl t

UNION ALL
SELECT 2, 'policy', format('%s.%s', p.tablename, p.policyname),
       format('%s cmd=%s roles=%s using=%s check=%s',
              p.permissive, p.cmd, p.roles::text,
              coalesce(p.qual, '-'), coalesce(p.with_check, '-'))
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('submissions', 'scoring_dataset_versions')

UNION ALL
SELECT 3, 'table_acl',
       format('%s -> %s', t.relname,
              CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END),
       format('%s%s (grantor %s)%s', x.privilege_type,
              CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END,
              pg_get_userbyid(x.grantor),
              CASE WHEN t.relacl IS NULL THEN ' [implicit default ACL]' ELSE '' END)
FROM tbl t
CROSS JOIN LATERAL aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) x

UNION ALL
SELECT 4, 'column_acl',
       format('%s.%s -> %s', c.relname, c.attname,
              CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END),
       format('%s%s', x.privilege_type,
              CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
FROM cols c
CROSS JOIN LATERAL aclexplode(c.attacl) x
WHERE c.attacl IS NOT NULL

UNION ALL
SELECT 5, 'effective_table', format('%s on %s', r.role, t.relname),
       format('select=%s insert=%s update=%s delete=%s truncate=%s references=%s trigger=%s',
              has_table_privilege(r.role, t.oid, 'SELECT'),
              has_table_privilege(r.role, t.oid, 'INSERT'),
              has_table_privilege(r.role, t.oid, 'UPDATE'),
              has_table_privilege(r.role, t.oid, 'DELETE'),
              has_table_privilege(r.role, t.oid, 'TRUNCATE'),
              has_table_privilege(r.role, t.oid, 'REFERENCES'),
              has_table_privilege(r.role, t.oid, 'TRIGGER'))
FROM public_roles r
CROSS JOIN tbl t

UNION ALL
SELECT 6, 'effective_column', format('%s on %s.%s', r.role, c.relname, c.attname),
       format('select=%s insert=%s update=%s',
              has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'SELECT'),
              has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'INSERT'),
              has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'UPDATE'))
FROM public_roles r
CROSS JOIN cols c
WHERE has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'SELECT')
   OR has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'INSERT')
   OR has_column_privilege(r.role, format('public.%I', c.relname), c.attname::text, 'UPDATE')

UNION ALL
SELECT 7, 'default_acl',
       format('owner=%s schema=%s objtype=%s',
              pg_get_userbyid(d.defaclrole), coalesce(n.nspname, '(all schemas)'), d.defaclobjtype),
       d.defaclacl::text
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclnamespace = 0 OR n.nspname = 'public'

UNION ALL
SELECT 8, 'constraint', con.conname::text,
       format('validated=%s %s', con.convalidated, pg_get_constraintdef(con.oid))
FROM pg_constraint con
WHERE con.conrelid = 'public.submissions'::regclass
  AND con.contype = 'c'

UNION ALL
SELECT 9, 'function',
       format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
       format('security_definer=%s anon_exec=%s authenticated_exec=%s acl=%s',
              p.prosecdef,
              has_function_privilege('anon', p.oid, 'EXECUTE'),
              has_function_privilege('authenticated', p.oid, 'EXECUTE'),
              coalesce(p.proacl::text, '(NULL: default, PUBLIC may execute)'))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('score_result_insert', 'ai_rl_hit')

UNION ALL
SELECT 10, 'role_membership',
       format('%s is a member of %s', pg_get_userbyid(m.member), pg_get_userbyid(m.roleid)),
       format('admin_option=%s', m.admin_option)
FROM pg_auth_members m
WHERE pg_get_userbyid(m.member) IN ('anon', 'authenticated')

ORDER BY ord, subject, detail;
