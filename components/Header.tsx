import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="relative z-50 w-full py-5 px-6 bg-black border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* LOGO */}
        <Link href="/" className="flex items-center">
  <Image
    src="/strendex-wordmark-3.png"
    alt="Strendex"
    width={1200}
    height={300}
    priority
    className="h-10 md:h-12 w-auto object-contain"
  />
</Link>

        {/* NAV */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-emerald-400 transition"
          >
            Home
          </Link>

          <Link
            href="/rankings"
            className="text-sm text-zinc-400 hover:text-emerald-400 transition"
          >
            Rankings
          </Link>
        </nav>

      </div>
    </header>
  );
}