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
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Strendex"
              width={32}
              height={32}
              priority
              className="object-contain"
              style={{ width: "32px", height: "32px" }}
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "white",
                textTransform: "uppercase",
              }}
            >
              Strendex
            </span>
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
                ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.88)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)")
              }
            >
              Rankings
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
                ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.88)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)")
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