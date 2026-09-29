"use client";

/**
 * Section 3 — the three steps.
 *
 * Previously this drew a "measuring instrument": a rule that grew from the
 * left, twenty-five graduation ticks that grew after it, and three lime nodes
 * that popped in on a stagger — roughly a second and a half of decoration
 * running across the text you were trying to read. The graduations also
 * implied a scale that nothing on the axis was measured against.
 *
 * What replaced it is a plain hairline above each step. The lime went with the
 * nodes: a step marker is not an action and not a number, so it has no claim
 * on the accent.
 *
 * The steps are a SINGLE list whose layout switches with CSS. An earlier
 * version rendered a desktop <ol> and a mobile <ol> and hid one with
 * `md:hidden` — the hidden copy's scroll reveals never fired, so crossing the
 * breakpoint left the steps stuck at opacity 0.
 */

import Link from "next/link";
import { Reveal } from "./motion";

const STEPS = [
  {
    n: "01",
    title: "Enter your numbers",
    body: "Bodyweight, your best bench, squat and deadlift, and a recent run: 3 miles, 5K, 10K, half or full marathon.",
  },
  {
    n: "02",
    title: "Each side becomes a percentile",
    body: "Your lifts relative to bodyweight, and your run adjusted to a common distance, are each placed within the same reference dataset. The 70th percentile means you sit above roughly 70% of it.",
  },
  {
    n: "03",
    title: "Get your Hybrid Score",
    body: "The two percentiles are averaged into one score from 0 to 100. Your tier and athlete type show where that score sits and how your two sides compare.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 py-[clamp(48px,6vw,88px)]"
    >
      <Reveal>
        <h2 className="max-w-[18ch] text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
          How it works
        </h2>
      </Reveal>

      <ol className="mt-10 grid grid-cols-1 gap-8 md:mt-12 md:grid-cols-3 md:gap-10">
        {STEPS.map((s, i) => (
          <Reveal
            key={s.n}
            as="li"
            delay={i * 0.06}
            className="border-t border-hairline pt-5"
          >
            <span className="text-[12px] font-medium tabular-nums tracking-[0.16em] text-subtle">
              {s.n}
            </span>
            <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.015em] text-ink md:text-[19px]">
              {s.title}
            </h3>
            <p className="mt-2.5 max-w-[36ch] text-[15px] leading-[1.6] text-lead">
              {s.body}
            </p>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.12}>
        <p className="mt-10 max-w-[60ch] text-[14px] leading-[1.6] text-subtle md:mt-12">
          Your percentiles compare you with the reference dataset, not with
          other people who use Strendex. Publishing to the public leaderboard is
          optional and separate.{" "}
          <Link
            href="/methodology"
            className="text-lead underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            Read the methodology
          </Link>
        </p>
      </Reveal>
    </section>
  );
}
