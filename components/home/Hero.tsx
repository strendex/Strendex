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
 * ── Height (Group 5) ──────────────────────────────────────────────────────
 * Desktop: the hero fills the first viewport below the sticky header, less a
 * ~40px glimpse of the next section, via `100svh` minus the header (62px) and
 * the layout's top padding (48px). Clamped so a very short window cannot crush
 * the copy and a very tall monitor does not blow the photo up past the point
 * where it runs under the headline. It is a MIN height — the copy can always
 * grow it (larger text sizes), it is never clipped.
 *
 * A taller hero makes the contained photo larger, which moves its left edge
 * left, so the photo's box is inset from the top and bottom on desktop; its
 * charcoal left band then still lands under the copy.
 *
 * Mobile (below lg) reads headline → short body → lime CTA → photo, and fills
 * at least the first viewport beneath the sticky header: `100svh` minus the
 * header (56px + 1px border; 62px + 1px from sm) and the layout's top padding
 * (32px; 40px from sm). The photo box is `flex-1`, so it takes whatever height
 * the copy leaves rather than a spacer doing so. Its floor is the old 6:5 box,
 * so on a short screen or with enlarged text the hero simply grows and
 * scrolls. Its ceiling is square: any taller and `object-cover` crops the
 * runner out of frame. The crop (92% across) keeps both athletes between those
 * two shapes. On tall phones any height left once the photo is square is split
 * above and below the copy (`my-auto`) — tens of pixels, not a spacer block.
 * "See how it works" and the privacy line are desktop-only; the privacy
 * explanation is also at calculator consent.
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
        "min-h-[calc(100svh-89px)] sm:min-h-[calc(100svh-103px)] " +
        "pt-0 pb-[clamp(24px,4vw,56px)] sm:pt-2 " +
        "lg:min-h-[clamp(480px,calc(100svh-150px),780px)] lg:flex-row lg:items-center lg:py-10"
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
          "-translate-x-1/2 mt-[clamp(24px,6vw,40px)] " +
          "flex-1 min-h-[83.33vw] max-h-[100vw] sm:min-h-[56.25vw] " +
          "lg:absolute lg:inset-y-[4%] lg:order-none lg:mt-0 lg:min-h-0 lg:flex-none"
        }
      >
        <Image
          src="/images/strendex-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[92%_center] sm:object-right lg:object-contain"
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

      <div className="relative z-10 my-auto max-w-[34rem] lg:my-0 lg:max-w-[32rem] xl:max-w-[40rem]">
        <motion.p
          {...step(0)}
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-subtle"
        >
          Strength + Endurance
        </motion.p>

        <motion.h1
          {...step(0.05)}
          className="mt-4 font-display uppercase text-ink lg:mt-5"
          style={{
            fontSize: "clamp(34px, 4.6vw, 66px)",
            lineHeight: 1.0,
            letterSpacing: "0.005em",
          }}
        >
          <span className="block">Built for both.</span>
          <span className="block">Know where you stand.</span>
        </motion.h1>

        <motion.p
          {...step(0.1)}
          className="mt-5 max-w-[46ch] text-[15px] leading-[1.6] text-lead sm:text-[16px] lg:text-[17px]"
        >
          {/* Mobile (below lg) keeps the hero to headline → body → photo; the
              header's "Get your Hybrid Score" button is the action there. */}
          <span className="lg:hidden">
            Enter your bodyweight, lifts and run time. Get your Hybrid Score out
            of 100 and see how your strength and endurance compare.
          </span>
          <span className="hidden lg:inline">
            Enter your bodyweight, bench, squat, deadlift and a recent run, from
            5K to marathon. Your Hybrid Score combines strength and endurance
            into one number from 0 to 100 and shows which side has more room to
            grow.
          </span>
        </motion.p>

        <motion.div
          {...step(0.15)}
          className="mt-6 flex flex-col items-start gap-3 sm:mt-7 sm:flex-row sm:items-center sm:gap-7 lg:mt-9"
        >
          <CtaButton href="/tool" className="w-full sm:w-auto">
            Get your Hybrid Score
          </CtaButton>

          {/* A text link, not a second button. The lime control is the only
              thing in this composition that should look pressable. */}
          <Link
            href="#how-it-works"
            className={
              "hidden lg:inline " +
              "text-[15px] font-medium text-lead underline-offset-[6px] " +
              "transition-colors duration-150 hover:text-ink hover:underline"
            }
          >
            See how it works
          </Link>
        </motion.div>

        <motion.p
          {...step(0.2)}
          className="mt-5 hidden max-w-[42ch] text-[13px] leading-[1.5] text-subtle lg:block"
        >
          Your result stays private unless you choose to publish it.
        </motion.p>
      </div>
    </section>
  );
}
