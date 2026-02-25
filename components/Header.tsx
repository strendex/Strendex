import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020203]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/strendex-wordmark-3.png"
            alt="Strendex"
            width={1200}
            height={300}
            priority
            className="h-9 md:h-10 w-auto object-contain"
          />
        </Link>

        {/* NAV */}
        <nav className="flex items-center gap-2 md:gap-3">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Home
          </Link>

          <Link
            href="/tool"
            className="rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Tool
          </Link>

          <Link
            href="/rankings"
            className="rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Rankings
          </Link>

          <Link
            href="/about"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white md:inline-flex"
          >
            About
          </Link>

          {/* CTA */}
          <Link
            href="/tool"
            className="ml-2 inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15"
          >
            Calculate
          </Link>
        </nav>
      </div>
    </header>
  );
}