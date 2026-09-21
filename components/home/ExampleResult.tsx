"use client";

/**
 * The worked example — the page's single instance of a real result.
 *
 * It replaces a full-height diagram of input labels joined to a lone numeral
 * by thin connectors. That composition spent roughly 700px of scroll to say
 * "three lifts and a run make one score", which the copy above it already
 * said, and it showed none of what the product actually returns.
 *
 * This shows the result screen's own furniture instead, compactly: the score
 * and tier, the archetype, the two percentile readings side by side, and the
 * limiting side with the diagnostic sentence the calculator itself prints.
 *
 * ── Nothing here is invented ──────────────────────────────────────────────
 * Values come from ./demo-data, whose every derivable figure is re-derived
 * from lib/scoring/core by tests/demoData.test.ts. The limiter explanation is
 * ARCHETYPE_COPY, the same constant app/tool/page.tsx renders — not a
 * paraphrase of it. The limiter side and gap are read off the two percentiles
 * rather than asserted. No percentile, projection or relationship is stated
 * that the engine does not produce.
 */

import { ARCHETYPE_COPY } from "@/lib/archetypeCopy";
import Band from "./Band";
import { DEMO, DEMO_INPUTS, DEMO_LIMITER, ordinal } from "./demo-data";
import { Meter, Reveal } from "./motion";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.18em] text-subtle";

const INPUTS = [
  { label: "Bodyweight", value: `${DEMO_INPUTS.bodyweightKg} kg` },
  ...DEMO_INPUTS.strength.map((s) => ({
    label: s.label,
    value: `${s.value} kg`,
  })),
  ...DEMO_INPUTS.endurance.map((e) => ({ label: e.label, value: e.value })),
];

const READINGS = [
  { label: "Strength", value: DEMO.strengthPercentile },
  { label: "Endurance", value: DEMO.endurancePercentile },
];

export default function ExampleResult() {
  const diagnosis = ARCHETYPE_COPY[DEMO.archetype];

  return (
    <Band tone="deep" className="py-[clamp(48px,6vw,88px)]">
      <Reveal>
        <h2 className="max-w-[20ch] text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
          What your result tells you.
        </h2>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="mt-9 overflow-hidden rounded-2xl border border-hairline bg-surface">
          {/* What was entered */}
          <dl className="flex flex-wrap gap-x-8 gap-y-4 border-b border-hairline px-5 py-4 sm:px-7">
            {INPUTS.map((input) => (
              <div key={input.label} className="flex items-baseline gap-2">
                <dt className="text-[12px] text-subtle">{input.label}</dt>
                <dd className="text-[13px] font-medium tabular-nums text-lead">
                  {input.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Score and archetype, then the two readings side by side */}
          <div className="grid gap-9 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[64px] leading-[0.8] tabular-nums text-accent">
                  {DEMO.hybridScore}
                </span>
                <span className="text-[13px] leading-tight text-subtle">
                  Hybrid
                  <br />
                  Score
                </span>
              </div>

              <div className="mt-5 inline-flex items-center rounded border border-white/12 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-lead">
                {DEMO.tier}
              </div>

              <div className={`${LABEL} mt-6`}>Archetype</div>
              <div className="mt-2 text-[18px] font-medium text-ink">
                {DEMO.profile}
              </div>
              <p className="mt-2 max-w-[30ch] text-[14px] leading-[1.55] text-subtle">
                {diagnosis.tagline}
              </p>
            </div>

            <div className="lg:border-l lg:border-hairline lg:pl-14">
              <div className={LABEL}>Strength vs endurance</div>

              {/* Capped: a percentile bar stretched across a 1200px column is
                  harder to read than a short one, not easier. */}
              <div className="mt-6 max-w-[30rem] space-y-6">
                {READINGS.map((row, i) => (
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

              <p className="mt-6 max-w-[46ch] text-[13px] leading-[1.55] text-subtle">
                The Hybrid Score is the midpoint of the two: half the strength
                percentile, half the endurance percentile.
              </p>
            </div>
          </div>

          {/* The limiting side, and the calculator's own explanation of it */}
          <div className="border-t border-hairline px-5 py-7 sm:px-7">
            <div className={LABEL}>Main limiter</div>
            <p className="mt-3 text-[clamp(17px,1.8vw,20px)] font-medium leading-[1.4] tracking-[-0.015em] text-ink">
              {DEMO_LIMITER.side}, by {DEMO_LIMITER.gap} percentile points.
            </p>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-lead">
              {diagnosis.description}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <p className="mt-5 text-[12px] text-subtle">
          Example result — fictional athlete.
        </p>
      </Reveal>
    </Band>
  );
}
