// Shared server-side rate limiting.
//
// Backed by the existing `ai_rl_hit(p_ip, p_bucket, p_bucket_id)` Postgres
// function, called with exactly the same "<scope>:<ip>" key format the routes
// have always used — so extracting this helper does not reset, merge, or
// otherwise weaken any live counter.
//
// The quota is consumed by calling this; cheap request-shape checks that should
// NOT cost a request (content type, body size) belong before it.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitScope = "rank" | "submit" | "score" | "review";

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; reason: string; bucket: "minute" | "day" };

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function hit(
  supabase: SupabaseClient,
  key: string,
  bucket: "minute" | "day",
  bucketId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("ai_rl_hit", {
    p_ip: key,
    p_bucket: bucket,
    p_bucket_id: bucketId,
  });

  if (error) throw error;

  return Number(data) || 0;
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  options: {
    scope: RateLimitScope;
    ip: string;
    perMinute: number;
    perDay: number;
    minuteMessage: string;
    dayMessage: string;
  },
): Promise<RateLimitDecision> {
  const key = `${options.scope}:${options.ip}`;
  const t = nowUnixSeconds();

  const minute = await hit(supabase, key, "minute", Math.floor(t / 60));
  if (minute > options.perMinute) {
    return { ok: false, reason: options.minuteMessage, bucket: "minute" };
  }

  const day = await hit(supabase, key, "day", Math.floor(t / 86400));
  if (day > options.perDay) {
    return { ok: false, reason: options.dayMessage, bucket: "day" };
  }

  return { ok: true };
}
