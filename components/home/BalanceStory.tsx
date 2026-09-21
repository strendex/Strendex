"use client";

/**
 * Section 2 — why the two sides need a shared scale.
 *
 * The visual is the actual conversion: two raw entries in units that cannot be
 * compared to each other, then the same two performances expressed as
 * percentiles of one reference population.
 *
 * It used to end on the Hybrid Score and the archetype, which the worked
 * example further down also prints. Showing the result twice made the page
 * feel like it was repeating itself, and it spent the payoff before the
 * section that exists to deliver it. This section now stops at the shared
 * scale; ExampleResult turns it into a score.
 *
 * Two dots that slid along their rails on scroll have gone with it — they
 * animated the reading of a number, which is the one thing on the page that
 * should not move while you are reading it.
 *
 * Illustrative values from ./demo-data.
 */

import Band from "./Band";
import { DEMO, DEMO_INPUTS, ordinal } from "./demo-data";
import { Meter, Reveal } from "./motion";

const RAW = [
  { label: "Squat", value: `${DEMO_INPUTS.strength[1].value} kg` },
  { label: "5K", value: DEMO_INPUTS.endurance[0].value },
];

const SCALED = [
  { label: "Strength", value: DEMO.strengthPercentile },
  { label: "Endurance", value: DEMO.endurancePercentile },
];

const LABEL = "text-[11px] font-medium uppercase tracking-[0.18em] text-subtle";

export default function BalanceStory() {
  return (
    <Band tone="band" className="py-[clamp(48px,6vw,88px)]">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
        <Reveal>
          <div className="max-w-[34rem]">
            <h2 className="text-balance text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
              Strength and endurance are usually measured separately.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.6] text-lead">
              A squat in kilograms and a 5K in minutes have no common unit, so
              neither number tells you much about the other. Strendex converts
              both to percentiles of the same reference population. Once they
              share a scale, they can be compared and combined.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="max-w-[30rem]">
            <div className={LABEL}>As entered</div>
            <div className="mt-4 space-y-3">
              {RAW.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between border-b border-white/[0.07] pb-3"
                >
                  <span className="text-[15px] text-lead">{row.label}</span>
                  <span className="text-[15px] font-medium tabular-nums text-ink">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="my-8 flex items-center gap-4">
              <span className="h-px flex-1 bg-white/10" />
              <svg
                width="14"
                height="18"
                viewBox="0 0 16 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 0v14M3 10l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  className="text-white/30"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className={LABEL}>On one scale</div>
            <div className="mt-5 space-y-6">
              {SCALED.map((row, i) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] text-ink">{row.label}</span>
                    <span className="text-[13px] tabular-nums text-subtle">
                      {row.value}
                      {ordinal(row.value)} percentile
                    </span>
                  </div>
                  <Meter
                    value={row.value}
                    className="mt-3"
                    barClassName={i === 0 ? "bg-white/60" : "bg-white/30"}
                    delay={i * 0.08}
                  />
                </div>
              ))}
            </div>

            <p className="mt-7 text-[12px] text-subtle">
              Example figures — fictional athlete, simulated reference dataset.
            </p>
          </div>
        </Reveal>
      </div>
    </Band>
  );
}
