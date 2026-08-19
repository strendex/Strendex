"use client";

/**
 * The Hybrid Profile Model — the hero's visual argument.
 *
 * It says one thing: strength inputs and endurance inputs converge into a
 * single profile. That is the product, so it gets the composition rather than
 * a card.
 *
 * ── One composition, one centre axis ──────────────────────────────────────
 * This used to be two hand-tuned compositions (a desktop fan and a mobile
 * two-column Y), each positioning its connectors with absolute offsets chosen
 * to look right against the rendered text. That is what made the geometry
 * drift: the endpoints tracked where the type *happened* to sit, so any change
 * in digit count, font metrics or breakpoint pushed them out of alignment.
 *
 * There is now a single composition at every width, and alignment is
 * structural rather than tuned:
 *
 *   - Everything is a child of one `flex flex-col items-center` column, so
 *     every row is centred on the same axis by construction.
 *   - The three strength inputs use `grid-cols-3` with NO gap, so their column
 *     centres are exactly 1/6, 1/2 and 5/6 of the width — at any width.
 *   - Each connector <svg> spans that same full width with a locked
 *     aspect-ratio, so its viewBox maps 1:1 onto those fractions. The fan
 *     starts at COL[] and converges on CX; both are pure viewBox constants.
 *   - Connector paths terminate at fixed anchors ABOVE and BELOW the score
 *     block. They are never derived from the numeral's bounding box, so a
 *     score of 4, 64 or 100 renders identical geometry.
 *
 * The score itself is centred by the flex column and carries a min-width sized
 * for three digits, so digit count can never shift the layout either.
 *
 * All values are illustrative constants from ./demo-data. Nothing here computes
 * or duplicates scoring logic.
 */

import { motion, useScroll, useTransform } from "motion/react";
import type { RefObject } from "react";
import { DEMO, DEMO_INPUTS } from "./demo-data";
import {
  EASE,
  useCountUp,
  useMediaQuery,
  usePrefersReducedMotion,
} from "./motion";

/* ── geometry ──────────────────────────────────────────────────────────────
   One shared viewBox width for both connector SVGs, so both speak the same
   coordinate space. CX is the single centre axis referenced everywhere.     */
const VB_W = 560;
const CX = VB_W / 2;
/** Centres of a no-gap `grid-cols-3`, in viewBox units. */
const COL = [VB_W / 6, VB_W / 2, (VB_W * 5) / 6];

/** Top connector: inputs fan down to the anchor above the score. */
const TOP_H = 84;
const TOP_FROM_Y = 6;
const TOP_ANCHOR_Y = 78;

/** Bottom connector: anchor below the profile line, down to the endurance input. */
const BOT_H = 72;
const BOT_ANCHOR_Y = 6;
const BOT_TO_Y = 66;

const HAIRLINE = "rgba(255,255,255,0.28)";
const NODE = "rgba(255,255,255,0.45)";

/* ── sequence timings (ms from mount) ──────────────────────────────────────
   labels → connectors draw → score resolves → profile verdict.            */
const T = { labels: 0, paths: 220, score: 560, verdict: 880 };

