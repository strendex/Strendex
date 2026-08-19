"use client";

/**
 * The Hybrid Profile Model — the hero's visual argument.
 *
 * It says one thing: strength inputs and endurance inputs converge into a
 * single profile. That is the product, so it gets the composition rather than
 * a card.
 *
 * Built as hairline SVG geometry with HTML text positioned over it — vector
 * connectors stay crisp at any size, and the type stays real CSS type rather
 * than <text> nodes with their own font handling.
 *
 * Two deliberate compositions, not one shrunk down:
 *   desktop — vertical convergence, strength above, endurance below
 *   mobile  — two columns converging diagonally into the score beneath them
 *
 * All values are illustrative constants from ./demo-data. Nothing here computes
 * or duplicates scoring logic.
 */

import { motion } from "motion/react";
import { DEMO, DEMO_INPUTS } from "./demo-data";
import { EASE, useCountUp, usePrefersReducedMotion } from "./motion";

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

/** Shared centre readout: score, caption, verdict. */
function Readout({
  size,
  steps,
}: {
  size: "lg" | "sm";
  steps: ReturnType<typeof useSteps>;
}) {
  const { ref, value } = useCountUp(DEMO.hybridScore, 900, true);

  return (
    <div className="flex flex-col items-center">
      <motion.span
        {...steps.at(T.score)}
        ref={ref}
        className="font-display leading-[0.8] tabular-nums text-accent"
        style={{ fontSize: size === "lg" ? 92 : 68 }}
      >
        {value}
      </motion.span>
      <motion.span {...steps.at(T.score + 80)} className={`mt-3 ${LABEL}`}>
        Hybrid Score
      </motion.span>
      {/* Plain text, not a pill — a bordered capsule here read as a badge. */}
      <motion.span
        {...steps.at(T.verdict)}
        className={`mt-4 font-medium text-ink ${
          size === "lg" ? "text-[15px]" : "text-[14px]"
        }`}
      >
        {DEMO.profile}
      </motion.span>
    </div>
  );
}

/* ── Desktop ─────────────────────────────────────────────────────────────── */

function DesktopModel({ steps }: { steps: ReturnType<typeof useSteps> }) {
  // viewBox space: 560 × 520. Connectors fan from the input rows to the centre.
  const cx = 280;
  const topY = 116;
  const botY = 404;
  const coreTop = 214;
  const coreBot = 306;
  const xs = [96, 280, 464];

  return (
    <div className="relative mx-auto w-full max-w-[560px]" style={{ aspectRatio: "560 / 520" }}>
      <svg
        viewBox="0 0 560 520"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        {/* strength inputs → core. non-scaling-stroke keeps the hairline a true
            1px at any rendered size instead of thinning to sub-pixel. */}
        {xs.map((x, i) => (
          <motion.path
            key={`s${x}`}
            d={`M ${x} ${topY} C ${x} ${topY + 52}, ${cx} ${coreTop - 52}, ${cx} ${coreTop}`}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            {...steps.draw(T.paths + i * 60)}
          />
        ))}
        {/* endurance input → core */}
        <motion.path
          d={`M ${cx} ${botY} C ${cx} ${botY - 46}, ${cx} ${coreBot + 46}, ${cx} ${coreBot}`}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          {...steps.draw(T.paths + 180)}
        />
        {/* node dots */}
        {[...xs.map((x) => [x, topY] as const), [cx, botY] as const].map(([x, y], i) => (
          <motion.circle
            key={`n${x}-${y}`}
            cx={x}
            cy={y}
            r="2.5"
            fill="rgba(255,255,255,0.45)"
            {...steps.at(T.paths + i * 60)}
          />
        ))}
      </svg>

      {/* Strength inputs */}
      <div className="absolute inset-x-0 top-0">
        <motion.div {...steps.at(T.labels)} className={`text-center ${LABEL}`}>
          Strength
        </motion.div>
        <div className="mt-5 grid grid-cols-3">
          {DEMO_INPUTS.strength.map((input, i) => (
            <motion.div
              key={input.label}
              {...steps.at(T.labels + 80 + i * 60)}
              className="text-center"
            >
              <div className="text-[15px] tabular-nums text-ink">
                {input.value}
                <span className="ml-0.5 text-[11px] text-subtle">kg</span>
              </div>
              <div className="mt-1 text-[11px] text-subtle">{input.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Core */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
        <Readout size="lg" steps={steps} />
      </div>

      {/* Endurance input */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="text-center">
          <motion.div {...steps.at(T.labels + 260)} className="text-[15px] tabular-nums text-ink">
            {DEMO_INPUTS.endurance[0].value}
          </motion.div>
          <motion.div
            {...steps.at(T.labels + 300)}
            className="mt-1 text-[11px] text-subtle"
          >
            {DEMO_INPUTS.endurance[0].label}
          </motion.div>
        </div>
        <motion.div {...steps.at(T.labels + 40)} className={`mt-5 text-center ${LABEL}`}>
          Endurance
        </motion.div>
      </div>
    </div>
  );
}

/* ── Mobile ──────────────────────────────────────────────────────────────── */

function MobileModel({ steps }: { steps: ReturnType<typeof useSteps> }) {
  // Two input columns at the top converge into the readout below them.
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="grid grid-cols-2 gap-4">
        <motion.div {...steps.at(T.labels)}>
          <div className={LABEL}>Strength</div>
          <div className="mt-2.5 space-y-1">
            {DEMO_INPUTS.strength.map((input) => (
              <div key={input.label} className="text-[13px] text-lead">
                <span className="tabular-nums text-ink">{input.value}</span>
                <span className="text-subtle"> kg {input.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...steps.at(T.labels + 60)} className="text-right">
          <div className={LABEL}>Endurance</div>
          <div className="mt-2.5 text-[13px] text-lead">
            <span className="tabular-nums text-ink">
              {DEMO_INPUTS.endurance[0].value}
            </span>
            <span className="text-subtle"> {DEMO_INPUTS.endurance[0].label}</span>
          </div>
        </motion.div>
      </div>

      {/* Converging connectors */}
      <svg
        viewBox="0 0 340 64"
        className="mt-4 h-16 w-full"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <motion.path
          d="M 40 0 C 40 34, 170 26, 170 62"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          {...steps.draw(T.paths)}
        />
        <motion.path
          d="M 300 0 C 300 34, 170 26, 170 62"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          {...steps.draw(T.paths + 90)}
        />
      </svg>

      <div className="-mt-1">
        <Readout size="sm" steps={steps} />
      </div>
    </div>
  );
}

export default function HybridProfileModel() {
  const steps = useSteps();

  return (
    <div>
      <div className="hidden md:block">
        <DesktopModel steps={steps} />
      </div>
      <div className="md:hidden">
        <MobileModel steps={steps} />
      </div>
      <p className="mt-6 text-center text-[11px] text-subtle md:mt-2">
        Illustrative example — not a real athlete.
      </p>
    </div>
  );
}
