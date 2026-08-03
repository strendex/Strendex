-- =============================================================================
-- 20260802_01 — Immutable scoring dataset versions
-- =============================================================================
--
-- ADDITIVE ONLY. Creates one new table plus its guards. Touches no existing
-- table, drops nothing, rewrites nothing, and deliberately creates NO active
-- dataset: the current `submissions` population is a mix of simulated and
-- self-reported rows and must never become an active reference population
-- automatically. See docs/group-2-migration-runbook.md.
--
-- DO NOT RUN THIS FILE against production until the runbook has been followed.
-- Apply in staging first: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.scoring_dataset_versions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-readable, operator-chosen label, e.g. '2026-08 launch baseline'.
  label                 text        NOT NULL,

  -- Which scoring algorithm this dataset was built for (lib/scoring/core
  -- SCORE_VERSION). A dataset is only usable by a matching score version.
  score_version         text        NOT NULL,

  -- What the population is made of. Disclosure, not decoration:
  --   observed                 = governed, complete, approved, public v2 results
  --   legacy_mixed_provisional = pre-governance rows of unknown real/simulated
  --                              origin; the transitional bootstrap only.
  kind                  text        NOT NULL DEFAULT 'observed',

  lifecycle             text        NOT NULL DEFAULT 'draft',
  frozen                boolean     NOT NULL DEFAULT false,

  -- Server-owned reference distributions. Never client supplied.
  strength_reference    double precision[] NOT NULL,
  endurance_reference   double precision[] NOT NULL,

  eligible_sample_size  integer     NOT NULL,

  -- Provenance breakdown of the records the dataset was built from, e.g.
  -- {"self_reported": 412, "reviewed": 18, "verified": 3}.
  source_counts         jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Deterministic hash of (score_version, sorted references, sample size).
  dataset_hash          text        NOT NULL,

  confidence            text        NOT NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  activated_at          timestamptz,
  retired_at            timestamptz,

  CONSTRAINT scoring_dataset_versions_label_len
    CHECK (char_length(label) BETWEEN 3 AND 120),
  CONSTRAINT scoring_dataset_versions_kind_valid
    CHECK (kind IN ('observed', 'legacy_mixed_provisional')),
  CONSTRAINT scoring_dataset_versions_lifecycle_valid
    CHECK (lifecycle IN ('draft', 'active', 'retired')),
  CONSTRAINT scoring_dataset_versions_confidence_valid
    CHECK (confidence IN ('provisional', 'established', 'high')),

  -- Confidence is derived, not chosen. It must agree with the sample size, or
  -- a dataset could claim more authority than it has.
  -- Mirrors datasetConfidence() in lib/scoring/core/formulas.ts.
  CONSTRAINT scoring_dataset_versions_confidence_consistent
    CHECK (
      confidence = CASE
        WHEN eligible_sample_size >= 1000 THEN 'high'
        WHEN eligible_sample_size >= 250  THEN 'established'
        ELSE 'provisional'
      END
    ),

  CONSTRAINT scoring_dataset_versions_sample_size_min
    CHECK (eligible_sample_size >= 30),

  -- Lowercase hex SHA-256, exactly 64 characters (SHA256_HEX_PATTERN).
  CONSTRAINT scoring_dataset_versions_hash_format
    CHECK (dataset_hash ~ '^[0-9a-f]{64}$'),

  -- Both axes must describe the same population, and that population must be
  -- exactly eligible_sample_size athletes.
  CONSTRAINT scoring_dataset_versions_references_aligned
    CHECK (
      array_length(strength_reference, 1) = array_length(endurance_reference, 1)
      AND array_length(strength_reference, 1) = eligible_sample_size
    ),

  -- Every reference value must be a real index value. NULL members are
  -- rejected explicitly because `x <= ALL(array)` is NULL-tolerant.
  CONSTRAINT scoring_dataset_versions_references_valid
    CHECK (
      array_position(strength_reference, NULL) IS NULL
      AND array_position(endurance_reference, NULL) IS NULL
      AND 0 <= ALL (strength_reference) AND 100 >= ALL (strength_reference)
      AND 0 <= ALL (endurance_reference) AND 100 >= ALL (endurance_reference)
    ),

  CONSTRAINT scoring_dataset_versions_activated_when_active
    CHECK (lifecycle <> 'active' OR activated_at IS NOT NULL),
  CONSTRAINT scoring_dataset_versions_frozen_when_active
    CHECK (lifecycle = 'draft' OR frozen = true)
);

-- Labels and hashes are unique per scoring version.
CREATE UNIQUE INDEX IF NOT EXISTS scoring_dataset_versions_label_key
  ON public.scoring_dataset_versions (score_version, label);

