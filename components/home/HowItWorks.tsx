"use client";

/**
 * Section 3 — three steps as a calibration process.
 *
 * The rail carries graduated tick marks and a node per step, so the progression
 * reads as a measuring instrument rather than a generic dot-and-line connector.
 * It draws once on entry: rule, then ticks, then nodes.
 *
 * The steps themselves are a SINGLE list whose layout switches with CSS. An
 * earlier version rendered a desktop <ol> and a mobile <ol> and hid one with
 * `md:hidden` — the hidden copy's scroll reveals never fired, so crossing the
 * breakpoint left the steps stuck at opacity 0. Only the rails are duplicated,
 * and they are purely decorative.
 */

import { motion } from "motion/react";
import { EASE, Reveal, usePrefersReducedMotion } from "./motion";

const STEPS = [
  {
    n: "01",
    title: "Enter your performance",
    body: "Bodyweight, your main lifts and a recent endurance effort.",
  },
  {
    n: "02",
    title: "We benchmark both sides",
    body: "Strength and endurance are compared against the Strendex reference dataset.",
  },
  {
    n: "03",
    title: "See your athlete profile",
    body: "Get your Hybrid Score, balance, percentile context and archetype.",
  },
];

/** Minor graduations along the desktop rail. */
const TICKS = Array.from({ length: 25 }, (_, i) => i);

export default function HowItWorks() {
  const reduced = usePrefersReducedMotion();

  const grow = (delay: number, duration = 0.9) => ({
    initial: reduced ? false : { scaleX: 0 },
    whileInView: { scaleX: 1 },
    viewport: { once: true, amount: 0.4 } as const,
    transition: reduced ? { duration: 0 } : { duration, ease: EASE, delay },
  });

  return (
    <section id="how-it-works" className="scroll-mt-24 py-[clamp(56px,7vw,104px)]">
      <Reveal>
        <h2 className="max-w-[18ch] text-balance text-[clamp(27px,3vw,38px)] font-semibold leading-[1.14] tracking-[-0.025em] text-ink">
          How it works
        </h2>
      </Reveal>

      {/* Desktop rail: rule, graduations, then a node above each column */}
      <div className="relative mt-16 hidden h-10 md:block">
        <motion.span
          className="absolute inset-x-0 top-5 h-px origin-left bg-white/14"
          {...grow(0)}
        />
        <motion.div
          className="absolute inset-x-0 top-5 flex origin-left justify-between"
          {...grow(0.15, 1)}
        >
          {TICKS.map((t) => (
            <span
              key={t}
              className={`w-px bg-white/14 ${t % 4 === 0 ? "h-2.5" : "h-1.5"}`}
            />
          ))}
        </motion.div>

        <div className="absolute inset-x-0 top-5 grid grid-cols-3 gap-12">
          {STEPS.map((s, i) => (
            <motion.span
              key={s.n}
              className="h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent"
              initial={reduced ? false : { opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.4, ease: EASE, delay: 0.5 + i * 0.12 }
              }
            />
          ))}
        </div>
      </div>

      <div className="relative mt-12 md:mt-8">
        {/* Mobile rail */}
        <motion.span
          aria-hidden="true"
          className="absolute left-[5px] top-1 h-[calc(100%-8px)] w-px origin-top bg-white/14 md:hidden"
          initial={reduced ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE }}
        />

        <ol className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {STEPS.map((s, i) => (
            <Reveal
              key={s.n}
              as="li"
              delay={0.15 + i * 0.1}
              className="relative pl-9 md:pl-0"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-accent md:hidden"
              />
              <span className="text-[12px] font-medium tabular-nums tracking-[0.16em] text-subtle">
                {s.n}
              </span>
              <h3 className="mt-2.5 text-[18px] font-semibold tracking-[-0.015em] text-ink md:mt-3 md:text-[19px]">
                {s.title}
              </h3>
              <p className="mt-2.5 max-w-[34ch] text-[15px] leading-[1.6] text-lead md:mt-3">
                {s.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
