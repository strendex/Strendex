// Client-side submission pipeline for POST /api/score.
//
// PURE MODULE — no React, no DOM, no environment access. `fetch` and the key
// generator are injected, so the whole flow is exercisable under node:test.
//
// The browser never calculates a result. This module only:
//   * builds ONE request from what the athlete typed, in their own units;
//   * keeps ONE idempotency key per logical submission, and rotates it when the
//     submission changes;
//   * refuses to fire a second request while one is in flight;
//   * turns the route's structured error envelope into copy a person can act
//     on, without ever discarding what they entered.
//
// The validation performed here is a PRE-FLIGHT ONLY. It calls the same
// canonical validator the server runs (parseCanonicalBenchmark), so an
// impossible entry is caught without spending one of the athlete's five
// requests per minute — and the server still re-validates every value from the
// originals, which remain the only thing this module transmits.

import { findBannedWord } from "@/lib/nameFilter";
import {
  ARCHETYPES,
  DATASET_CONFIDENCE_TIERS,
  DATASET_KINDS,
  DEFAULT_VISIBILITY,
  MODERATION_STATUSES,
  PROVENANCES,
  RUN_DISTANCES,
  ScoringError,
  TIERS,
  VALIDATION_BOUNDS,
  VERIFICATION_STATUSES,
  VISIBILITIES,
  kilogramsToPounds,
  parseCanonicalBenchmark,
  parseDisplayName,
  stableStringify,
} from "@/lib/scoring/core";
import type {
  RunDistance,
  UnitSystem,
  Visibility,
} from "@/lib/scoring/core";
import type { CanonicalResultView } from "@/lib/server/scoreService";

/**
 * The saved result exactly as POST /api/score returns it.
 *
 * Type-only re-export: it is erased at build time, so no server module is
 * pulled into the browser bundle, but the compiler still fails if the route's
 * response contract and what the calculator renders ever drift apart.
 */
export type ScoreResultView = CanonicalResultView;

export const SCORE_ENDPOINT = "/api/score";

/**
 * The calculator submits every result publicly — scoring IS entering the
 * leaderboard, and the page says so next to the button. Sent EXPLICITLY: the
 * API's own fallback stays private, so nothing can become public by accident
 * anywhere else, and this constant is the single place the product choice
 * lives.
 */
export const SUBMISSION_VISIBILITY: Visibility = "public";

/**
 * The name used when the athlete leaves the field blank. A plain string the
 * contract already accepts (2–60 chars, clean) — the server's own absent-name
 * fallback ("Anonymous Athlete") is unchanged.
 */
export const ANONYMOUS_NAME = "Anonymous";

/** What the athlete has typed. Weights stay strings so empties survive. */
export type ScoreFormValues = {
  displayName: string;
  unitSystem: UnitSystem;
  bodyweight: string;
  bench: string;
  squat: string;
  deadlift: string;
  runDistance: RunDistance;
  /** Parsed from the run-time field; null while it is empty or unparseable. */
  runSeconds: number | null;
  visibility: Visibility;
};

/** One submission's inputs, in the athlete's ORIGINAL unit system. */
export type ScoreRequestDraft = {
  display_name: string;
  unit_system: UnitSystem;
  bodyweight: number;
  bench: number;
  squat: number;
  deadlift: number;
  run_distance: RunDistance;
  run_seconds: number;
  visibility: Visibility;
};

export type ScoreRequestBody = ScoreRequestDraft & { idempotency_key: string };

export type SubmissionError = {
  /** Stable machine code, from the route envelope or generated locally. */
  code: string;
  /** Safe to show a person. Never echoes a submitted value. */
  message: string;
  /** Which input to point at, when the failure is about one. */
  field?: string;
  /**
   * True when tapping again, with nothing changed, could succeed — a transient
   * or server-side failure. False when the athlete has to adjust an entry
   * first. Either way nothing is cleared: every failure stays recoverable.
   */
  canRetry: boolean;
};

export type SubmissionOutcome =
  | { status: "ok"; result: ScoreResultView; replayed: boolean }
  | { status: "error"; error: SubmissionError }
  /** A request was already in flight; this click did nothing. */
  | { status: "busy" };

