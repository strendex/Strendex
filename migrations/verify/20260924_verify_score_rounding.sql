-- =============================================================================
-- VERIFY — the constraint's rounding matches the application's, on real Postgres
-- =============================================================================
--
-- READ-ONLY. Creates nothing, changes nothing, writes nothing. Safe on any
-- database, including production. Run it in the Supabase SQL editor.
--
-- WHY THIS FILE EXISTS
--   tests/scoreRounding.test.ts proves the equivalence in JavaScript, over the
--   whole supported domain. That is not proof of Postgres behaviour: round(double
--   precision) is rint(), which is platform-dependent, and the float8 -> numeric
--   cast has its own semantics. This script is the check that closes that gap.
--   Run it BEFORE trusting 20260924_03 in staging.
--
-- WHAT IT CHECKS, AND WHEN EACH PART CAN BE RUN
--
--   SAFE AT ANY STAGE — needs only hq_score and the two percentile columns,
--   all of which predate every governance migration:
--     Query 1  What this server's round(double precision) actually does at a tie.
--     Query 2  The new constraint expression against the application's expected
--              value for every supported percentile pair (1,002,001 of them).
--     Query 3  How many rows the OLD float expression and the NEW numeric
--              expression disagree about, in this actual database.
--     Query 4  Stored-score sanity: range, and scored rows missing a percentile.
--
--   REQUIRES 20260802_02 — dataset_version_id and tier do not exist before it:
--     Query 5  Whether any governed row would fail the new constraints.
--              GUARDED: it reports NOT_APPLICABLE rather than erroring, and a
--              missing column is never reported as a clean zero.
--
-- Queries 2 and 3 are the ones that matter. Query 2 must return zero rows.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Platform tie-breaking. Establishes WHICH rounding this server does.
--
--    Expect, on a ties-to-even build:
--      float_74_5 = 74   <- diverges from the application's 75
--      float_39_5 = 40, float_59_5 = 60, float_89_5 = 90   <- all agree
--    numeric_* must be 75 / 40 / 60 / 90 throughout: ties away from zero.
--    If float_74_5 comes back 75, this server rounds ties up and the live data
--    should show no divergence at all — re-check query 3 before concluding the
--    trigger was harmless.
-- -----------------------------------------------------------------------------

SELECT
  version()                              AS server_version,
  round(74.5::double precision)          AS float_74_5,   -- expect 74
  round(39.5::double precision)          AS float_39_5,   -- expect 40
  round(59.5::double precision)          AS float_59_5,   -- expect 60
  round(89.5::double precision)          AS float_89_5,   -- expect 90
  round(74.5::numeric)                   AS numeric_74_5, -- expect 75
  round(39.5::numeric)                   AS numeric_39_5, -- expect 40
  round(59.5::numeric)                   AS numeric_59_5, -- expect 60
  round(89.5::numeric)                   AS numeric_89_5; -- expect 90


-- -----------------------------------------------------------------------------
-- 2. THE PROOF. Exhaustive over the supported domain.
--
--    Domain: percentileMidrank() returns Number(p.toFixed(1)) clamped to
--    [0,100], so both percentiles are 1-decimal values in [0,100] — 1001 values
--    each, 1,002,001 pairs.
--
--    `expected` reproduces the application's arithmetic with exact integers:
--    Math.round(0.5*sp + 0.5*ep) on non-negative input is ties-upward, i.e.
--    floor((sp_tenths + ep_tenths + 10) / 20).
--
--    `actual` is the CONSTRAINT expression from 20260924_03, run against values
--    that have made the same round trip a real column makes: stored as double
--    precision, then cast to numeric.
--
--    MUST RETURN ZERO ROWS. Any row is a counter-example and 20260924_03 must
--    not be applied.
--
--    Runs about a million comparisons; a few seconds is normal.
-- -----------------------------------------------------------------------------

