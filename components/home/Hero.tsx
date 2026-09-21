"use client";

/**
 * Hero.
 *
 * ── Typography ────────────────────────────────────────────────────────────
 * The headline is Anton, already loaded by app/layout.tsx as `--font-anton`
 * and exposed as `font-display`. Nothing new is fetched. An earlier revision
 * set the headline in the body sans on the theory that condensed caps "read as
 * gym apparel"; at this size, with the two lines broken explicitly and a
 * little positive tracking to open the counters, it reads as a masthead
 * instead. Anton is a single weight (400) but a very heavy one, so no
 * synthetic bolding is applied anywhere.
 *
 * The line break is structural — two block spans, not a `<br>` and not
 * `text-balance` — so the headline can never wrap somewhere awkward. Body and
 * interface text stay in Inter.
 *
 * ── The photograph ────────────────────────────────────────────────────────
 * public/images/strendex-hero.png is 1672×941 and its left ~37% is a flat
 * #0D0E11, within a shade of the brand base #0E1014. Two different framings
 * fall out of that, from one <Image fill>:
 *
 *   desktop — `object-contain object-right`. Not a crop: the photo is laid out
 *     at its own aspect ratio, full height, flush right, and the surplus width
 *     to its left is plain `bg-base`. Because the photo's own left band is the
 *     same charcoal the join is invisible, so the dark copy area GROWS with
 *     the viewport instead of shrinking. Both athletes survive at every width.
 *
 *   mobile — `object-cover object-right` in a 6:5 box. That shows the
 *     rightmost 67.5% of the frame (6/5 ÷ 1672/941), which discards the dead
 *     black band and starts at 32.5% — still clear of the barbell's left plate
 *     at ~38%. Nothing is cropped vertically, so neither athlete loses a face
 *     or a working limb.
 *
 * The section height is deliberately NOT full-screen. It is short enough that
 * a shorter hero makes the contained photo smaller, which moves its left edge
 * right and hands the copy more dark space — height and headline width are one
 * adjustment, not two.
 */

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import CtaButton from "./CtaButton";
import { EASE, usePrefersReducedMotion } from "./motion";

export default function Hero() {
  const reduced = usePrefersReducedMotion();

  const step = (delay: number) => ({
    "data-reveal": "",
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.45, ease: EASE, delay },
  });

  return (
    <section
      className={
        "relative flex flex-col " +
        "pt-[clamp(4px,1.5vw,20px)] pb-[clamp(32px,4vw,56px)] " +
        "lg:min-h-[clamp(390px,32vw,500px)] lg:flex-row lg:items-center"
      }
    >
      {/*
        Decorative: the headline and supporting copy already say what the
        product benchmarks, so the photograph carries nothing a screen reader
        is missing.

        Bleeds past the layout's max-w-6xl column using the house idiom from
        Band.tsx; globals.css sets `overflow-x: clip` on html/body so this can
        never raise a scrollbar.
      */}
      <div
        aria-hidden="true"
        className={
          "pointer-events-none relative left-1/2 order-last w-screen " +
          "-translate-x-1/2 mt-[clamp(28px,6vw,40px)] " +
          "aspect-[6/5] sm:aspect-[16/9] " +
          "lg:absolute lg:inset-y-0 lg:order-none lg:mt-0 lg:aspect-auto"
        }
      >
        <Image
          src="/images/strendex-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right lg:object-contain"
        />

        {/* Contrast insurance, desktop only. Solid across the stretch the copy
            occupies — which is already base charcoal, so it reads as nothing —
            then released before it reaches the lifter. */}
        <div
          className={
            "absolute inset-0 hidden lg:block " +
            "bg-[linear-gradient(to_right,var(--base)_0%,var(--base)_28%,rgba(14,16,20,0.86)_42%,rgba(14,16,20,0.45)_54%,rgba(14,16,20,0)_68%)]"
          }
        />

        {/* The photo is laid out at its own aspect ratio, so on desktop its top
            and bottom edges land inside the section rather than on it. Without
            this the bright sky at the top right meets the charcoal as a hard
            rule and the whole thing reads as a pasted rectangle. */}
        <div
          className={
            "absolute inset-0 hidden lg:block " +
            "bg-[linear-gradient(to_bottom,var(--base)_0%,rgba(14,16,20,0)_9%,rgba(14,16,20,0)_88%,var(--base)_100%)]"
          }
        />
      </div>

      <div className="relative z-10 max-w-[34rem] lg:max-w-[32rem] xl:max-w-[40rem]">
        <motion.p
          {...step(0)}
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle"
        >
          Strength + Endurance
        </motion.p>

        <motion.h1
          {...step(0.05)}
          className="mt-5 font-display uppercase text-ink"
          style={{
            fontSize: "clamp(34px, 4.4vw, 60px)",
            lineHeight: 1.0,
            letterSpacing: "0.005em",
          }}
        >
          <span className="block">Built for both.</span>
          <span className="block">Know where you stand.</span>
        </motion.h1>

        <motion.p
          {...step(0.1)}
          className="mt-5 max-w-[46ch] text-[15px] leading-[1.6] text-lead sm:text-[16px]"
        >
          Enter your bodyweight, lifts and 5K time. See your Hybrid Score, how
          your strength and endurance compare, and what to work on next.
        </motion.p>

        <motion.div
          {...step(0.15)}
          className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7"
        >
          <CtaButton href="/tool" className="w-full sm:w-auto">
            Get your Hybrid Score
          </CtaButton>

          {/* A text link, not a second button. The lime control is the only
              thing in this composition that should look pressable. */}
          <Link
            href="#how-it-works"
            className={
              "text-[15px] font-medium text-lead underline-offset-[6px] " +
              "transition-colors duration-150 hover:text-ink hover:underline"
            }
          >
            See how it works
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
