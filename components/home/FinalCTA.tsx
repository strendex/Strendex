"use client";

/**
 * Section 6 — close. One line, one control, one row.
 *
 * The previous close stacked a 48px headline over its button inside ~100px of
 * padding on each side, so the page ended on a mostly empty block. This is a
 * compact closing band instead: a hairline, then the line and the control on
 * one row from lg, stacked below it. No glow, no gradient — the lime button is
 * the only accent.
 *
 * There is no supporting line. The footer directly beneath already says
 * "Strength and endurance, benchmarked together.", and repeating it here
 * would spend the last word twice.
 */

import CtaButton from "./CtaButton";
import { Reveal } from "./motion";

export default function FinalCTA() {
  return (
    <section className="border-t border-hairline py-[clamp(40px,5vw,64px)]">
      <Reveal>
        <div className="flex flex-col items-start gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <h2 className="max-w-[22ch] text-balance text-[clamp(26px,3vw,40px)] font-semibold leading-[1.12] tracking-[-0.025em] text-ink">
            See what your training says about you.
          </h2>
          <CtaButton href="/tool" className="w-full shrink-0 sm:w-auto">
            Test yourself
          </CtaButton>
        </div>
      </Reveal>
    </section>
  );
}
