"use client";

/**
 * Hero.
 *
 * The headline is set in the body sans at weight 600 with tight tracking, not
 * Anton. Giant condensed caps read as gym apparel; this needs to read as a
 * performance instrument. Anton survives on this page only as the Hybrid Score
 * numeral inside the model.
 *
 * Mobile order is the composition order: eyebrow, headline, copy, CTAs, model.
 * At 400×590 that puts the headline, supporting line and primary control all
 * within the first screen, with the model beginning just below it.
 */

import { motion } from "motion/react";
import CtaButton from "./CtaButton";
import HybridProfileModel from "./HybridProfileModel";
import { EASE, usePrefersReducedMotion } from "./motion";

export default function Hero() {
  const reduced = usePrefersReducedMotion();

  const step = (delay: number) => ({
    "data-reveal": "",
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.55, ease: EASE, delay },
  });

  return (
    <section className="pt-[clamp(20px,3vw,40px)] pb-[clamp(48px,6vw,80px)]">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,500px)] lg:items-center lg:gap-16 xl:gap-20">
        <div className="max-w-[40rem]">
          <motion.p
            {...step(0)}
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle"
          >
            Hybrid athlete benchmarking
          </motion.p>

          <motion.h1
            {...step(0.07)}
            className="mt-6 text-balance font-semibold tracking-[-0.03em] text-ink"
            // Capped at 58px: at 66px the line broke as "One / benchmark for /
            // both sides of / your fitness." — a one-word orphan on line one.
            style={{
              fontSize: "clamp(40px, 4.2vw, 58px)",
              lineHeight: 1.08,
            }}
          >
            One benchmark for both sides of your fitness.
          </motion.h1>

          <motion.p
            {...step(0.14)}
            className="mt-6 max-w-[46ch] text-[16px] leading-[1.6] text-lead sm:text-[17px]"
          >
            Enter your lifts and a recent run. Strendex compares strength and
            endurance on the same scale, then shows your Hybrid Score and
            athlete profile.
          </motion.p>

          <motion.div
            {...step(0.21)}
            className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          >
            <CtaButton href="/tool">Benchmark yourself</CtaButton>
            {/* Borderless on phones so the two stacked controls don't read as
                a matched pair of equally important buttons. */}
            <CtaButton
              href="#how-it-works"
              tone="secondary"
              // Base-then-sm ordering (rather than a max-sm override) so
              // tailwind-merge resolves the border colour deterministically.
              className="border-transparent hover:border-transparent sm:border-white/12 sm:hover:border-white/22"
            >
              See how it works
            </CtaButton>
          </motion.div>
        </div>

        <motion.div {...step(0.3)} className="lg:pl-4">
          <HybridProfileModel />
        </motion.div>
      </div>
    </section>
  );
}
