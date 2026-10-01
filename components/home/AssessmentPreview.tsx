"use client";

/**
 * Section 2 — what the result tells you, before anyone has one.
 *
 * It replaces a worked example built around one fictional athlete. That gave
 * visitors a specific score, tier and limiter to read as if they were real, so
 * this section shows the SHAPE of a result instead and never a value:
 *
 *   Where you stand              — the tier scale the Hybrid Score sits on.
 *   What kind of athlete you are — the strength ↔ endurance axis.
 *   What's holding you back      — two sides, one trailing: the limiter.
 *
 * Nothing here is a reading. There is no marker on the tier scale, no position
 * on the axis, and the two tracks are labelled leading and trailing rather
 * than strength and endurance, because either side can be the limiter.
 *
 * The tier ranges are the engine's own boundaries, pinned to getTier by
 * tests/homepageAssessment.test.ts. Like ./demo-data, this module does not
 * import lib/scoring.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 * Each reading reveals when it scrolls into view: the tiers light up from the
 * bottom, the balance axis grows outward from its centre, and the trailing
 * track stops short before its gap and the limiter flag appear. Readings that
 * arrive together are spaced STAGE_GAP apart, so the three always read in
 * order. Every animation runs once.
 *
 * Every animated element starts hidden inline and carries `data-reveal`, so
 * the <noscript> rule in app/page.tsx restores it without JS. Reduced motion
 * resolves everything to its final state immediately, and the copy carries the
 * full meaning without any of it.
 */

import { useEffect, useRef } from "react";
import { stagger, useAnimate, useInView } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Band from "./Band";
import { EASE, Reveal, usePrefersReducedMotion } from "./motion";

/** The engine's tier boundaries (lib/scoring/core getTier), lowest first. */
export const TIER_SCALE = [
  { tier: "NOVICE", label: "Novice", min: 0, max: 39 },
  { tier: "INTERMEDIATE", label: "Intermediate", min: 40, max: 59 },
  { tier: "ADVANCED", label: "Advanced", min: 60, max: 74 },
  { tier: "ELITE", label: "Elite", min: 75, max: 89 },
  { tier: "WORLD CLASS", label: "World class", min: 90, max: 100 },
] as const;

/** Each tier a step brighter than the last: a scale, not a reading. */
const TIER_FILL = [
  "bg-white/15",
  "bg-white/25",
  "bg-white/35",
  "bg-white/50",
  "bg-white/70",
];

type StageId = "stand" | "type" | "limiter";

/** Seconds between the starts of readings that come into view together. */
const STAGE_GAP = 0.35;

const HIDDEN = { opacity: 0 } as const;
const HIDDEN_RISE = { opacity: 0, transform: "translateY(12px)" } as const;
const COLLAPSED = { transform: "scaleX(0)" } as const;

const STAGE_LABEL =
  "text-[12px] font-semibold uppercase tracking-[0.16em] text-ink";
const STAGE_BODY = "mt-3 max-w-[44ch] text-[15px] leading-[1.6] text-lead";

function Stage({
  id,
  title,
  children,
  visual,
  stageRef,
}: {
  id: StageId;
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <CardContent
      ref={stageRef}
      data-stage={id}
      className="grid gap-6 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14 lg:px-9 lg:py-9"
    >
      <div data-part="copy" data-reveal="" style={HIDDEN_RISE}>
        <h3 className={STAGE_LABEL}>{title}</h3>
        <p className={STAGE_BODY}>{children}</p>
      </div>
      {visual}
    </CardContent>
  );
}

