"use client";

/**
 * Section 4 — one worked example, so the score stops being abstract.
 *
 * The composition is a spectrum plot rather than a card: Alex's position sits
 * on a strength↔endurance axis, with the two percentile readings beneath it.
 * The score is set in ink, not lime — lime belongs to the hero model's score
 * and the primary control, and spending it twice would flatten both.
 *
 * All values are illustrative constants from ./demo-data.
 */

import { motion } from "motion/react";
import Band from "./Band";
import { DEMO, ordinal } from "./demo-data";
import { EASE, Meter, Reveal, usePrefersReducedMotion } from "./motion";

export default function ExampleResult() {
  const reduced = usePrefersReducedMotion();

  return (
    <Band tone="deep" className="py-[clamp(56px,7vw,104px)]">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">
          Example athlete
        </p>
        <h2 className="mt-5 max-w-[16ch] text-balance text-[clamp(27px,3vw,38px)] font-semibold leading-[1.14] tracking-[-0.025em] text-ink">
          See what the score actually means.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)] lg:gap-20">
        {/* Identity + score */}
        <Reveal delay={0.06}>
          <div>
            <div className="text-[13px] font-medium uppercase tracking-[0.16em] text-lead">
              {DEMO.name}
            </div>
            <div className="mt-5 flex items-end gap-4">
              <span className="font-display text-[86px] leading-[0.78] tabular-nums text-ink">
                {DEMO.hybridScore}
              </span>
              <span className="mb-2 text-[13px] leading-snug text-subtle">
                Hybrid
                <br />
                Score
              </span>
            </div>
            <div className="mt-7 text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">
              Profile
            </div>
            <div className="mt-2 text-[19px] font-medium text-ink">
              {DEMO.profile}
            </div>
          </div>
        </Reveal>

        {/* Spectrum + percentile readings */}
        <Reveal delay={0.14}>
          <div>
            <div className="relative pt-9">
              <motion.span
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[12px] text-ink"
                initial={reduced ? false : { left: "50%", opacity: 0 }}
                whileInView={{ left: `${DEMO.lean}%`, opacity: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.85, ease: EASE, delay: 0.2 }
                }
                style={reduced ? { left: `${DEMO.lean}%` } : undefined}
              >
                {DEMO.name}
              </motion.span>

              <div className="relative h-px w-full bg-white/14">
                <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/25" />
                <motion.span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                  initial={reduced ? false : { left: "50%", opacity: 0 }}
                  whileInView={{ left: `${DEMO.lean}%`, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.85, ease: EASE, delay: 0.2 }
                  }
                  style={reduced ? { left: `${DEMO.lean}%` } : undefined}
                />
              </div>

              <div className="mt-3 flex justify-between text-[12px] text-subtle">
                <span>Endurance-leaning</span>
                <span>Even</span>
                <span>Strength-leaning</span>
              </div>
            </div>

            <div className="mt-11 space-y-7">
              {[
                { label: "Strength", value: DEMO.strengthPercentile },
                { label: "Endurance", value: DEMO.endurancePercentile },
              ].map((row, i) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] text-ink">{row.label}</span>
                    <span className="text-[13px] tabular-nums text-subtle">
                      {row.value}{ordinal(row.value)} percentile
                    </span>
                  </div>
                  <Meter
                    value={row.value}
                    className="mt-3"
                    barClassName={i === 0 ? "bg-white/55" : "bg-white/30"}
                    delay={0.3 + i * 0.1}
                  />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <div className="mt-14 max-w-[62ch] border-t border-hairline pt-9">
          <p className="text-[clamp(19px,2vw,23px)] font-medium leading-[1.4] tracking-[-0.015em] text-ink">
            {DEMO.plain}
          </p>
          <p className="mt-4 text-[16px] leading-[1.65] text-lead">
            The score shows the level of the whole profile. The breakdown shows
            where the next points are most likely to come from.
          </p>
          <p className="mt-6 text-[12px] text-subtle">
            Illustrative data — not a real athlete.
          </p>
        </div>
      </Reveal>
    </Band>
  );
}
