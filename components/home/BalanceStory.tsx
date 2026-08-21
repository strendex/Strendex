"use client";

/**
 * Section 2 — the transformation, shown rather than argued.
 *
 * Two separate percentile readings on the left of the divider, one combined
 * profile below it. The previous version explained this in three paragraphs of
 * written-not-spoken copy; the visual now carries it and the copy is two lines.
 *
 * Illustrative values from ./demo-data.
 */

import { motion } from "motion/react";
import Band from "./Band";
import { DEMO, ordinal } from "./demo-data";
import { EASE, Reveal, usePrefersReducedMotion } from "./motion";

const ROWS = [
  { label: "Strength", value: DEMO.strengthPercentile },
  { label: "Endurance", value: DEMO.endurancePercentile },
];

export default function BalanceStory() {
  const reduced = usePrefersReducedMotion();

  return (
    <Band tone="band" className="py-[clamp(56px,7vw,104px)]">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center lg:gap-24">
        <Reveal>
          <div className="max-w-[34rem]">
            <h2 className="text-balance text-[clamp(27px,3vw,38px)] font-semibold leading-[1.14] tracking-[-0.025em] text-ink">
              Strength and endurance are usually measured separately.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.65] text-lead sm:text-[17px]">
              A big total says nothing about your engine. A fast 5K says nothing
              about your strength. Strendex puts both into one view so you can
              see the full athlete, not half the picture.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div>
            {/* Before — two readings that don't relate to each other */}
            <div className="space-y-7">
              {ROWS.map((row, i) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] text-ink">{row.label}</span>
                    <span className="text-[13px] tabular-nums text-subtle">
                      {row.value}{ordinal(row.value)} percentile
                    </span>
                  </div>
                  <div className="relative mt-3 h-px w-full bg-white/12">
                    <motion.span
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/65"
                      initial={reduced ? false : { left: "0%", opacity: 0 }}
                      whileInView={{ left: `${row.value}%`, opacity: 1 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.75, ease: EASE, delay: 0.1 + i * 0.12 }
                      }
                      style={reduced ? { left: `${row.value}%` } : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Resolve */}
            <div className="my-9 flex items-center gap-4">
              <span className="h-px flex-1 bg-white/10" />
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
                <path
                  d="M8 0v14M3 10l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  className="text-white/35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* After — one profile */}
            <div className="flex items-center gap-6">
              <span className="font-display text-[64px] leading-[0.8] tabular-nums text-ink">
                {DEMO.hybridScore}
              </span>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">
                  Hybrid profile
                </div>
                <div className="mt-2 text-[17px] font-medium text-ink">
                  {DEMO.profile}
                </div>
              </div>
            </div>

            <p className="mt-7 text-[12px] text-subtle">
              Illustrative data — not a real athlete.
            </p>
          </div>
        </Reveal>
      </div>
    </Band>
  );
}