// --- Draft building ----------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  display_name: "Display name",
  bodyweight: "Bodyweight",
  bench: "Bench",
  squat: "Squat",
  deadlift: "Deadlift",
  run_distance: "Run distance",
  run_seconds: "Run time",
  visibility: "Visibility",
};

function label(field: string | undefined): string {
  return (field && FIELD_LABELS[field]) || "That entry";
}

/**
 * Failures the athlete has to fix before trying again. Everything not listed —
 * an unavailable dataset, a rate limit, a network drop, an internal error — can
 * succeed on an unchanged retry, which is exactly what the stored idempotency
 * key makes safe.
 */
const NEEDS_AN_EDIT: ReadonlySet<string> = new Set([
  "MISSING_EVENT",
  "MISSING_FIELD",
  "OUT_OF_RANGE",
  "INVALID_NUMBER",
  "IMPLAUSIBLE_RATIO",
  "INVALID_DISPLAY_NAME",
  "UNSUPPORTED_DISTANCE",
  "UNSUPPORTED_UNIT_SYSTEM",
  "INVALID_VISIBILITY",
  "INVALID_BODY",
  "UNKNOWN_FIELD",
  "PAYLOAD_TOO_LARGE",
]);

function parseWeightField(
  raw: string,
  field: string,
): { ok: true; value: number } | { ok: false; error: SubmissionError } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: "MISSING_EVENT",
        field,
        message: `${label(field)} is required for a ranked result.`,
        canRetry: false,
      },
    };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_NUMBER",
        field,
        message: `${label(field)} must be a number greater than zero.`,
        canRetry: false,
      },
    };
  }

  return { ok: true, value };
}

/** Range hint in the athlete's own units, derived from the canonical bounds. */
function rangeHint(field: string, unitSystem: UnitSystem): string | null {
  const bounds =
    field === "bodyweight"
      ? VALIDATION_BOUNDS.bodyweightKg
      : field === "bench"
        ? VALIDATION_BOUNDS.benchKg
        : field === "squat"
          ? VALIDATION_BOUNDS.squatKg
          : field === "deadlift"
            ? VALIDATION_BOUNDS.deadliftKg
            : null;

  if (!bounds) return null;

  const min =
    unitSystem === "kg" ? bounds.min : Math.ceil(kilogramsToPounds(bounds.min));
  const max =
    unitSystem === "kg" ? bounds.max : Math.floor(kilogramsToPounds(bounds.max));

  return `${min}–${max} ${unitSystem}`;
}

/**
 * Turn a ScoringError — raised by the shared validator here, or reconstructed
 * from the route's error envelope — into copy the athlete can act on.
 */
