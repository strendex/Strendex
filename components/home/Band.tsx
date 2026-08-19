/**
 * A section whose background tone bleeds the full width of the viewport while
 * its content stays inside the shared layout column.
 *
 * This exists because app/layout.tsx wraps every page in one max-w-6xl column.
 * Without the bleed, giving a section its own tone would draw a 1152px-wide
 * rectangle on the page — an obvious box. With it, the tone reads as the page
 * itself changing depth.
 *
 * The steps between tones are 1–3%. They should be felt rather than noticed.
 */

const TONES = {
  base: "",
  band: "bg-band",
  deep: "bg-deep",
} as const;

export default function Band({
  tone = "base",
  className = "",
  children,
  id,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`relative ${className}`}>
      {tone !== "base" && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 ${TONES[tone]}`}
        />
      )}
      <div className="relative">{children}</div>
    </section>
  );
}
