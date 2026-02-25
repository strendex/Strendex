import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#020203]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* LOGO (icon only) */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Strendex"
            width={44}
            height={44}
            priority
            className="h-10 w-10 object-contain"
          />
        </Link>

        {/* NAV (shows on mobile) */}
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-xs font-semibold tracking-widest text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            HOME
          </Link>

          <Link
            href="/tool"
            className="rounded-lg px-3 py-2 text-xs font-semibold tracking-widest text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            TOOL
          </Link>

          <Link
            href="/rankings"
            className="rounded-lg px-3 py-2 text-xs font-semibold tracking-widest text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            RANK
          </Link>
        </nav>
      </div>
    </header>
  );
}