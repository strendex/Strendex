import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const faqs = [
    {
      q: "Do I need to sign up?",
      a: "No — run the calculator and get your result instantly.",
    },
    {
      q: "What endurance test do I use?",
      a: "Use a real 5K time. Any distance works — we convert it to the same standard.",
    },
    {
      q: "What should I input for lifts?",
      a: "Your honest recent bests. True 1RMs if you have them. It's a benchmark, not a lab test.",
    },
    {
      q: "Can I compare with friends?",
      a: "Yes — share your card and use Rankings to see where you land.",
    },
  ];

  return (
    <main
      className="font-sans antialiased selection:bg-[#DFFF00]/20"
      style={{ backgroundColor: "var(--base)", color: "var(--ink)" }}
    >
      {/* ══════════════════════════
          HERO
      ══════════════════════════ */}
      <section
        className="flex flex-col gap-12 sm:gap-16 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20"
        style={{
          paddingTop: "clamp(40px, 9vw, 88px)",
          paddingBottom: "var(--section-gap)",
        }}
      >
        {/* LEFT — copy + CTA, anchored left */}
        <div className="flex flex-col items-start">
          {/* Eyebrow */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Hybrid Athlete Benchmark
          </span>

          {/* Headline */}
          <h1
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-h1)",
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              color: "var(--ink)",
              maxWidth: "15ch",
            }}
          >
            One score for how strong and fit you really are.
          </h1>

          {/* Subheadline */}
          <p
            style={{
              marginTop: "var(--space-3)",
              fontSize: "clamp(16px, 1.5vw, 19px)",
              lineHeight: "var(--leading-body)",
              color: "var(--muted)",
              maxWidth: "var(--measure)",
            }}
          >
            Enter your lifts and your run time. Get a single hybrid score,
            ranked against everyone who&apos;s tested.
          </p>

          {/* CTAs — one primary, one quiet ghost link */}
          <div
            className="flex w-full flex-col items-stretch sm:w-auto sm:flex-row sm:items-center"
            style={{ marginTop: "var(--space-5)", gap: "var(--space-2)" }}
          >
            <Link
              href="/tool"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                borderRadius: "999px",
                backgroundColor: "var(--accent)",
                color: "var(--base)",
                fontSize: "16px",
                fontWeight: 700,
                padding: "16px 32px",
                minHeight: "54px",
                textDecoration: "none",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                boxShadow: "0 10px 34px -8px rgba(223,255,0,0.35)",
              }}
            >
              Get my score
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <Link
              href="/rankings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--muted)",
                textDecoration: "none",
                padding: "12px 12px",
                minHeight: "44px",
              }}
            >
              View rankings →
            </Link>
          </div>
        </div>

        {/* RIGHT — athlete score card, anchored right (shown on all sizes) */}
        <div
          className="mx-auto w-full lg:mx-0 lg:justify-self-end"
          style={{ maxWidth: "440px" }}
        >
          {/* Card — layered solid surfaces, hairline border, soft depth */}
          <div
            style={{
              position: "relative",
              borderRadius: "24px",
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              boxShadow:
                "0 30px 70px -24px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 10,
                padding: "var(--space-3)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      border: "1px solid var(--hairline)",
                      background: "var(--elevated)",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src="/logo.png"
                      alt="Strendex"
                      fill
                      className="object-contain p-1"
                      priority
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "var(--ink)",
                      textTransform: "uppercase",
                    }}
                  >
                    STRENDEX
                  </span>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "999px",
                    border: "1px solid var(--hairline)",
                    background: "var(--elevated)",
                    padding: "4px 10px",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    color: "var(--muted)",
                  }}
                >
                  ADVANCED
                </span>
              </div>

              {/* Score */}
              <div
                style={{
                  marginTop: "var(--space-3)",
                  textAlign: "center",
                  padding: "28px 0 24px",
                  borderRadius: "18px",
                  border: "1px solid var(--hairline)",
                  background: "var(--elevated)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.28em",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Hybrid Score
                </div>
                <div
                  style={{
                    fontSize: "88px",
                    fontWeight: 800,
                    lineHeight: 0.95,
                    letterSpacing: "-0.05em",
                    color: "var(--accent)",
                    marginTop: "10px",
                  }}
                >
                  68
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    marginTop: "8px",
                  }}
                >
                  out of 100
                </div>
              </div>

              {/* Percentiles */}
              <div
                style={{
                  marginTop: "var(--space-1)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-1)",
                }}
              >
                {[
                  { label: "Strength", value: "72" },
                  { label: "Engine", value: "58" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: "14px",
                      border: "1px solid var(--hairline)",
                      background: "var(--elevated)",
                      padding: "14px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "26px",
                        fontWeight: 700,
                        color: "var(--ink)",
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {item.value}
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "var(--muted)",
                        marginTop: "3px",
                        letterSpacing: "0.1em",
                      }}
                    >
                      percentile
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  marginTop: "var(--space-2)",
                  height: "1px",
                  background: "var(--hairline)",
                }}
              />
              <div
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  fontSize: "10px",
                  color: "var(--muted)",
                  letterSpacing: "0.06em",
                }}
              >
                This is what you walk away with.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          PROBLEM
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(96px, 22vw, 104px)" }}>
        <div
          style={{
            height: "0.5px",
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)",
            marginBottom: "clamp(48px, 7vw, 80px)",
          }}
        />
        <p
          style={{
            fontSize: "clamp(24px, 5vw, 38px)",
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "white",
            maxWidth: "640px",
            margin: "0 0 18px",
          }}
        >
          Strength platforms ignore your endurance. Endurance platforms ignore
          your strength.{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            Neither tells you where you stand as a hybrid athlete.
          </span>
        </p>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.36)",
            maxWidth: "480px",
            margin: 0,
          }}
        >
          STRENDEX is the first benchmark built for athletes who do both — a
          single honest score that measures your complete athletic profile.
        </p>
      </section>

      {/* ══════════════════════════
          HOW IT WORKS
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
            margin: "0 0 14px",
          }}
        >
          How it works
        </p>
        <h2
          style={{
            fontSize: "clamp(24px, 5vw, 36px)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "white",
            margin: "0 0 48px",
          }}
        >
          Three inputs. One verdict.
        </h2>

        <div>
          {[
            {
              n: "01",
              t: "Enter 5 numbers",
              d: "Bodyweight, bench, squat, deadlift, and your 5K time. Takes under a minute.",
            },
            {
              n: "02",
              t: "Get your verdict",
              d: "Hybrid Score (0–100), Strength Percentile, Endurance Percentile, tier, and archetype — all calculated against the real dataset.",
            },
            {
              n: "03",
              t: "Share and compare",
              d: "Download your athlete card, post it, challenge others. Check the leaderboard to see where you land.",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              style={{
                display: "flex",
                gap: "20px",
                paddingBottom: i < 2 ? "36px" : "0",
                borderBottom:
                  i < 2 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                marginBottom: i < 2 ? "36px" : "0",
              }}
            >
              <div style={{ flexShrink: 0, paddingTop: "2px", width: "24px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#DFFF00",
                    letterSpacing: "0.06em",
                    opacity: 0.9,
                  }}
                >
                  {s.n}
                </span>
              </div>
              <div>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "white",
                    margin: "0 0 6px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.t}
                </p>
                <p
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.36)",
                    margin: 0,
                    maxWidth: "480px",
                  }}
                >
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "44px" }}>
          <Link
            href="/tool"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "999px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "15px 30px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Get my score
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════
          STATEMENT
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <div
          style={{
            height: "0.5px",
            background: "rgba(255,255,255,0.06)",
            marginBottom: "clamp(48px, 7vw, 72px)",
          }}
        />
        <p
          style={{
            fontSize: "clamp(22px, 5vw, 34px)",
            fontWeight: 600,
            lineHeight: 1.22,
            letterSpacing: "-0.02em",
            color: "white",
            maxWidth: "560px",
            margin: "0 0 16px",
          }}
        >
          The more athletes test,{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            the more accurate your percentile becomes.
          </span>
        </p>
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.34)",
            maxWidth: "440px",
            margin: 0,
          }}
        >
          Every submission improves the benchmark. Your score gets more
          meaningful as the dataset grows — that&apos;s the point.
        </p>
      </section>

      {/* ══════════════════════════
          FAQ
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
            margin: "0 0 12px",
          }}
        >
          FAQ
        </p>
        <h2
          style={{
            fontSize: "clamp(22px, 4vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "white",
            margin: "0 0 32px",
          }}
        >
          Quick answers.
        </h2>

        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          {faqs.map((f) => (
            <details
              key={f.q}
              style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "18px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  userSelect: "none",
                }}
              >
                <span
                  style={{ fontSize: "14px", fontWeight: 600, color: "white" }}
                >
                  {f.q}
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  style={{ flexShrink: 0, opacity: 0.3 }}
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 5.5l4 4 4-4"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <div
                style={{
                  paddingBottom: "18px",
                  fontSize: "14px",
                  lineHeight: 1.7,
                  color: "rgba(255,255,255,0.36)",
                }}
              >
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ══════════════════════════
          FINAL CTA
      ══════════════════════════ */}
      <section
        style={{ marginTop: "clamp(64px, 10vw, 104px)", paddingBottom: "72px" }}
      >
        <div
          style={{
            height: "0.5px",
            background: "rgba(255,255,255,0.06)",
            marginBottom: "clamp(48px, 7vw, 72px)",
          }}
        />
        <h2
          style={{
            fontSize: "clamp(30px, 8vw, 56px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "white",
            maxWidth: "520px",
            margin: "0 0 16px",
          }}
        >
          Are you actually a hybrid athlete?
        </h2>
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.32)",
            maxWidth: "360px",
            margin: "0 0 30px",
          }}
        >
          Find out in 60 seconds. Free, no sign-up, instant result.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            alignItems: "flex-start",
          }}
        >
          <Link
            href="/tool"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "999px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "15px 30px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Get my score
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/rankings"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.24)",
              textDecoration: "none",
            }}
          >
            View the leaderboard →
          </Link>
        </div>
      </section>
    </main>
  );
}