export function describeScoringFailure(
  code: string,
  serverMessage: string,
  field: string | undefined,
  unitSystem: UnitSystem,
): SubmissionError {
  // Anything about a submitted value needs an edit before it can succeed;
  // everything else is transient and a plain retry may work.
  const needsAnEdit = NEEDS_AN_EDIT.has(code);
  const base = { code, field, canRetry: !needsAnEdit };

  switch (code) {
    case "MISSING_EVENT":
    case "MISSING_FIELD":
      return {
        ...base,
        message: `${label(field)} is required for a ranked result.`,
      };

    case "OUT_OF_RANGE": {
      const hint = field ? rangeHint(field, unitSystem) : null;
      return {
        ...base,
        message: hint
          ? `${label(field)} must be between ${hint}.`
          : `${label(field)} is outside the supported range.`,
      };
    }

    case "INVALID_NUMBER":
      return { ...base, message: `${label(field)} must be a valid number.` };

    case "IMPLAUSIBLE_RATIO":
      return {
        ...base,
        message: `That ${label(field).toLowerCase()} is very high for the bodyweight entered. Double-check both numbers.`,
      };

    case "INVALID_DISPLAY_NAME":
      return {
        ...base,
        message: "Please choose a different display name.",
        field: "display_name",
      };

    case "UNSUPPORTED_DISTANCE":
      return { ...base, message: "Choose one of the listed run distances." };

    case "UNSUPPORTED_UNIT_SYSTEM":
      return { ...base, message: "Choose either pounds or kilograms." };

    // Unreachable in practice — the calculator always sends a valid, explicit
    // visibility — but there is no chooser any more, so the copy must not send
    // the athlete looking for one.
    case "INVALID_VISIBILITY":
      return {
        ...base,
        field: undefined,
        message:
          "We couldn't send that submission correctly. Your entries are still here — please try again.",
      };

    case "IDEMPOTENCY_CONFLICT":
      return {
        ...base,
        field: undefined,
        message:
          "Your entries changed since the last attempt. Your numbers are still here — tap again to score them.",
      };

    case "INVALID_IDEMPOTENCY_KEY":
      return {
        ...base,
        field: undefined,
        message: "Something went wrong starting that submission. Try again.",
      };

    // Request-shape failures are this app's bug, not the athlete's. The route's
    // own wording ("Content-Type must be application/json") must never be shown
    // to a person, and there is no entry for them to correct.
    case "INVALID_BODY":
    case "UNKNOWN_FIELD":
      return {
        ...base,
        field: undefined,
        message:
          "We couldn't send that submission correctly. Your entries are still here — please try again, or reload the page if it keeps happening.",
      };

    case "DATASET_UNAVAILABLE":
    case "DATASET_INSUFFICIENT":
    case "DATASET_CORRUPT":
    case "SCORE_VERSION_MISMATCH":
      return {
        ...base,
        field: undefined,
        message:
          "Scoring is temporarily unavailable. Your entries are still here — please try again shortly.",
      };

    case "RATE_LIMITED":
      return {
        ...base,
        field: undefined,
        // The route's own message says how long to wait.
        message: serverMessage || "Too many requests. Please wait a minute.",
      };

    case "PAYLOAD_TOO_LARGE":
      return {
        ...base,
        field: undefined,
        message: "That submission was too large to send.",
      };

    case "NETWORK":
      return {
        ...base,
        field: undefined,
        message:
          "We couldn't reach the scoring service. Your entries are still here — check your connection and try again.",
      };

    default:
      return {
        ...base,
        field: undefined,
        message:
          serverMessage ||
          "Something went wrong. Your entries are still here — please try again.",
      };
  }
}

/**
 * Validate what the athlete typed and produce the request body.
 *
 * Sends the ORIGINAL values and unit system. No conversion, no Riegel
 * normalisation, and no score is computed in the browser.
 */
export function buildScoreRequestDraft(
  values: ScoreFormValues,
): { ok: true; draft: ScoreRequestDraft } | { ok: false; error: SubmissionError } {
  const weights: Array<[keyof ScoreFormValues & string, string]> = [
    ["bodyweight", values.bodyweight],
    ["bench", values.bench],
    ["squat", values.squat],
    ["deadlift", values.deadlift],
  ];

  const parsed: Record<string, number> = {};
  for (const [field, raw] of weights) {
    const result = parseWeightField(raw, field);
    if (!result.ok) return { ok: false, error: result.error };
    parsed[field] = result.value;
  }

  if (values.runSeconds === null) {
    return {
      ok: false,
      error: {
        code: "MISSING_EVENT",
        field: "run_seconds",
        message: "Enter your run time as mm:ss or hh:mm:ss.",
        canRetry: false,
      },
    };
  }

  if (!(values.runDistance in RUN_DISTANCES)) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_DISTANCE",
        field: "run_distance",
        message: "Choose one of the listed run distances.",
        canRetry: false,
      },
    };
  }

  // The canonical validator, not a browser copy of it. Anything it rejects the
  // server would reject too, so this costs the athlete nothing but a round trip.
  let displayName: string;
  try {
    // A blank field becomes "Anonymous" — decided here, not left to the
    // server's absent-name fallback, so the leaderboard name is deliberate
    // and part of the fingerprinted request.
    displayName = parseDisplayName(
      values.displayName.trim() ? values.displayName : ANONYMOUS_NAME,
    );
    parseCanonicalBenchmark({
      unitSystem: values.unitSystem,
      bodyweight: parsed.bodyweight,
      bench: parsed.bench,
      squat: parsed.squat,
      deadlift: parsed.deadlift,
      runDistance: values.runDistance,
      runSeconds: values.runSeconds,
    });
  } catch (error) {
    if (error instanceof ScoringError) {
      return {
        ok: false,
        error: describeScoringFailure(
          error.code,
          error.message,
          error.field,
          values.unitSystem,
        ),
      };
    }
    throw error;
  }

  if (findBannedWord(displayName)) {
    return {
      ok: false,
      error: {
        code: "INVALID_DISPLAY_NAME",
        field: "display_name",
        message: "Please choose a different display name.",
        canRetry: false,
      },
    };
  }

  return {
    ok: true,
    draft: {
      display_name: displayName,
      unit_system: values.unitSystem,
      bodyweight: parsed.bodyweight,
      bench: parsed.bench,
      squat: parsed.squat,
      deadlift: parsed.deadlift,
      run_distance: values.runDistance,
      run_seconds: values.runSeconds,
      visibility: values.visibility ?? DEFAULT_VISIBILITY,
    },
  };
}

