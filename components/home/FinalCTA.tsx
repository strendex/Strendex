"use client";

/**
 * Section 7 — close. One question, one control.
 *
 * Set in the body sans like every other heading; the only display type left on
 * the page is the Hybrid Score numeral. A single very low-contrast radial gives
 * the closing block some depth without becoming an effect.
 */

import CtaButton from "./CtaButton";
import { Reveal } from "./motion";

export default function FinalCTA() {
  return (
    <section className="relative py-[clamp(72px,9vw,132px)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 100%, rgba(223,255,0,0.035) 0%, transparent 72%)",
        }}
      />
      <Reveal>
        <div className="relative flex flex-col items-start gap-9">
          <h2 className="max-w-[20ch] text-balance text-[clamp(32px,4vw,54px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
            See where you stand—and what to work on next.
          </h2>
          <CtaButton href="/tool">Benchmark yourself</CtaButton>
        </div>
      </Reveal>
    </section>
  );
}
