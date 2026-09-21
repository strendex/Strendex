/**
 * Per-archetype diagnostic copy: what the profile is, and which side is
 * holding it back.
 *
 * Extracted verbatim from app/tool/page.tsx so the calculator's result screen
 * and the homepage's worked example read from ONE source. The text is
 * unchanged; only its location moved.
 *
 * This is presentational copy keyed by an engine output — it derives nothing
 * and decides nothing. `getArchetype()` in lib/scoring/core remains the only
 * thing that picks which entry applies.
 */

import type { Archetype } from "@/lib/scoring/core";

export const ARCHETYPE_COPY: Record<
  Archetype,
  { tagline: string; description: string; focus: string }
> = {
  "STRENGTH BEAST": {
    tagline: "Strength-dominant — endurance is the limiter.",
    description:
      "Your strength output is significantly higher than your endurance capacity. You’ll score well off the big lifts, but your endurance is the main thing holding your hybrid profile back.",
    focus:
      "Add 2–3 aerobic sessions/week (easy Zone 2) + 1 short interval day. Keep lifting heavy, but avoid maxing too often.",
  },
  "ENDURANCE MACHINE": {
    tagline: "Endurance-dominant — strength is the limiter.",
    description:
      "Your endurance is strong relative to your strength totals. Your endurance boosts your profile, but adding strength will raise your overall score quickly.",
    focus:
      "Maintain running 2–3 days/week, then push progressive overload on bench/squat/deadlift (2–4 hard sets each, 2–3x/week).",
  },
  "BALANCED HYBRID": {
    tagline: "Well-rounded — strength and endurance are aligned.",
    description:
      "You’re relatively balanced: both strength and endurance contribute similarly. This is the classic hybrid profile.",
    focus:
      "Progress both slowly: 1–2 strength PR attempts/month and 1 structured run workout/week. Avoid huge spikes in total volume.",
  },
  "POWER HYBRID": {
    tagline: "High-high — strong and fast together.",
    description:
      "You’re strong and you’ve got a solid endurance. This profile pushes into elite territory when trained consistently.",
    focus:
      "Keep strength volume efficient (quality over quantity) and add running quality (tempo + intervals). Prioritize recovery and sleep.",
  },
  "ENDURANCE-LEANING HYBRID": {
    tagline: "Endurance-leaning — still decently strong.",
    description:
      "Your endurance is ahead, but you’ve got more strength than the average runner. A focused strength block can raise your score a lot.",
    focus:
      "Keep 2 quality runs/week and add 2–3 strength sessions focused on squat/hinge/press progressions.",
  },
  "STRENGTH-LEANING HYBRID": {
    tagline: "Strength-leaning — still decent endurance.",
    description:
      "Your strength is ahead, but your endurance is not far behind. Building your aerobic base will make you much more complete.",
    focus:
      "Maintain lifting intensity, add 2–3 Zone 2 sessions/week, and retest your endurance time after 4–6 weeks.",
  },
  "BASE BUILDER": {
    tagline: "Early stage — build the foundation.",
    description:
      "You haven’t filled enough stats yet (or they’re very low). The goal is consistent training and clean technique.",
    focus:
      "Start simple: 3 days lifting + 2 days easy running each week. Retest your numbers after 6–8 weeks.",
  },
};
