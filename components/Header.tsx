"use client";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        background: "rgba(2,2,3,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{
          maxWidth: "1120px",
          padding: "0 20px",
          height: "58px",
        }}
      >
        {/* LEFT — Logo + nav together */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            {/* Desktop: full wordmark */}
            <Image
              src="/logo-wordmark.png"
              alt="Strendex"
              width={2551}
              height={404}
              priority
              className="hidden md:block"
              style={{ height: "22px", width: "auto" }}
            />
            {/* Mobile: S mark only */}
            <Image
              src="/logo-mark.png"
              alt="Strendex"
              width={620}
              height={583}
              priority
              className="block md:hidden"
              style={{ height: "30px", width: "auto" }}
            />
          </Link>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/rankings"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.88)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.5)")
              }
            >
              Rankings
            </Link>
            <Link
              href="/athlete-review"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "color 0.15s",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.88)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.5)")
              }
            >
              Athlete Review
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                New
              </span>
            </Link>
            <Link
              href="/about"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.88)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.5)")
              }
            >
              About
            </Link>
          </nav>
        </div>

        {/* RIGHT — CTA */}
        <Link
          href="/tool"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "999px",
            backgroundColor: "#DFFF00",
            color: "#000",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.01em",
            padding: "10px 20px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Calculate Score
        </Link>
      </div>
    </header>
  );
}
