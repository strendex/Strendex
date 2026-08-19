"use client";

/**
 * Shared motion primitives for the homepage.
 *
 * House rules encoded here:
 *  - Entrances are ~400–700ms, translate 12–20px, and fire once.
 *  - Nothing is comprehension-critical. `prefers-reduced-motion` collapses
 *    every transition to zero so elements land in their final state
 *    immediately, and `[data-reveal]` carries a <noscript> fallback (see
 *    app/page.tsx) so the page reads correctly with JS disabled.
 */

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type Transition,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

/** Standard house easing — quick out, long settle. No overshoot, no bounce. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** How long the score count-up runs. */
export const SCORE_DURATION_MS = 900;

export const ENTER: Transition = { duration: 0.55, ease: EASE };
export const ENTER_SLOW: Transition = { duration: 0.7, ease: EASE };

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** useLayoutEffect on the client, useEffect on the server (avoids SSR warning). */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Media-query hook. Uses useSyncExternalStore so the browser's media state is
 * treated as the external store it is — no setState-in-effect, no extra render
 * pass, and a defined server snapshot (`false`, i.e. animate by default).
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Reads the reduced-motion preference. */
export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED_QUERY);
}

type RevealProps = {
  children: React.ReactNode;
  /** Seconds. Used to stagger siblings — keep the total under ~0.3s. */
  delay?: number;
  /** Travel distance in px. House range is 12–20. */
  y?: number;
  className?: string;
  /** `li` keeps list semantics intact when revealing rows inside a <ul>. */
  as?: "div" | "li";
};

/**
 * Scroll-triggered fade + rise. Animates once, on entry, and never again.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: RevealProps) {
  const reduced = usePrefersReducedMotion();

  const initial = { opacity: 0, y };
  const whileInView = { opacity: 1, y: 0 };
  const viewport = { once: true, amount: 0.2, margin: "0px 0px -80px 0px" };
  const transition = reduced ? { duration: 0 } : { ...ENTER, delay };

  if (as === "li") {
    return (
      <motion.li
        data-reveal=""
        className={className}
        initial={initial}
        whileInView={whileInView}
        viewport={viewport}
        transition={transition}
      >
        {children}
      </motion.li>
    );
  }

  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={initial}
      whileInView={whileInView}
      viewport={viewport}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts from 0 up to `target` exactly once, then holds.
 *
 * Returns a MotionValue of the rounded integer, not React state: the tween
 * runs outside React entirely, so a 900ms count-up costs zero re-renders.
 * Render it as the child of a `motion` element — `<motion.span>{display}</…>`.
 *
 * The value is seeded to `target` so server-rendered HTML always contains the
 * real number. On mount we drop to 0 in a layout effect — before paint, so
 * there is no flash — but only when motion is actually allowed.
 *
 * This replaces a hand-rolled rAF loop that carried two live bugs:
 *
 *  1. It derived progress from the rAF frame timestamp while capturing `start`
 *     with performance.now() inside the effect. The frame timestamp precedes
 *     that, so the first tick ran at t < 0 — and easeOutExpo is *negative* for
 *     negative t, rendering the score as "-2" before it ever counted up.
 *
 *  2. It listed `inView` in its dependency array and cancelled the animation in
 *     the effect cleanup. The moment the element became visible `inView`
 *     flipped, the cleanup killed the in-flight tween, and the numeral froze on
 *     that bogus first frame. Only a *hidden* copy ever reached the real value.
 */
export function useCountUp(
  target: number,
  durationMs = SCORE_DURATION_MS,
  /**
   * Start on mount rather than on scroll-into-view. Used by the hero, which is
   * above the fold.
   */
  immediate = false
) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = usePrefersReducedMotion();

  const count = useMotionValue(target);
  const display = useTransform(count, (v) => Math.round(v).toString());

  const started = useRef(false);
  const controls = useRef<ReturnType<typeof animate> | null>(null);

  useIsoLayoutEffect(() => {
    if (window.matchMedia(REDUCED_QUERY).matches) return;
    count.set(0);
  }, [count]);

  // One-shot, and deliberately without a cleanup: cancelling here is precisely
  // bug (2) above. `started` makes re-runs from dependency churn a no-op.
  useEffect(() => {
    if (started.current) return;

    if (reduced) {
      started.current = true;
      count.set(target);
      return;
    }

    if (!(inView || immediate)) return;

    started.current = true;
    controls.current = animate(count, target, {
      duration: durationMs / 1000,
      ease: EASE,
    });
  }, [inView, immediate, target, durationMs, reduced, count]);

  // Stop only on unmount — never on a dependency change.
  useEffect(() => () => controls.current?.stop(), []);

  return { ref, display };
}

/**
 * Horizontal meter that grows from zero on entry. `value` is 0–100.
 * The caller always renders the number alongside it, so the bar is never the
 * only way to read the figure.
 */
export function Meter({
  value,
  className = "",
  barClassName = "bg-accent",
  delay = 0,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}
      role="presentation"
    >
      {reduced ? (
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${pct}%` }}
        />
      ) : (
        <motion.div
          className={`h-full rounded-full ${barClassName}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.75, ease: EASE, delay }}
        />
      )}
    </div>
  );
}
