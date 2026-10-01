"use client";

// Athlete Review invitation, shown directly under the key result tiles.
// Builds the sessionStorage snapshot and routes into /athlete-review.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveSnapshot } from "@/lib/athleteReview/snapshot";
import { scoreBand, trackAthleteReview } from "@/lib/athleteReview/analytics";
import { CTA_PREVIEW_ROWS, ctaTension } from "@/lib/athleteReview/entryCopy";
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
  /** From the SAVED result: the benchmark it was scored against. */
  benchmark: ResultSnapshotV1["benchmark"];
  emphasized?: boolean;
};

export default function AthleteReviewCTA(props: AthleteReviewCTAProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement | null>(null);
  const viewedRef = useRef(false);
  const { variant, copy } = ctaTension(props);

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
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      cardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }, 1100);
    return () => clearTimeout(t);
  }, [props.emphasized]);

  function handleClick() {
    saveSnapshot({
      inputs: props.inputs,
      benchmark: props.benchmark,
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
    <section
      ref={cardRef}
      aria-labelledby="athlete-review-cta-heading"
      className={`mt-5 rounded-2xl border bg-black/20 p-5 sm:p-6 ${
        props.emphasized ? "border-white/25" : "border-white/10"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
        Athlete Review
      </div>
      <h3
        id="athlete-review-cta-heading"
        className="mt-3 text-lg font-semibold leading-snug text-white"
      >
        Your score shows where you stand. What would move it most?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{copy}</p>

      <ol
        aria-label="What your Athlete Review covers"
        className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]"
      >
        {CTA_PREVIEW_ROWS.map((row, i) => (
          <li key={row.title} className="flex gap-4 py-3.5">
            <span
              aria-hidden="true"
              className="w-5 shrink-0 pt-px text-[11px] font-medium tabular-nums text-white/35"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{row.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/50">
                {row.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-white/50">
        Your lifts, run, score and profile are already loaded. Add your training,
        goals and recovery.
      </p>

      <button
        type="button"
        onClick={handleClick}
        className="mt-4 w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014]"
      >
        Build my Athlete Review
      </button>
      <p className="mt-2.5 text-center text-[11px] text-white/40">
        Free · uses your existing results
      </p>
    </section>
  );
}
