-- List all CHECK constraints on public.submissions (run in Supabase SQL Editor)

SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'submissions'
  AND con.contype = 'c'
ORDER BY con.conname;
