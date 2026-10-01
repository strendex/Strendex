"use client";

/**
 * Section 5 — Athlete Review, shown as one excerpt from a report.
 *
 * Not a locked card, not a glow, not a pricing block. The excerpt leads with a
 * single score scenario for the fictional homepage athlete — labelled EXAMPLE
 * — then the two findings a review would draw from it, then the rest of the
 * report as plain contents.
 *
 * Every number is a static constant pinned to the scoring engine by
 * tests/homepageAthleteReview.test.ts. This component scores nothing, calls no
 * API, and builds no snapshot; that remains the job of
 * components/AthleteReviewCTA.tsx on the results screen.
 *
 * Mobile order is copy → example → action → rest of the report, so the CTA
 * follows the example and its findings without waiting on the contents list.
 * From lg up the action moves under the copy, and the example and the
 * contents list stack flush in the right column to read as one panel.
 */

import CtaButton from "./CtaButton";
import { REVIEW_CONTENTS, REVIEW_EXAMPLE } from "./demo-data";
import { Reveal } from "./motion";

const KICKER = "text-[11px] font-medium uppercase tracking-[0.16em] text-subtle";

export default function AthleteReviewPreview() {
  const { endurancePercentile, hybridScore, scoreDelta, limiter, focus } = REVIEW_EXAMPLE;

  return (
    <section className="py-[clamp(48px,6vw,88px)]">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr_auto] lg:gap-x-20 lg:gap-y-0">
        <Reveal className="lg:col-start-1 lg:row-start-1">
          <div className="max-w-[32rem]">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">
              Athlete Review
            </p>
            <h2 className="mt-5 text-balance text-[clamp(27px,3vw,38px)] font-semibold leading-[1.14] tracking-[-0.025em] text-ink">
              Your score shows where you stand. Athlete Review shows what to
              train next.
            </h2>
            <p className="mt-5 max-w-[42ch] text-[16px] leading-[1.6] text-lead sm:text-[17px]">
              Built from your Strendex result, then shaped by how you train,
              recover and what you’re working toward.
            </p>
          </div>
        </Reveal>

        {/* Report excerpt: the example and its findings */}
        <Reveal delay={0.1} className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <article
            aria-label="Example Athlete Review excerpt"
            className="rounded-2xl border border-white/10 bg-white/[0.02] pb-6 lg:rounded-b-none lg:border-b-0"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-lead">
                Athlete Review
              </span>
              <span className="rounded-md border border-white/25 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
                Example
              </span>
            </header>

            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <p className="text-[13px] text-subtle">
                Fictional athlete. Not a real result.
              </p>

              {/* Scenario: one percentile move → the score it produces */}
              <div className="mt-5">
                <p className={KICKER}>Score scenario</p>

                <Reveal y={12} delay={0.15}>
                  <div className="mt-3 flex items-baseline justify-between gap-4 rounded-xl border border-white/[0.08] px-4 py-3.5">
                    <span className="text-[14px] text-lead">Endurance percentile</span>
                    <span className="text-[20px] font-semibold tabular-nums text-ink">
                      {endurancePercentile.from}
                      <span className="px-1.5 text-subtle" aria-hidden="true">→</span>
                      <span className="sr-only"> to </span>
                      {endurancePercentile.to}
                    </span>
                  </div>
                </Reveal>

                <Reveal y={8} delay={0.25}>
                  <div className="flex justify-center py-1.5" aria-hidden="true">
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" />
                    </svg>
                  </div>
                </Reveal>

                <Reveal y={12} delay={0.35}>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[14px] text-lead">Hybrid Score</div>
                        <div className="mt-1 flex items-baseline font-semibold tabular-nums">
                          <span className="text-[22px] text-subtle">{hybridScore.from}</span>
                          <span className="px-2 text-[18px] text-subtle" aria-hidden="true">→</span>
                          <span className="sr-only"> to </span>
                          <span className="text-[40px] leading-none tracking-tight text-accent">
                            {hybridScore.to}
                          </span>
                        </div>
                      </div>
                      <span className="pb-1 text-[15px] font-semibold tabular-nums text-ink">
                        +{scoreDelta} pts
                      </span>
                    </div>
                    <p className="mt-3 text-[12px] leading-[1.5] text-subtle">
                      Strength and endurance each count for half of the score.
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* Findings drawn from the scenario */}
              <Reveal y={12} delay={0.45}>
                <dl className="mt-6 space-y-5">
                  <div>
                    <dt className={KICKER}>What’s holding the score back</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.55] text-ink">{limiter}</dd>
                  </div>
                  <div>
                    <dt className={KICKER}>What to focus on</dt>
                    <dd className="mt-1.5 text-[15px] leading-[1.55] text-ink">{focus}</dd>
                  </div>
                </dl>
              </Reveal>
            </div>
          </article>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-start-1 lg:row-start-2 lg:mt-9">
          <div className="flex flex-col items-stretch gap-3 sm:items-start">
            <CtaButton href="/athlete-review">Build my Athlete Review</CtaButton>
            <p className="text-center text-[13px] text-subtle sm:text-left">
              Free · uses your existing results
            </p>
          </div>
        </Reveal>

        {/* The rest of the report, as contents. On lg its top border is the
            hairline under the findings, continuing the panel above. */}
        <Reveal delay={0.1} className="lg:col-start-2 lg:row-start-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 pb-5 pt-4 sm:px-6 sm:pb-6 lg:rounded-t-none">
            <p className={KICKER}>Also in the full review</p>
            <ul className="mt-2 divide-y divide-white/[0.07]">
              {REVIEW_CONTENTS.map((row) => (
                <li key={row.title} className="py-2.5 last:pb-0">
                  <div className="text-[14px] font-medium text-lead">{row.title}</div>
                  <div className="mt-0.5 hidden text-[13px] leading-[1.5] text-subtle sm:block">
                    {row.detail}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