WITH pairs AS (
  SELECT s.t AS sp_tenths, e.t AS ep_tenths
  FROM generate_series(0, 1000) AS s(t)
  CROSS JOIN generate_series(0, 1000) AS e(t)
),
evaluated AS (
  SELECT
    sp_tenths,
    ep_tenths,
    -- Exactly how the value reaches the constraint in production: the server
    -- sends a JSON number, Postgres stores double precision, the constraint
    -- casts the column to numeric.
    round(
      ( ((sp_tenths / 10.0)::double precision)::numeric
      + ((ep_tenths / 10.0)::double precision)::numeric ) / 2
    )                                       AS actual,
    ((sp_tenths + ep_tenths + 10) / 20)     AS expected   -- integer division
  FROM pairs
)
SELECT
  sp_tenths / 10.0 AS strength_percentile,
  ep_tenths / 10.0 AS endurance_percentile,
  expected,
  actual
FROM evaluated
WHERE actual <> expected
ORDER BY sp_tenths, ep_tenths
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 3. Divergence actually present in THIS database.
--
--    old_float_value  = what the trigger/old CHECK computes
--    new_numeric_value = what the server computes and the new CHECK asserts
--
--    The owner's audit found 9 such rows in production out of 534. Expect the
--    same order of magnitude. These rows are NOT modified by any Group 1
--    migration — they are legacy (dataset_version_id IS NULL) and exempt.
-- -----------------------------------------------------------------------------

SELECT
  count(*) FILTER (WHERE differs)                                   AS rows_where_the_two_rules_differ,
  count(*) FILTER (WHERE differs AND stored_matches_float)          AS stored_agrees_with_old_trigger,
  count(*) FILTER (WHERE differs AND stored_matches_numeric)        AS stored_agrees_with_server,
  count(*)                                                          AS rows_examined
FROM (
  SELECT
    greatest(0, least(100, round(
      0.5 * COALESCE(strength_percentile, 0)
    + 0.5 * COALESCE(endurance_percentile, 0)
    )))                                                     AS old_float_value,
    round(
      (COALESCE(strength_percentile, 0)::numeric
     + COALESCE(endurance_percentile, 0)::numeric) / 2
    )                                                       AS new_numeric_value,
    hq_score,
    greatest(0, least(100, round(
      0.5 * COALESCE(strength_percentile, 0)
    + 0.5 * COALESCE(endurance_percentile, 0)
    ))) <> round(
      (COALESCE(strength_percentile, 0)::numeric
     + COALESCE(endurance_percentile, 0)::numeric) / 2
    )                                                       AS differs,
    hq_score = greatest(0, least(100, round(
      0.5 * COALESCE(strength_percentile, 0)
    + 0.5 * COALESCE(endurance_percentile, 0)
    )))                                                     AS stored_matches_float,
    hq_score = round(
      (COALESCE(strength_percentile, 0)::numeric
     + COALESCE(endurance_percentile, 0)::numeric) / 2
    )                                                       AS stored_matches_numeric
  FROM public.submissions
  WHERE hq_score IS NOT NULL
) t;


-- -----------------------------------------------------------------------------
-- 4. PRE-MIGRATION ONLY — no governance columns required.
--
--    Queries 1-3 above and this one are the checks to run BEFORE any 20260802 or
--    20260924 migration. They touch only hq_score, strength_percentile and
--    endurance_percentile, all of which predate every governance column.
-- -----------------------------------------------------------------------------

SELECT
  count(*)                                                        AS rows_total,
  count(*) FILTER (WHERE hq_score IS NOT NULL)                    AS rows_with_a_score,
  count(*) FILTER (WHERE hq_score IS NOT NULL AND (hq_score < 0 OR hq_score > 100))
                                                                  AS rows_failing_range,
  count(*) FILTER (WHERE hq_score IS NOT NULL
                     AND (strength_percentile IS NULL OR endurance_percentile IS NULL))
                                                                  AS scored_rows_missing_a_percentile
