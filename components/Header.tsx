import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020203]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

        {/* LEFT — Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Strendex"
            width={44}
            height={44}
            priority
            className="h-10 w-10 object-contain"
          />
        </Link>

        {/* CENTER — Main navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/rankings"
            className="text-sm font-semibold tracking-wide text-white/70 transition hover:text-white"
          >
            Rankings
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold tracking-wide text-white/70 transition hover:text-white"
          >
            About
          </Link>
        </nav>

        {/* RIGHT — Primary action */}
        <Link
          href="/tool"
          className="rounded-xl bg-[#DFFF00] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Calculate Score
        </Link>
      </div>
    </header>
  );
}