function useSteps() {
  const reduced = usePrefersReducedMotion();
  return {
    reduced,
    at: (ms: number) => ({
      initial: reduced ? false : { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      transition: reduced
        ? { duration: 0 }
        : { duration: 0.5, ease: EASE, delay: ms / 1000 },
    }),
    draw: (ms: number, dur = 0.75) => ({
      initial: reduced ? false : { pathLength: 0, opacity: 0 },
      animate: { pathLength: 1, opacity: 1 },
      transition: reduced
        ? { duration: 0 }
        : {
            pathLength: { duration: dur, ease: EASE, delay: ms / 1000 },
            opacity: { duration: 0.2, delay: ms / 1000 },
          },
    }),
  };
}

const LABEL = "text-[10px] font-medium uppercase tracking-[0.18em] text-subtle";

type Steps = ReturnType<typeof useSteps>;

/** Small anchor dot. Rendered in viewBox units; the locked aspect-ratio on the
 *  parent <svg> keeps scaling uniform, so it stays a true circle. */
function Node({
  cx,
  cy,
  steps,
  at,
  fill = NODE,
}: {
  cx: number;
  cy: number;
  steps: Steps;
  at: number;
  fill?: string;
}) {
  return <motion.circle cx={cx} cy={cy} r="3" fill={fill} {...steps.at(at)} />;
}

export default function HybridProfileModel({
  /** The hero <section>, used as the scroll target for the parallax lift. */
  scrollTarget,
}: {
  scrollTarget?: RefObject<HTMLElement | null>;
}) {
  const steps = useSteps();
  const reduced = steps.reduced;
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { ref: scoreRef, display: score } = useCountUp(
    DEMO.hybridScore,
    undefined,
    true
  );

  /* Scroll-linked lift. The whole model is transformed as one object, so the
     connector geometry cannot come apart. Progress runs 0 → 1 across the hero:
     0 while the hero's top is at/below the viewport top (i.e. at rest on load),
     1 once the hero has scrolled past. Reverses on scroll up by construction —
     it is a direct mapping of scroll position, not a triggered animation. */
  const { scrollYProgress } = useScroll({
    target: scrollTarget,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, isDesktop ? -14 : -8]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.99]);

  return (
    <motion.div style={reduced ? undefined : { y, scale }}>
      <div className="mx-auto flex w-full max-w-[340px] flex-col items-center md:max-w-[560px]">
        {/* ── Strength ─────────────────────────────────────────────────── */}
        <motion.div {...steps.at(T.labels)} className={LABEL}>
          Strength
        </motion.div>

        {/* No gap: the column centres must stay at exactly 1/6, 1/2, 5/6 to
            line up with COL[] in the SVG below. */}
        <div className="mt-4 grid w-full grid-cols-3 md:mt-5">
          {DEMO_INPUTS.strength.map((input, i) => (
            <motion.div
              key={input.label}
              {...steps.at(T.labels + 80 + i * 60)}
              className="text-center"
            >
              <div className="text-[14px] tabular-nums text-ink md:text-[15px]">
                {input.value}
                <span className="ml-0.5 text-[11px] text-subtle">kg</span>
              </div>
              <div className="mt-1 text-[11px] text-subtle">{input.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Strength → score connectors ──────────────────────────────── */}
        <svg
          viewBox={`0 0 ${VB_W} ${TOP_H}`}
          style={{ aspectRatio: `${VB_W} / ${TOP_H}` }}
          className="mt-4 w-full md:mt-5"
          fill="none"
          aria-hidden="true"
        >
          {COL.map((x, i) => (
            <motion.path
              key={x}
              d={
                x === CX
                  ? `M ${CX} ${TOP_FROM_Y} L ${CX} ${TOP_ANCHOR_Y}`
                  : `M ${x} ${TOP_FROM_Y} C ${x} ${TOP_FROM_Y + 34}, ${CX} ${TOP_ANCHOR_Y - 34}, ${CX} ${TOP_ANCHOR_Y}`
              }
              stroke={HAIRLINE}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              {...steps.draw(T.paths + i * 60)}
            />
          ))}
          {COL.map((x, i) => (
            <Node key={x} cx={x} cy={TOP_FROM_Y} steps={steps} at={T.paths + i * 60} />
          ))}
          <Node cx={CX} cy={TOP_ANCHOR_Y} steps={steps} at={T.paths + 180} />
        </svg>

        {/* ── Score ────────────────────────────────────────────────────────
            Centred by the flex column, so the axis holds for any digit count.
            min-width is sized for "100" purely so width never changes. */}
        <motion.span
          {...steps.at(T.score)}
          ref={scoreRef}
          className="mt-5 block min-w-[120px] text-center font-display text-[68px] leading-[0.8] tabular-nums text-accent md:mt-7 md:min-w-[164px] md:text-[92px]"
        >
          {score}
        </motion.span>

        <motion.span {...steps.at(T.score + 80)} className={`mt-4 ${LABEL}`}>
          Hybrid Score
        </motion.span>

        {/* Plain text, not a pill — a bordered capsule here read as a badge. */}
        <motion.span
          {...steps.at(T.verdict)}
          className="mt-4 text-[14px] font-medium text-ink md:text-[15px]"
        >
          {DEMO.profile}
        </motion.span>

        {/* ── Score → endurance connector ──────────────────────────────── */}
        <svg
          viewBox={`0 0 ${VB_W} ${BOT_H}`}
          style={{ aspectRatio: `${VB_W} / ${BOT_H}` }}
          className="mt-5 w-full md:mt-7"
          fill="none"
          aria-hidden="true"
        >
          <motion.path
            d={`M ${CX} ${BOT_ANCHOR_Y} L ${CX} ${BOT_TO_Y}`}
            stroke={HAIRLINE}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            {...steps.draw(T.paths + 180)}
          />
          <Node cx={CX} cy={BOT_ANCHOR_Y} steps={steps} at={T.paths + 180} />
          <Node cx={CX} cy={BOT_TO_Y} steps={steps} at={T.paths + 240} />
        </svg>

        {/* ── Endurance ────────────────────────────────────────────────── */}
        <motion.div {...steps.at(T.labels + 260)} className="text-center">
          <div className="text-[14px] tabular-nums text-ink md:text-[15px]">
            {DEMO_INPUTS.endurance[0].value}
          </div>
          <div className="mt-1 text-[11px] text-subtle">
            {DEMO_INPUTS.endurance[0].label}
          </div>
        </motion.div>

        <motion.div {...steps.at(T.labels + 300)} className={`mt-4 ${LABEL}`}>
          Endurance
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-subtle">
          Illustrative example — not a real athlete.
        </p>
      </div>
    </motion.div>
  );
}
