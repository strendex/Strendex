import Link from "next/link";

export const metadata = {
  title: "Page not found — STRENDEX",
};

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:py-32">
      <p className="text-sm font-semibold uppercase tracking-widest text-white/50">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-white/70">
        The page you’re looking for doesn’t exist or has moved.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/tool"
          className="inline-flex items-center justify-center rounded-full bg-[#DFFF00] px-6 py-3 text-sm font-bold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DFFF00]"
        >
          Calculate Score
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className="rounded px-1 py-2 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            Home
          </Link>
          <Link
            href="/rankings"
            className="rounded px-1 py-2 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            Rankings
          </Link>
        </nav>
      </div>
    </section>
  );
}
