// SHA-256 over the canonical payloads defined in lib/scoring/core/hashing.
//
// The payload FORMAT is domain knowledge and lives in the pure module; only the
// digest lives here, so the scoring domain stays runtime-agnostic and there is
// exactly one hash implementation shared by the API, the dataset builder, and
// the bootstrap tool.

import { createHash } from "node:crypto";
import {
  buildDatasetHashPayload,
  buildRequestFingerprintPayload,
  type DatasetHashInput,
  type RequestFingerprintInput,
} from "@/lib/scoring/core";

/** Lowercase hex, 64 characters — matches SHA256_HEX_PATTERN. */
export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Fingerprint of a scoring request's INPUTS. Two requests with the same
 * idempotency key must produce the same fingerprint, or the second one is a key
 * collision rather than a retry.
 */
export function computeRequestFingerprint(
  input: RequestFingerprintInput,
): string {
  return sha256Hex(buildRequestFingerprintPayload(input));
}

/** Content hash of a reference population. */
export function computeDatasetHash(input: DatasetHashInput): string {
  return sha256Hex(buildDatasetHashPayload(input));
}
