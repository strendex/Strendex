// Global daily cap on Athlete Review OpenAI attempts (Group 4).
//
// A per-IP limit does not bound total spend: many addresses, or simply a busy
// day, can each stay under it. This caps the number of OpenAI ATTEMPTS across
// every server instance per UTC day, using one shared Postgres counter.
//
// It is an attempt cap, not a dollar cap: each attempt is bounded by the
// prompt's validated size and max_output_tokens, but the price per attempt
// depends on the model and the provider's pricing.
//
// Fail closed everywhere: an absent setting means the default; anything that
// is not a non-negative integer disables generation; a counter that errors or
// answers nonsense means no OpenAI call.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Used when ATHLETE_REVIEW_DAILY_CAP is absent. */
export const DEFAULT_REVIEW_DAILY_CAP = 50;

/**
 * The shared counter's key. Per-IP counters are always `<scope>:<ip>` with
 * scope one of rank | submit | score | review (lib/server/rateLimit.ts and the
 * review route), so every one of them starts with `review:`, `score:`, … —
 * never with `review-cap:`. No client-supplied value can produce this key.
 */
export const REVIEW_CAP_KEY = "review-cap:global";

export type ReviewCapConfig =
  | { enabled: true; cap: number }
  | { enabled: false; reason: "disabled" | "invalid" };

/** Absent → default. "0" → disabled. Anything but a plain non-negative integer → invalid. */
export function parseReviewDailyCap(raw: string | undefined): ReviewCapConfig {
  if (raw === undefined) return { enabled: true, cap: DEFAULT_REVIEW_DAILY_CAP };
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return { enabled: false, reason: "invalid" };
  const cap = Number(text);
  if (!Number.isSafeInteger(cap)) return { enabled: false, reason: "invalid" };
  if (cap === 0) return { enabled: false, reason: "disabled" };
  return { enabled: true, cap };
}

/** One shared bucket per UTC calendar day, identical on every instance. */
export function utcDayBucket(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

export type ReviewReservation =
  | { ok: true; used: number }
  | { ok: false; reason: "cap_reached" | "counter_failed" };

/**
 * Reserve one OpenAI attempt: increment the shared counter and allow the call
 * only if the returned count is within the cap. Call this after all validation
 * and immediately before the OpenAI request. Every failure path returns
 * `ok: false`, and the caller must not call OpenAI.
 */
export async function reserveReviewAttempt(
  supabase: SupabaseClient,
  cap: number,
  nowMs: number = Date.now(),
): Promise<ReviewReservation> {
  let data: unknown;
  try {
    const res = await supabase.rpc("ai_rl_hit", {
      p_ip: REVIEW_CAP_KEY,
      p_bucket: "day",
      p_bucket_id: utcDayBucket(nowMs),
    });
    if (res.error) return { ok: false, reason: "counter_failed" };
    data = res.data;
  } catch {
    return { ok: false, reason: "counter_failed" };
  }

  // The counter returns the count INCLUDING this reservation, so it is >= 1.
  const used =
    typeof data === "number"
      ? data
      : typeof data === "string" && /^\d+$/.test(data.trim())
        ? Number(data.trim())
        : Number.NaN;
  if (!Number.isSafeInteger(used) || used < 1) {
    return { ok: false, reason: "counter_failed" };
  }
  if (used > cap) return { ok: false, reason: "cap_reached" };
  return { ok: true, used };
}
