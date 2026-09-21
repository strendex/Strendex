"use client";

/**
 * Section 7 — close. One line, one control.
 *
 * The lime radial that used to sit behind this block is gone. It was a
 * decorative glow spending the accent on a background, which is the one place
 * the brand rules do not allow it, and it read as a haze rather than as depth.
 *
 * The old line, "See where you stand—and what to work on next.", also lost an
 * argument with the hero: the headline above now says KNOW WHERE YOU STAND, so
 * closing on the same phrase made the page end where it began.
 */

import CtaButton from "./CtaButton";
import { Reveal } from "./motion";

export default function FinalCTA() {
  return (
    <section className="py-[clamp(56px,7vw,104px)]">
      <Reveal>
        <div className="flex flex-col items-start gap-8">
          <h2 className="max-w-[18ch] text-balance text-[clamp(30px,3.6vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Your lifts and your 5K, in one score.
          </h2>
          <CtaButton href="/tool">Get your Hybrid Score</CtaButton>
        </div>
      </Reveal>
    </section>
  );
}
