import posthog from "posthog-js";
import { SHARE_LINK_PARAMS, sanitizeCaptureResult } from "@/lib/analytics/sanitize";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2025-05-24",
    // Share links carry a name and raw numbers in the query string. Mask them
    // at source (also covers the stored first-touch URL and the flags request)
    // and strip every URL's query/fragment before each event is sent.
    mask_personal_data_properties: true,
    custom_personal_data_properties: [...SHARE_LINK_PARAMS],
    before_send: sanitizeCaptureResult,
  });
}
