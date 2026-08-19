/**
 * Product-grade controls, not marketing pills.
 *
 * The previous version was a 54px fully-rounded lime capsule with an arrow
 * glyph — the shape reads as a template CTA rather than a control belonging to
 * a performance tool. This is 48/52px with a 10px radius, controlled padding,
 * and a 1px lift on hover. No glow, no arrow, no scale.
 *
 * Built on shadcn's `buttonVariants` so focus-visible rings, disabled handling
 * and icon sizing stay consistent with the rest of the app.
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CtaButtonProps = {
  href: string;
  children: React.ReactNode;
  /**
   * `primary` — lime, one per viewport.
   * `secondary` — understated outline for a supporting action.
   */
  tone?: "primary" | "secondary";
  className?: string;
};

const BASE =
  "h-12 sm:h-[52px] rounded-[10px] px-6 text-[15px] tracking-[-0.005em] " +
  "transition-[transform,background-color,border-color,color] duration-150 ease-out " +
  "hover:-translate-y-px active:translate-y-0 motion-reduce:transform-none";

export default function CtaButton({
  href,
  children,
  tone = "primary",
  className,
}: CtaButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: tone === "primary" ? "default" : "outline" }),
        BASE,
        // dark: variants are explicit — <html> carries `dark`, so the recipes'
        // own dark:bg-* rules would otherwise win.
        tone === "primary"
          ? "bg-accent font-semibold text-[#0E1014] hover:bg-accent hover:brightness-[1.06]"
          : "border-white/12 bg-transparent font-medium text-lead hover:border-white/22 hover:bg-white/[0.03] hover:text-ink " +
              "dark:border-white/12 dark:bg-transparent dark:hover:border-white/22 dark:hover:bg-white/[0.03]",
        className
      )}
    >
      {children}
    </Link>
  );
}
