// Keeps share-link data out of PostHog (Group 4).
//
// A calculator share link carries the athlete's name and raw numbers in its
// query string (/tool?name=…&bw=…). PostHog records page URLs, so without this
// a recipient opening the link would send that data to a third party.
//
// Two layers, both configured in instrumentation-client.ts:
//  1. At source: the SDK's own mask_personal_data_properties +
//     custom_personal_data_properties(SHARE_LINK_PARAMS) masks these values in
//     $current_url and in the stored first-touch URL (which also feeds the
//     $initial_* properties and the feature-flag request's person properties).
//  2. At send: sanitizeCaptureResult (before_send) strips the query string and
//     fragment from every URL-valued property of each captured event —
//     $current_url, $referrer, $session_entry_*, $initial_*, and $set/$set_once.
//
// Not claimed: session replay, which is not enabled in code and is not covered
// by this module.
//
// PURE MODULE — no DOM access; safe to unit test.

import type { CaptureResult } from "posthog-js";

/** Query parameters written by the calculator's share link (app/tool/page.tsx). */
export const SHARE_LINK_PARAMS = ["name", "bw", "b", "s", "d", "u", "dist", "t"] as const;

const URL_KEY = /(url|referrer|href|pathname)$/i;
const MAX_DEPTH = 4;

/** `https://h/p?q#f` → `https://h/p`. Non-URLs are returned unchanged. */
export function stripQueryAndFragment(value: string, keyLooksLikeUrl = false): string {
  if (!value.includes("?") && !value.includes("#")) return value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return value.split(/[?#]/)[0];
    }
  }
  // A relative path under a URL-ish key (e.g. "/tool?name=…").
  if (keyLooksLikeUrl && value.startsWith("/")) return value.split(/[?#]/)[0];
  return value;
}

function sanitizeValue(value: unknown, key: string, depth: number): unknown {
  if (typeof value === "string") return stripQueryAndFragment(value, URL_KEY.test(key) || key === "u" || key === "r");
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, key, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeValue(v, k, depth + 1);
  return out;
}

/** before_send hook: returns a copy with URL query strings and fragments removed. */
export function sanitizeCaptureResult(cr: CaptureResult | null): CaptureResult | null {
  if (!cr) return cr;
  return {
    ...cr,
    properties: sanitizeValue(cr.properties, "properties", 0) as CaptureResult["properties"],
    ...(cr.$set ? { $set: sanitizeValue(cr.$set, "$set", 0) as CaptureResult["$set"] } : {}),
    ...(cr.$set_once ? { $set_once: sanitizeValue(cr.$set_once, "$set_once", 0) as CaptureResult["$set_once"] } : {}),
  };
}
