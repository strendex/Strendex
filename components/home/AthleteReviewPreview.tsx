"use client";

/**
 * Section 5 — the deeper product, presented as a report.
 *
 * Not a locked card, not a glow, not a pricing block. A document-style preview:
 * a header rule, analysis sections, one highlighted insight, and the
 * continuation cropped by a mask so the report reads as longer than the excerpt.
 *
 * Copy describes only what the review currently produces. Marketing link only —
 * it builds no snapshot and touches no review pipeline. That remains the job of
 * components/AthleteReviewCTA.tsx on the results screen.
 */

import CtaButton from "./CtaButton";
import { DEMO, REVIEW_SECTIONS } from "./demo-data";
import { Reveal } from "./motion";

export default function AthleteReviewPreview() {
  return (
    <section className="py-[clamp(56px,7vw,104px)]">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center lg:gap-24">
        <Reveal>
          <div className="max-w-[32rem]">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">
              Athlete Review
            </p>
            <h2 className="mt-5 text-balance text-[clamp(27px,3vw,38px)] font-semibold leading-[1.14] tracking-[-0.025em] text-ink">
              Go deeper than the score.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.65] text-lead sm:text-[17px]">
              A short guided assessment turns your result into a written review:
              where you stand, the one change most likely to move your score,
              what to keep doing, and score scenarios calculated from your own
              numbers. Free during early access.
            </p>
            <div className="mt-9">
              <CtaButton href="/athlete-review" tone="secondary">
                Explore Athlete Review
              </CtaButton>
            </div>
          </div>
        </Reveal>

        {/* Report excerpt */}
        <Reveal delay={0.1}>
          <div className="relative">
            <div className="[mask-image:linear-gradient(to_bottom,#000_66%,transparent_98%)]">
              <div className="flex items-baseline justify-between border-b border-white/12 pb-4">
                <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-lead">
                  Athlete Review
                </span>
                <span className="text-[12px] text-subtle">
                  {DEMO.name} · Hybrid Score {DEMO.hybridScore}
                </span>
              </div>

              {REVIEW_SECTIONS.map((section) => {
                const highlighted = "highlight" in section && section.highlight;
                return (
                  <div
                    key={section.title}
                    className={`border-b border-white/[0.07] py-6 ${
                      highlighted ? "border-l-2 border-l-accent pl-5" : ""
                    }`}
                  >
                    <div
                      className={`text-[15px] ${
                        highlighted ? "font-semibold text-ink" : "font-medium text-lead"
                      }`}
                    >
                      {section.title}
                    </div>
                    <p className="mt-2 max-w-[46ch] text-[14px] leading-[1.6] text-subtle">
                      {section.summary}
                    </p>
                    {/* Body of the section, suggested rather than faked as text */}
                    <div className="mt-4 space-y-2" aria-hidden="true">
                      <span className="block h-px w-full bg-white/[0.07]" />
                      <span className="block h-px w-[92%] bg-white/[0.07]" />
                      <span className="block h-px w-[74%] bg-white/[0.07]" />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-[12px] text-subtle">
              Excerpt from an example review.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
