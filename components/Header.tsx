import Link from "next/link";
import Image from "next/image";

/**
 * Visual refinement only — the routes, the link set and their order are
 * unchanged.
 *
 * ── Why this bar is opaque and unblurred ──────────────────────────────────
 * It used to be `bg-base/72 backdrop-blur-xl`. Lime passing underneath — the
 * hero CTA, the Hybrid Score numeral — bloomed through that blur and read as a
 * glow sitting behind the logo. A solid base fill removes the effect entirely
 * and costs nothing: the bar is the page's own background colour, so it does
 * not read as a band on top of the page either.
 */

const NAV_LINK =
  "text-[13px] font-medium text-white/55 transition-colors duration-150 hover:text-white/90";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-base">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-[62px] sm:px-6 lg:px-8">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-wordmark.png"
              alt="Strendex"
              width={2551}
              height={404}
              priority
              className="hidden md:block"
              style={{ height: "20px", width: "auto" }}
            />
            <Image
              src="/logo-mark.png"
              alt="Strendex"
              width={620}
              height={583}
              priority
              className="block md:hidden"
              style={{ height: "26px", width: "auto" }}
            />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/rankings" className={NAV_LINK}>
              Rankings
            </Link>
            <Link href="/athlete-review" className={`${NAV_LINK} inline-flex items-center gap-2`}>
              Athlete Review
              <span className="rounded border border-white/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.1em] text-white/50">
                New
              </span>
            </Link>
            <Link href="/about" className={NAV_LINK}>
              About
            </Link>
          </nav>
        </div>

        <Link
          href="/tool"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-accent px-3 text-[12px] font-semibold whitespace-nowrap text-[#0E1014] transition-[filter] duration-150 hover:brightness-[1.06] sm:h-9 sm:px-4 sm:text-[13px]"
        >
          Get your Hybrid Score
        </Link>
      </div>
    </header>
  );
}
