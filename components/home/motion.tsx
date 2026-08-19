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

import { motion, useInView, type Transition } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** Standard house easing — quick out, long settle. No overshoot, no bounce. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * easeOutExpo, shared by the score ring and the score count-up so the arc and
 * the numeral arrive together. They previously used different curves, which
 * read as the number lagging the ring.
 */
export const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Both score animations run for exactly this long. */
export const SCORE_DURATION_MS = 1100;

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
 * Counts from 0 up to `target` the first time the element enters view.
 *
 * The value is seeded to `target` so server-rendered HTML always contains the
 * real number. On mount we drop to 0 in a layout effect — before paint, so
 * there is no flash — but only when motion is actually allowed.
 */
export function useCountUp(
  target: number,
  durationMs = SCORE_DURATION_MS,
  /**
   * Start on mount rather than on scroll-into-view. Used by the hero, which is
   * above the fold — and which renders a desktop and a mobile variant, only one
   * of which is ever `display: block`. An inView trigger would leave the hidden
   * variant stuck at 0 if the viewport later crossed the breakpoint.
   */
  immediate = false
) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [value, setValue] = useState(target);
  const animatingRef = useRef(false);

  useIsoLayoutEffect(() => {
    if (window.matchMedia(REDUCED_QUERY).matches) return;
    animatingRef.current = true;
    setValue(0);
  }, []);

  useEffect(() => {
    if (!(inView || immediate) || !animatingRef.current) return;
    animatingRef.current = false;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * easeOutExpo(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, immediate, target, durationMs]);

  return { ref, value };
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
