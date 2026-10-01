// PostHog helpers for the Athlete Review flow. Client-only.
// Never send free-text answers, names, or raw AI output — coarse properties only.
// Analytics failures must never break the experience.

import posthog from "posthog-js";

export function trackAthleteReview(
  event: string,
  props?: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, props);
  } catch {
    // Analytics must never break the UX.
  }
}

/**
 * Tracks athlete_review_result_viewed — the top of the Athlete Review funnel —
 * once per saved result. Rerenders and replays of the same result are ignored.
 */
export function createResultViewTracker(track = trackAthleteReview) {
  let lastResultId: string | null = null;
  return (resultId: string, props: { score_band: string; archetype: string }) => {
    if (resultId === lastResultId) return;
    lastResultId = resultId;
    track("athlete_review_result_viewed", props);
  };
}

export function scoreBand(score: number): string {
  const decile = Math.min(90, Math.max(0, Math.floor(score / 10) * 10));
  return `${decile}-${decile + 9}`;
}