CREATE UNIQUE INDEX IF NOT EXISTS scoring_dataset_versions_hash_key
  ON public.scoring_dataset_versions (score_version, dataset_hash);

-- At most ONE active dataset per scoring version.
CREATE UNIQUE INDEX IF NOT EXISTS scoring_dataset_versions_one_active
  ON public.scoring_dataset_versions (score_version)
  WHERE lifecycle = 'active';

-- -----------------------------------------------------------------------------
-- Immutability: once frozen, the scoring content of a version can never change.
-- Only the lifecycle transition columns may move (draft -> active -> retired).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scoring_dataset_versions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.frozen OR OLD.lifecycle <> 'draft' THEN
      RAISE EXCEPTION 'scoring dataset version % is immutable and cannot be deleted', OLD.id
        USING ERRCODE = '2F004';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.frozen THEN
    IF NEW.id                  IS DISTINCT FROM OLD.id
       OR NEW.label            IS DISTINCT FROM OLD.label
       OR NEW.kind             IS DISTINCT FROM OLD.kind
       OR NEW.score_version    IS DISTINCT FROM OLD.score_version
       OR NEW.strength_reference  IS DISTINCT FROM OLD.strength_reference
       OR NEW.endurance_reference IS DISTINCT FROM OLD.endurance_reference
       OR NEW.eligible_sample_size IS DISTINCT FROM OLD.eligible_sample_size
       OR NEW.source_counts    IS DISTINCT FROM OLD.source_counts
       OR NEW.dataset_hash     IS DISTINCT FROM OLD.dataset_hash
       OR NEW.confidence       IS DISTINCT FROM OLD.confidence
       OR NEW.created_at       IS DISTINCT FROM OLD.created_at
       OR NEW.frozen           IS DISTINCT FROM OLD.frozen
    THEN
      RAISE EXCEPTION 'scoring dataset version % is frozen; only lifecycle transitions are allowed', OLD.id
        USING ERRCODE = '2F004';
    END IF;
  END IF;

  -- Lifecycle may only move forward: draft -> active -> retired.
  IF OLD.lifecycle = 'retired' AND NEW.lifecycle <> 'retired' THEN
    RAISE EXCEPTION 'retired scoring dataset version % cannot be reactivated', OLD.id
      USING ERRCODE = '2F004';
  END IF;
  IF OLD.lifecycle = 'active' AND NEW.lifecycle = 'draft' THEN
    RAISE EXCEPTION 'active scoring dataset version % cannot return to draft', OLD.id
      USING ERRCODE = '2F004';
  END IF;

  IF NEW.lifecycle = 'active' AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;
  IF NEW.lifecycle = 'retired' AND NEW.retired_at IS NULL THEN
    NEW.retired_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scoring_dataset_versions_guard_trg
  ON public.scoring_dataset_versions;

CREATE TRIGGER scoring_dataset_versions_guard_trg
  BEFORE UPDATE OR DELETE ON public.scoring_dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.scoring_dataset_versions_guard();

-- -----------------------------------------------------------------------------
-- Access control: server-owned. RLS is enabled with NO policies, so every
-- non-superuser role (anon, authenticated) is denied outright. `service_role`
-- bypasses RLS and is the only way in — i.e. server code only.
-- -----------------------------------------------------------------------------
ALTER TABLE public.scoring_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_dataset_versions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scoring_dataset_versions FROM PUBLIC;
REVOKE ALL ON TABLE public.scoring_dataset_versions FROM anon, authenticated;
GRANT ALL ON TABLE public.scoring_dataset_versions TO service_role;

COMMENT ON TABLE public.scoring_dataset_versions IS
  'Immutable, server-owned reference populations. One active version per score_version. Never readable or writable by public clients.';
COMMENT ON COLUMN public.scoring_dataset_versions.kind IS
  'observed = governed approved public v2 results. legacy_mixed_provisional = pre-governance rows of unknown real/simulated origin; transitional bootstrap only, must be disclosed to users, never presented as verified.';
COMMENT ON COLUMN public.scoring_dataset_versions.dataset_hash IS
  'SHA-256 of buildDatasetHashPayload() in lib/scoring/core/hashing.ts: score version, dataset kind, eligible sample size, and both reference arrays sorted ascending. Re-verified on every load.';

COMMIT;

-- =============================================================================
-- Intentionally NOT included: any INSERT that creates a dataset version.
-- Draft versions are produced by scripts/createScoringDatasetVersion.ts and
-- activated by hand. See docs/group-2-migration-runbook.md.
-- =============================================================================
