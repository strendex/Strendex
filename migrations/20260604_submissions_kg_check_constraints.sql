-- =============================================================================
-- submissions: replace pound-era CHECK constraints with kilogram ranges
-- =============================================================================
--
-- Apply in Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--
-- Before applying, you can inspect current constraints (see bottom of file).
--
-- Reconstructed pound-era definitions (from legacy API validation + insert errors
-- before kg scoring). Confirm with the inspect query if names differ in your DB:
--
--   bw_range:
--     bodyweight >= 80 AND bodyweight <= 400
--
--   bench_range:
--     bench IS NULL OR (bench >= 45 AND bench <= 700)
--
--   squat_range:
--     squat IS NULL OR (squat >= 45 AND squat <= 900)
--
--   deadlift_range:
--     deadlift IS NULL OR (deadlift >= 45 AND deadlift <= 1000)
--
-- New ranges align with app/api/rank and app/api/submit kg validation (with a
-- slightly wider bodyweight ceiling for DB headroom).
-- =============================================================================

BEGIN;

-- Drop legacy pound-scale range constraints (IF EXISTS for safety across environments)
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS bw_range;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS bench_range;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS squat_range;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS deadlift_range;

-- Kilogram-appropriate replacements
ALTER TABLE public.submissions
  ADD CONSTRAINT bw_range
  CHECK (bodyweight >= 40 AND bodyweight <= 250);

ALTER TABLE public.submissions
  ADD CONSTRAINT bench_range
  CHECK (bench IS NULL OR (bench >= 20 AND bench <= 318));

ALTER TABLE public.submissions
  ADD CONSTRAINT squat_range
  CHECK (squat IS NULL OR (squat >= 20 AND squat <= 409));

ALTER TABLE public.submissions
  ADD CONSTRAINT deadlift_range
  CHECK (deadlift IS NULL OR (deadlift >= 20 AND deadlift <= 454));

COMMIT;

-- =============================================================================
-- Inspect: run this SELECT before/after to list every CHECK on submissions
-- =============================================================================
/*
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
*/
