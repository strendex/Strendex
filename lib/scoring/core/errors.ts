// Typed, client-safe scoring errors.
//
// PURE MODULE — no database, HTTP, environment, or React dependencies.
// Codes are stable API surface: transports map them to status codes, never the
// other way around. Messages are safe to show a user and never echo raw input.

export const SCORING_ERROR_CODES = [
  "INVALID_BODY",
  "UNKNOWN_FIELD",
  "MISSING_FIELD",
  "MISSING_EVENT",
  "INVALID_NUMBER",
  "OUT_OF_RANGE",
  "IMPLAUSIBLE_RATIO",
  "UNSUPPORTED_UNIT_SYSTEM",
  "UNSUPPORTED_DISTANCE",
  "INVALID_VISIBILITY",
  "INVALID_DISPLAY_NAME",
  "INVALID_IDEMPOTENCY_KEY",
  "DATASET_INSUFFICIENT",
  "DATASET_UNAVAILABLE",
  "SCORE_VERSION_MISMATCH",
] as const;

export type ScoringErrorCode = (typeof SCORING_ERROR_CODES)[number];

export class ScoringError extends Error {
  readonly code: ScoringErrorCode;
  /** Which input the error refers to. Never contains a submitted value. */
  readonly field?: string;

  constructor(code: ScoringErrorCode, message: string, field?: string) {
    super(message);
    this.name = "ScoringError";
    this.code = code;
    this.field = field;
  }
}

export function isScoringError(value: unknown): value is ScoringError {
  return value instanceof ScoringError;
}
