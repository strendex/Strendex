import Link from "next/link";

// ── Hero ring sample (illustrative only — not real user data) ──
const SAMPLE = { score: 68, strength: 72, endurance: 58 };
const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;

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

  const steps = [
    {
      n: "01",
      t: "One honest score",
      d: "Your lifts and 5K become a single Hybrid Score from 0–100.",
    },
    {
      n: "02",
      t: "See your percentile",
      d: "Strength and Endurance percentiles show where you land in the field.",
    },
    {
      n: "03",
      t: "Climb the leaderboard",
      d: "Compare against the dataset and rise up the rankings.",
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
        className="flex flex-col gap-14 sm:gap-12 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16"
        style={{
          paddingTop: "clamp(36px, 7vw, 72px)",
          paddingBottom: "clamp(56px, 9vw, 96px)",
        }}
      >
        {/* LEFT — copy + CTA */}
        <div className="flex flex-col items-start">
          {/* Eyebrow (sanctioned lime accent) */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Hybrid Athlete Benchmark
          </span>

          {/* Headline — Anton condensed display */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              marginTop: "var(--space-2)",
              fontSize: "clamp(58px, 15vw, 96px)",
              fontWeight: 400,
              lineHeight: 0.92,
              letterSpacing: "0.005em",
              textTransform: "uppercase",
              color: "var(--ink)",
              maxWidth: "12ch",
            }}
          >
            Strength. Endurance. One score.
          </h1>

          {/* Subheadline — honest, no real-user implication */}
          <p
            style={{
              marginTop: "var(--space-3)",
              fontSize: "clamp(16px, 1.5vw, 19px)",
              lineHeight: "var(--leading-body)",
              color: "var(--muted)",
              maxWidth: "46ch",
            }}
          >
            Enter your lifts and your 5K time. Get a single Hybrid Score, ranked
            against the dataset.
          </p>

          {/* CTAs — one lime solid, one outline */}
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
                borderRadius: "999px",
                border: "1px solid var(--hairline)",
                background: "transparent",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--ink)",
                textDecoration: "none",
                padding: "16px 30px",
                minHeight: "54px",
                whiteSpace: "nowrap",
              }}
            >
              View rankings
            </Link>
          </div>
        </div>

        {/* RIGHT — Hybrid Score as art: borderless circular ring */}
        <div className="mx-auto w-full lg:mx-0 lg:justify-self-end">
          <div
            className="mx-auto flex flex-col items-center"
            style={{
              width: "100%",
              maxWidth: "360px",
              background: "#16191F",
              border: "1px solid var(--hairline)",
              borderRadius: "24px",
              padding: "clamp(24px, 6vw, 32px)",
            }}
          >
            {/* Example tag */}
            <span
              style={{
                borderRadius: "999px",
                border: "1px solid var(--hairline)",
                padding: "5px 12px",
                marginBottom: "20px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Example
            </span>
            {/* Ring — smaller on phones, full size at sm+ (desktop unchanged) */}
            <div className="relative aspect-square w-full max-w-[188px] sm:max-w-[320px]">
              <svg
                viewBox="0 0 300 300"
                width="100%"
                height="100%"
                aria-hidden="true"
              >
                {/* track */}
                <circle
                  cx="150"
                  cy="150"
                  r={RING_R}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="16"
                />
                {/* progress */}
                <circle
                  cx="150"
                  cy="150"
                  r={RING_R}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - SAMPLE.score / 100)}
                  transform="rotate(-90 150 150)"
                />
              </svg>

              {/* Centered score */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Hybrid Score
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(56px, 16vw, 104px)",
                    lineHeight: 0.9,
                    color: "var(--accent)",
                    marginTop: "6px",
                  }}
                >
                  {SAMPLE.score}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginTop: "4px",
                  }}
                >
                  out of 100
                </span>
              </div>
            </div>

            {/* Stats — borderless */}
            <div
              className="grid grid-cols-2"
              style={{
                width: "100%",
                maxWidth: "300px",
                marginTop: "var(--space-3)",
                gap: "var(--space-2)",
              }}
            >
              {[
                { label: "Strength", value: SAMPLE.strength },
                { label: "Endurance", value: SAMPLE.endurance },
              ].map((item) => (
                <div key={item.label} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      fontFamily: "var(--font-display)",
                      fontSize: "34px",
                      lineHeight: 1,
                      color: "var(--ink)",
                    }}
                  >
                    {item.value}
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginTop: "4px",
                    }}
                  >
                    percentile
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          THREE STEPS
      ══════════════════════════ */}
      <section
        style={{
          paddingTop: "clamp(56px, 7vw, 80px)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col items-start">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "40px",
                  lineHeight: 1,
                  color: "var(--ink)",
                }}
              >
                {s.n}
              </span>
              <h3
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "18px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--ink)",
                }}
              >
                {s.t}
              </h3>
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  color: "var(--muted)",
                  maxWidth: "32ch",
                }}
              >
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════
          ATHLETE REVIEW
      ══════════════════════════ */}
      <section
        style={{
          marginTop: "clamp(64px, 10vw, 112px)",
          paddingTop: "clamp(36px, 7vw, 80px)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          New · Athlete Review
        </span>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1.05,
            letterSpacing: "0.005em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: "var(--space-2) 0 0",
          }}
        >
          Your score is only the beginning
        </h2>
        <p
          style={{
            marginTop: "var(--space-3)",
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--muted)",
            maxWidth: "58ch",
          }}
        >
          Strendex can analyze your training, goals, recovery and performance
          gap to show where your biggest opportunity is hiding — including
          estimated score scenarios computed from your own numbers. A short
          guided assessment, a full structured review. Free during early
          access.
        </p>
        <Link
          href="/athlete-review"
          style={{
            display: "inline-block",
            marginTop: "var(--space-4)",
            padding: "12px 24px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "var(--ink)",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Explore Athlete Review
        </Link>
      </section>

      {/* ══════════════════════════
          FAQ
      ══════════════════════════ */}
      <section
        style={{
          marginTop: "clamp(64px, 10vw, 112px)",
          paddingTop: "clamp(36px, 7vw, 80px)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1,
            letterSpacing: "0.005em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: "0 0 var(--space-4)",
          }}
        >
          Quick answers
        </h2>

        <div style={{ borderTop: "1px solid var(--hairline)" }}>
          {faqs.map((f) => (
            <details
              key={f.q}
              style={{ borderBottom: "1px solid var(--hairline)" }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "20px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  userSelect: "none",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {f.q}
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  style={{ flexShrink: 0, color: "var(--muted)" }}
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 5.5l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <div
                style={{
                  paddingBottom: "20px",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  color: "var(--muted)",
                  maxWidth: "var(--measure)",
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
        className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between"
        style={{
          marginTop: "clamp(44px, 10vw, 112px)",
          paddingTop: "clamp(36px, 7vw, 80px)",
          paddingBottom: "clamp(56px, 9vw, 96px)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 6vw, 56px)",
            lineHeight: 0.95,
            letterSpacing: "0.005em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
            maxWidth: "14ch",
          }}
        >
          Find your Hybrid Score
        </h2>
        <Link
          href="/tool"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flexShrink: 0,
            borderRadius: "999px",
            backgroundColor: "var(--accent)",
            color: "var(--base)",
            fontSize: "16px",
            fontWeight: 700,
            padding: "16px 32px",
            minHeight: "54px",
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
      </section>
    </main>
  );
}