// --- Idempotency -------------------------------------------------------------

export type IdempotencyRecord = { signature: string; key: string };

/**
 * Identity of a logical submission: every field the server folds into its
 * request fingerprint, and nothing else. Two drafts with the same signature are
 * the same submission, so they may share a key; anything else must not.
 */
export function submissionSignature(draft: ScoreRequestDraft): string {
  return stableStringify(draft);
}

function randomToken(): string {
  const webCrypto = globalThis.crypto;

  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/** Url-safe, well inside the route's 8–128 character window. */
export function newIdempotencyKey(): string {
  return `sx-${randomToken()}`;
}

/**
 * One key per logical submission.
 *
 * Same inputs as last time -> the same key, so a retry after a timeout replays
 * the stored result instead of creating a second row. Any input changed -> a
 * new key, because reusing one for different inputs is a 409 by design.
 */
export function resolveIdempotency(
  previous: IdempotencyRecord | null,
  draft: ScoreRequestDraft,
  makeKey: () => string = newIdempotencyKey,
): IdempotencyRecord {
  const signature = submissionSignature(draft);
  if (previous && previous.signature === signature) return previous;
  return { signature, key: makeKey() };
}

// --- Response parsing --------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function member<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Read the saved result out of a response body, FAIL CLOSED.
 *
 * A response missing a field is not patched up with an input or a default —
 * there is nothing here that could stand in for a server-owned value, so an
 * unreadable payload becomes an error the athlete can retry.
 */
export function parseScoreResponse(
  payload: unknown,
): { result: ScoreResultView; replayed: boolean } | null {
  if (!isRecord(payload) || !isRecord(payload.result)) return null;
  const raw = payload.result;

  const resultId = str(raw.resultId);
  const hybridScore = num(raw.hybridScore);
  const strengthIndex = num(raw.strengthIndex);
  const enduranceIndex = num(raw.enduranceIndex);
  const strengthPercentile = num(raw.strengthPercentile);
  const endurancePercentile = num(raw.endurancePercentile);
  const tier = member(raw.tier, TIERS);
  const archetype = member(raw.archetype, ARCHETYPES);
  const moderationStatus = member(raw.moderationStatus, MODERATION_STATUSES);
  const verificationStatus = member(raw.verificationStatus, VERIFICATION_STATUSES);
  const provenance = member(raw.provenance, PROVENANCES);
  const visibility = member(raw.visibility, VISIBILITIES);
  const scoreVersion = str(raw.scoreVersion);
  const datasetVersionId = str(raw.datasetVersionId);
  const datasetLabel = str(raw.datasetLabel);
  const datasetKind = member(raw.datasetKind, DATASET_KINDS);
  const datasetSampleSize = num(raw.datasetSampleSize);
  const datasetConfidence = member(raw.datasetConfidence, DATASET_CONFIDENCE_TIERS);
  const calculatedAt = str(raw.calculatedAt);

  if (
    resultId === null ||
    hybridScore === null ||
    strengthIndex === null ||
    enduranceIndex === null ||
    strengthPercentile === null ||
    endurancePercentile === null ||
    tier === null ||
    archetype === null ||
    moderationStatus === null ||
    verificationStatus === null ||
    provenance === null ||
    visibility === null ||
    scoreVersion === null ||
    datasetVersionId === null ||
    datasetLabel === null ||
    datasetKind === null ||
    datasetSampleSize === null ||
    datasetConfidence === null ||
    calculatedAt === null
  ) {
    return null;
  }

  let leaderboard: ScoreResultView["leaderboard"] = null;
  if (raw.leaderboard !== null && raw.leaderboard !== undefined) {
    if (!isRecord(raw.leaderboard)) return null;
    const rank = num(raw.leaderboard.rank);
    const total = num(raw.leaderboard.total);
    if (rank === null || total === null) return null;
    leaderboard = { rank, total };
  }

  return {
    replayed: payload.idempotentReplay === true,
    result: {
      resultId,
      hybridScore,
      strengthIndex,
      enduranceIndex,
      strengthPercentile,
      endurancePercentile,
      tier,
      archetype,
      moderationStatus,
      verificationStatus,
      provenance,
      visibility,
      scoreVersion,
      datasetVersionId,
      datasetLabel,
      datasetKind,
      datasetSampleSize,
      datasetConfidence,
      calculatedAt,
      leaderboard,
    },
  };
}

function readErrorEnvelope(payload: unknown): {
  code: string;
  message: string;
  field?: string;
} {
  if (isRecord(payload) && isRecord(payload.error)) {
    return {
      code: str(payload.error.code) ?? "INTERNAL",
      message: str(payload.error.message) ?? "",
      field: str(payload.error.field) ?? undefined,
    };
  }
  return { code: "INTERNAL", message: "" };
}

// --- The one request ---------------------------------------------------------

/** Mutable, caller-owned. The calculator keeps exactly one in a ref. */
export type SubmissionSession = {
  inFlight: boolean;
  idempotency: IdempotencyRecord | null;
};

export function createSubmissionSession(): SubmissionSession {
  return { inFlight: false, idempotency: null };
}

export type SubmitOptions = {
  fetchImpl?: typeof fetch;
  makeKey?: () => string;
};

/**
 * The single request the calculator makes.
 *
 * Refuses to start while one is in flight, so a double click cannot produce two
 * submissions. The athlete's inputs are never touched here — a failure returns
 * an error and leaves both the form and the stored key alone, so tapping again
 * retries the identical submission rather than creating a second one.
 */
export async function submitScore(
  session: SubmissionSession,
  draft: ScoreRequestDraft,
  options: SubmitOptions = {},
): Promise<SubmissionOutcome> {
  if (session.inFlight) return { status: "busy" };

  // Called through a wrapper: some engines reject a `fetch` reference that has
  // been detached from the global object.
  const fetchImpl =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init));

  session.inFlight = true;

  try {
    const record = resolveIdempotency(
      session.idempotency,
      draft,
      options.makeKey ?? newIdempotencyKey,
    );
    session.idempotency = record;

    const body: ScoreRequestBody = { ...draft, idempotency_key: record.key };

    let response: Response;
    try {
      response = await fetchImpl(SCORE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return {
        status: "error",
        error: describeScoringFailure("NETWORK", "", undefined, draft.unit_system),
      };
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const envelope = readErrorEnvelope(payload);
      const error = describeScoringFailure(
        envelope.code,
        envelope.message,
        envelope.field,
        draft.unit_system,
      );

      // The stored key belongs to a different submission, so the next attempt
      // must not reuse it. Nothing the athlete entered is discarded.
      if (envelope.code === "IDEMPOTENCY_CONFLICT") {
        session.idempotency = null;
      }

      return { status: "error", error };
    }

    const parsed = parseScoreResponse(payload);
    if (!parsed) {
      return {
        status: "error",
        error: {
          code: "MALFORMED_RESPONSE",
          message:
            "We couldn't read the result that came back. Your entries are still here — please try again.",
          canRetry: true,
        },
      };
    }

    return { status: "ok", result: parsed.result, replayed: parsed.replayed };
  } finally {
    session.inFlight = false;
  }
}
