"use client";

// Premium Athlete Review invitation card, shown after the normal results.
// Builds the sessionStorage snapshot and routes into /athlete-review.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveSnapshot } from "@/lib/athleteReview/snapshot";
import { scoreBand, trackAthleteReview } from "@/lib/athleteReview/analytics";
import type { ResultSnapshotV1 } from "@/lib/athleteReview/types";

export type AthleteReviewCTAProps = {
  hybridScore: number;
  strengthPercentile: number | null;
  endurancePercentile: number | null;
  strengthIndex: number | null;
  enduranceIndex: number | null;
  tier: string;
  archetype: string;
  rank: number | null;
  totalAthletes: number | null;
  betterThanPercent: number | null;
  inputs: ResultSnapshotV1["inputs"];
  emphasized?: boolean;
};

type Variant = "gap" | "balanced" | "incomplete";

function pickVariant(props: AthleteReviewCTAProps): {
  variant: Variant;
  copy: string;
} {
  const { strengthPercentile: sp, endurancePercentile: ep, inputs } = props;
  const missingLifts = [inputs.benchKg, inputs.squatKg, inputs.deadliftKg].filter(
    (v) => v === null,
  ).length;

  if (inputs.enduranceSeconds === null || missingLifts >= 2 || sp === null || ep === null) {
    return {
      variant: "incomplete",
      copy: "Your current score only shows part of the picture. Build your review to see what you should test and improve next.",
    };
  }

  const gap = Math.round(Math.abs(sp - ep));
  if (gap >= 20) {
    return {
      variant: "gap",
      copy: `There is a ${gap}-point difference between your strength and endurance profile. See what that means and the fastest realistic way to address it.`,
    };
  }

  return {
    variant: "balanced",
    copy: "Your profile is balanced. The next step is finding which smaller lever is most likely to move your score.",
  };
}

const PREVIEW_ROWS = [
  { label: "Highest-leverage improvement", teaser: "The one change most likely to move your score" },
  { label: "What you should maintain", teaser: "The habits already carrying your profile" },
  { label: "Estimated score scenarios", teaser: "Deterministic 8-week projections" },
];

export default function AthleteReviewCTA(props: AthleteReviewCTAProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef(false);
  const { variant, copy } = pickVariant(props);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackAthleteReview("athlete_review_cta_viewed", {
      variant,
      score_band: scoreBand(props.hybridScore),
      archetype: props.archetype,
      emphasized: Boolean(props.emphasized),
    });
    // fire once per results render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!props.emphasized) return;
    // Let the tool page's own results scroll settle first.
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1100);
    return () => clearTimeout(t);
  }, [props.emphasized]);

  function handleClick() {
    saveSnapshot({
      inputs: props.inputs,
      display: {
        hybridScore: props.hybridScore,
        strengthPercentile: props.strengthPercentile,
        endurancePercentile: props.endurancePercentile,
        strengthIndex: props.strengthIndex,
        enduranceIndex: props.enduranceIndex,
        tier: props.tier,
        archetype: props.archetype,
        rank: props.rank,
        totalAthletes: props.totalAthletes,
        betterThanPercent: props.betterThanPercent,
      },
    });
    trackAthleteReview("athlete_review_cta_clicked", {
      variant,
      score_band: scoreBand(props.hybridScore),
      archetype: props.archetype,
    });
    router.push("/athlete-review");
  }

  return (
    <div
      ref={cardRef}
      className={`mt-5 rounded-3xl border bg-white/[0.03] p-6 transition ${
        props.emphasized ? "border-white/30" : "border-white/10"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
        New · Athlete Review
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-white">
        Your score shows where you stand. Now uncover what will move it.
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{copy}</p>

      <div className="mt-4 space-y-2" aria-label="Included in your review">
        {PREVIEW_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white/80">{row.label}</div>
              <div
                aria-hidden="true"
                className="mt-0.5 truncate text-xs text-white/45 blur-[3px] select-none"
              >
                {row.teaser}
              </div>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 text-white/35"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="mt-5 w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
      >
        Reveal My Fastest Path
      </button>
      <p className="mt-2.5 text-center text-[11px] text-white/40">
        3–5 minutes · Personalized from your score, training, goals and recovery
        · Free
      </p>
    </div>
  );
}