FROM public.submissions;


-- -----------------------------------------------------------------------------
-- 5. POST-MIGRATION — requires the governance columns.
--
--    ################  DO NOT RUN THIS BEFORE 20260802_02  ################
--
--    dataset_version_id and tier are added by 20260802_02. Run this query on a
--    database that lacks them and Postgres raises 42703 (undefined_column) — it
--    does NOT return zero. That distinction matters: a missing column is "not
--    checked", never "checked and found clean", and reading an error as a
--    verified zero governed-row count is exactly the mistake this split prevents.
--
--    The block below is therefore guarded. It reports NOT_APPLICABLE when the
--    columns are absent, and only counts rows when they exist, so the same file
--    is safe to run at any stage.
--
--    Run it:
--      * after 20260802_02, BEFORE 20260924_03 — every count must be 0, because
--        no governed row exists yet. If governed_rows_failing_score is non-zero,
--        20260924_03's VALIDATE will abort. Do not force it; investigate the row.
--      * again after Group 1 is live, as an ongoing consistency audit. From then
--        on governed_rows_total should be positive and both failure counts 0.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_has_dataset_version boolean;
  v_has_tier            boolean;
  v_governed            bigint;
  v_failing_score       bigint;
  v_failing_tier        bigint;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'submissions'
              AND column_name = 'dataset_version_id'),
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'submissions'
              AND column_name = 'tier')
  INTO v_has_dataset_version, v_has_tier;

  IF NOT v_has_dataset_version THEN
    RAISE NOTICE 'governed-row check: NOT_APPLICABLE — column dataset_version_id does not exist yet (20260802_02 not applied). This is NOT a zero governed-row count; it means the check has not been performed.';
    RETURN;
  END IF;

  IF NOT v_has_tier THEN
    RAISE NOTICE 'governed-row check: PARTIAL — dataset_version_id exists but tier does not. The tier/score agreement check has NOT been performed.';
  END IF;

  EXECUTE $q$
    SELECT
      count(*) FILTER (WHERE dataset_version_id IS NOT NULL),
      count(*) FILTER (
        WHERE dataset_version_id   IS NOT NULL
          AND hq_score             IS NOT NULL
          AND strength_percentile  IS NOT NULL
          AND endurance_percentile IS NOT NULL
          AND hq_score <> round(
                (strength_percentile::numeric + endurance_percentile::numeric) / 2
              )
      )
    FROM public.submissions
  $q$ INTO v_governed, v_failing_score;

  IF v_has_tier THEN
    EXECUTE $q$
      SELECT count(*) FILTER (
        WHERE dataset_version_id IS NOT NULL
          AND hq_score IS NOT NULL
          AND tier     IS NOT NULL
          AND tier <> CASE
                        WHEN hq_score >= 90 THEN 'WORLD CLASS'
                        WHEN hq_score >= 75 THEN 'ELITE'
                        WHEN hq_score >= 60 THEN 'ADVANCED'
                        WHEN hq_score >= 40 THEN 'INTERMEDIATE'
                        ELSE 'NOVICE'
                      END
      )
      FROM public.submissions
    $q$ INTO v_failing_tier;
  END IF;

  RAISE NOTICE 'governed-row check: PERFORMED. governed_rows_total=%, governed_rows_failing_score=%, governed_rows_failing_tier=%',
    v_governed,
    v_failing_score,
    CASE WHEN v_has_tier THEN v_failing_tier::text ELSE 'NOT_CHECKED' END;

  IF v_failing_score > 0 THEN
    RAISE WARNING 'STOP: % governed row(s) disagree with the numeric blend. 20260924_03 VALIDATE would abort. Investigate before migrating.', v_failing_score;
  END IF;

  IF v_has_tier AND v_failing_tier > 0 THEN
    RAISE WARNING 'STOP: % governed row(s) have a tier that disagrees with their score.', v_failing_tier;
  END IF;
END $$;
