// components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-white/70">
            <div className="font-semibold text-white">STRENDEX</div>
            <div className="mt-1">
              Hybrid performance benchmarking — strength + endurance, one score.
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link className="text-white/70 hover:text-white" href="/about">
              About
            </Link>
            <Link className="text-white/70 hover:text-white" href="/methodology">
              Methodology
            </Link>
            <Link className="text-white/70 hover:text-white" href="/contact">
              Contact
            </Link>
            <Link className="text-white/70 hover:text-white" href="/privacy">
              Privacy
            </Link>
            <Link className="text-white/70 hover:text-white" href="/terms">
              Terms
            </Link>
          </nav>
        </div>

        <div className="mt-8 text-xs text-white/50">
          © {new Date().getFullYear()} Strendex. All rights reserved.
        </div>
      </div>
    </footer>
  );
}