/** Where you stand: the five tiers and their score ranges. */
function TierScale() {
  return (
    <ol
      aria-label="Tiers by Hybrid Score"
      className="flex flex-col-reverse gap-2 sm:grid sm:grid-cols-5 sm:gap-1.5"
    >
      {TIER_SCALE.map((t, i) => (
        <li key={t.tier} className="flex items-center gap-3 sm:block">
          <span
            aria-hidden="true"
            data-part="tier"
            data-reveal=""
            style={HIDDEN}
            className={cn(
              "block h-6 w-[3px] shrink-0 rounded-full sm:h-[3px] sm:w-full",
              TIER_FILL[i]
            )}
          />
          <span
            data-part="tier-label"
            data-reveal=""
            style={HIDDEN}
            className="flex flex-1 items-baseline justify-between gap-3 sm:mt-3 sm:block"
          >
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.1em] text-lead">
              {t.label}
            </span>
            <span className="block text-[11px] tabular-nums text-subtle sm:mt-1">
              {t.min}–{t.max}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What kind of athlete you are: an axis with no one placed on it. */
function BalanceAxis() {
  return (
    <div aria-hidden="true">
      <div className="relative flex h-[3px] gap-[3px]">
        <span
          data-part="side"
          data-reveal=""
          style={COLLAPSED}
          className="block flex-[3] origin-right rounded-l-full bg-white/20"
        />
        <span
          data-part="mid"
          data-reveal=""
          style={COLLAPSED}
          className="block flex-[2] origin-center bg-white/55"
        />
        <span
          data-part="side"
          data-reveal=""
          style={COLLAPSED}
          className="block flex-[3] origin-left rounded-r-full bg-white/20"
        />
        {/* The balance point the zones grow out from. */}
        <span className="absolute -top-[4px] left-1/2 h-[11px] w-px -translate-x-1/2 bg-white/40" />
      </div>
      <div
        data-part="label"
        data-reveal=""
        style={HIDDEN}
        className="mt-3.5 flex justify-between gap-2 text-[11px] text-subtle sm:text-[12px]"
      >
        <span>Strength-leaning</span>
        <span className="text-lead">Balanced</span>
        <span className="text-right">Endurance-leaning</span>
      </div>
    </div>
  );
}

/** What's holding you back: whichever side trails is the limiter. */
function LimiterTracks() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div>
        <div className="text-[12px] text-lead">Leading side</div>
        <div className="mt-2.5 h-[3px] rounded-full bg-white/[0.06]">
          <span
            data-part="bar"
            data-reveal=""
            style={COLLAPSED}
            className="block h-full w-[84%] origin-left rounded-full bg-white/60"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-lead">Trailing side</span>
          <span data-part="flag" data-reveal="" style={HIDDEN}>
            <Badge variant="outline">Limiter</Badge>
          </span>
        </div>
        <div className="relative mt-2.5 h-[3px] rounded-full bg-white/[0.06]">
          <span
            data-part="bar"
            data-reveal=""
            style={COLLAPSED}
            className="absolute inset-y-0 left-0 w-[48%] origin-left rounded-full bg-white/30"
          />
          <span
            data-part="gap"
            data-reveal=""
            style={HIDDEN}
            className="absolute -inset-y-[4px] left-[48%] w-[36%] rounded-[3px] border border-dashed border-white/25"
          />
        </div>
        <div
          data-part="gap"
          data-reveal=""
          style={HIDDEN}
          className="mt-3 pl-[48%] text-[11px] text-subtle sm:text-[12px]"
        >
          Room to improve
        </div>
      </div>
    </div>
  );
}

export default function AssessmentPreview() {
  const reduced = usePrefersReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();

  const standRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const limiterRef = useRef<HTMLDivElement>(null);
  const inView = { once: true, amount: 0.4 } as const;
  const standIn = useInView(standRef, inView);
  const typeIn = useInView(typeRef, inView);
  const limiterIn = useInView(limiterRef, inView);

  const played = useRef(new Set<StageId>());
  const nextStart = useRef(0);

  useEffect(() => {
    const visible: [StageId, boolean][] = [
      ["stand", standIn],
      ["type", typeIn],
      ["limiter", limiterIn],
    ];

    for (const [id, isIn] of visible) {
      if (!(isIn || reduced) || played.current.has(id)) continue;
      played.current.add(id);

      // Space this reading after the previous one if they arrived together.
      const now = performance.now() / 1000;
      const start = reduced ? now : Math.max(now, nextStart.current);
      nextStart.current = start + STAGE_GAP;
      const lead = start - now;

      const sel = (part: string) => `[data-stage="${id}"] [data-part="${part}"]`;
      const run = (
        part: string,
        keyframes: Record<string, number[]>,
        duration: number,
        at: number,
        step = 0
      ) =>
        animate(
          sel(part),
          keyframes,
          reduced
            ? { duration: 0 }
            : {
                duration,
                ease: EASE,
                delay: step ? stagger(step, { startDelay: lead + at }) : lead + at,
              }
        );

      run("copy", { opacity: [0, 1], y: [12, 0] }, 0.5, 0);

      if (id === "stand") {
        run("tier", { opacity: [0, 1] }, 0.35, 0.15, 0.08);
        run("tier-label", { opacity: [0, 1] }, 0.35, 0.25, 0.08);
      } else if (id === "type") {
        run("mid", { scaleX: [0, 1] }, 0.45, 0.15);
        run("side", { scaleX: [0, 1] }, 0.6, 0.5);
        run("label", { opacity: [0, 1] }, 0.4, 0.8);
      } else {
        run("bar", { scaleX: [0, 1] }, 0.8, 0.15);
        run("gap", { opacity: [0, 1] }, 0.4, 0.85);
        run("flag", { opacity: [0, 1] }, 0.35, 1.05);
      }
    }
  }, [standIn, typeIn, limiterIn, reduced, animate]);

  return (
    <Band tone="deep" className="py-[clamp(48px,6vw,88px)]">
      <Reveal>
        <h2 className="max-w-[20ch] text-balance text-[clamp(26px,2.8vw,36px)] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
          What your assessment tells you.
        </h2>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-lead">
          Your result is more than a score. It shows where your combined
          performance sits, how your profile leans, and which side has the most
          room to improve.
        </p>
      </Reveal>

      <div ref={scope} className="relative mt-9 rounded-2xl sm:mt-10">
        {/* A neutral edge light that follows the pointer. Off for reduced
            motion; touch screens never trigger it, and nothing depends on it. */}
        <GlowingEffect
          variant="white"
          disabled={reduced}
          proximity={64}
          spread={24}
          inactiveZone={0.01}
          movementDuration={1.2}
          className="opacity-30"
        />
        <Card className="relative gap-0 rounded-2xl py-0">
          <Stage
            id="stand"
            title="Where you stand"
            stageRef={standRef}
            visual={<TierScale />}
          >
            Your Hybrid Score brings strength and endurance onto one benchmark,
            giving you a clear read on your overall hybrid performance.
          </Stage>

          <Separator />

          <Stage
            id="type"
            title="What kind of athlete you are"
            stageRef={typeRef}
            visual={<BalanceAxis />}
          >
            Your strength-to-endurance balance shows whether your profile leans
            toward strength, toward endurance, or sits somewhere between the
            two. A high score can still lean heavily to one side.
          </Stage>

          <Separator />

          <Stage
            id="limiter"
            title="What’s holding you back"
            stageRef={limiterRef}
            visual={<LimiterTracks />}
          >
            The gap between your two sides reveals your limiter: the side with
            the most room to bring the rest of your profile up.
          </Stage>
        </Card>
      </div>
    </Band>
  );
}
