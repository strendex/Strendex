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
      className="min-h-screen font-sans antialiased selection:bg-[#DFFF00]/20"
      style={{ backgroundColor: "#020203", color: "#f4f4f5" }}
    >
      {/* ── FIXED BACKGROUND ── */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: "#020203" }} />
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          className="absolute -top-48 left-1/2 -translate-x-1/2"
          style={{
            width: "900px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(223,255,0,0.07), transparent 62%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section
        style={{
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingTop: "72px",
          paddingBottom: "0px",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* Pill */}
          <div
            className="inline-flex items-center gap-2"
            style={{
              borderRadius: "999px",
              border: "0.5px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              padding: "6px 14px",
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#DFFF00",
                opacity: 0.9,
                flexShrink: 0,
              }}
            />
            Hybrid athlete benchmark
          </div>

          {/* Headline */}
          <h1
            style={{
              marginTop: "24px",
              fontSize: "clamp(42px, 10vw, 72px)",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "white",
            }}
          >
            Find out where you actually rank.
          </h1>

          {/* Subheading */}
          <p
            style={{
              marginTop: "20px",
              fontSize: "17px",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.45)",
              maxWidth: "480px",
            }}
          >
            The benchmark for athletes who lift heavy and run far. One score,
            two percentiles, compared against everyone who has tested.
          </p>

          {/* Primary CTA */}
          <div style={{ marginTop: "36px" }}>
            <Link
              href="/tool"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                maxWidth: "320px",
                borderRadius: "14px",
                backgroundColor: "#DFFF00",
                color: "#000",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.01em",
                padding: "18px 28px",
                textDecoration: "none",
                
              }}
              
            >
              Get my score →
            </Link>

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <span
                style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)" }}
              >
                Free · no sign-up · 60 seconds
              </span>
              <Link
                href="/rankings"
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.45)",
                  textDecoration: "none",
                }}
              >
                View Rankings →
              </Link>
            </div>
          </div>
        </div>

        {/* ── ATHLETE CARD PREVIEW ── */}
        <div
          style={{
            maxWidth: "680px",
            margin: "52px auto 0",
            borderRadius: "24px",
            border: "0.5px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.025)",
            overflow: "hidden",
          }}
        >
          {/* Card header */}
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
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
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "white",
                    lineHeight: 1,
                  }}
                >
                  Athlete Card
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.3)",
                    marginTop: "3px",
                  }}
                >
                  Preview
                </div>
              </div>
            </div>
            <div
              style={{
                borderRadius: "999px",
                border: "0.5px solid rgba(52,211,153,0.25)",
                background: "rgba(52,211,153,0.1)",
                padding: "5px 12px",
                fontSize: "11px",
                fontWeight: 600,
                color: "rgb(167,243,208)",
              }}
            >
              Top 28% of hybrid athletes
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: "24px" }}>
            {/* Athlete row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.28)",
                  }}
                >
                  Athlete
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "white",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Anonymous
                </div>
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  {["ADVANCED", "STRENGTH-LEANING"].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        borderRadius: "999px",
                        border: "0.5px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.03)",
                        padding: "4px 10px",
                        fontSize: "10px",
                        fontWeight: 600,
                        letterSpacing: "0.15em",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.28)",
                  }}
                >
                  Hybrid Score
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "56px",
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "white",
                  }}
                >
                  68
                </div>
              </div>
            </div>

            {/* Percentile split */}
            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
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
                    border: "0.5px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.025)",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.28)",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "26px",
                      fontWeight: 600,
                      color: "white",
                      lineHeight: 1,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
              }}
            >
              {[
                { k: "BW", v: "195 lb" },
                { k: "5K", v: "22:30" },
                { k: "Total", v: "1065 lb" },
              ].map((x) => (
                <div
                  key={x.k}
                  style={{
                    borderRadius: "12px",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.015)",
                    padding: "12px 10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.24)",
                    }}
                  >
                    {x.k}
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {x.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Card footer caption */}
            <div
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "11px",
                color: "rgba(255,255,255,0.2)",
                letterSpacing: "0.05em",
              }}
            >
              This is what you walk away with.
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          STATEMENT BREAK
      ══════════════════════════════ */}
      <section
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "96px 20px 0",
        }}
      >
        <p
          style={{
            fontSize: "clamp(28px, 6vw, 44px)",
            fontWeight: 600,
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            color: "white",
          }}
        >
          Most athletes train both.{" "}
          <span style={{ color: "rgba(255,255,255,0.3)" }}>
            Almost none know where they actually stand.
          </span>
        </p>
        <p
          style={{
            marginTop: "20px",
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.38)",
            maxWidth: "480px",
          }}
        >
          Existing platforms score strength or endurance — never both together.
          STRENDEX is the first benchmark built specifically for hybrid athletes.
        </p>
      </section>

      {/* ══════════════════════════════
          HOW IT WORKS — Linear style
      ══════════════════════════════ */}
      <section
        id="how"
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "96px 20px 0",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          How it works
        </div>
        <h2
          style={{
            marginTop: "12px",
            fontSize: "clamp(28px, 6vw, 42px)",
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
            color: "white",
          }}
        >
          Three inputs. One verdict.
        </h2>
        <p
          style={{
            marginTop: "16px",
            fontSize: "16px",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.38)",
          }}
        >
          No fluff, no sign-up. Just where you stand.
        </p>

        {/* Steps — vertical, generous spacing */}
        <div style={{ marginTop: "56px", display: "flex", flexDirection: "column", gap: "0" }}>
          {[
            {
              n: "01",
              t: "Enter 5 numbers",
              d: "Bodyweight, bench, squat, deadlift, and your 5K time. Takes about a minute.",
            },
            {
              n: "02",
              t: "Get your verdict",
              d: "Hybrid Score (0–100), Strength Percentile, Endurance Percentile, tier, and archetype.",
            },
            {
              n: "03",
              t: "Share and compare",
              d: "Download your athlete card, post it, and challenge others. Check Rankings to see where you land.",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              style={{
                display: "flex",
                gap: "24px",
                paddingBottom: i < 2 ? "48px" : "0",
                position: "relative",
              }}
            >
              {/* Left: number + line */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                  width: "32px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.4)",
                    flexShrink: 0,
                  }}
                >
                  {s.n}
                </div>
                {i < 2 && (
                  <div
                    style={{
                      width: "0.5px",
                      flex: 1,
                      background:
                        "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)",
                      marginTop: "8px",
                    }}
                  />
                )}
              </div>

              {/* Right: content */}
              <div style={{ paddingTop: "4px", flex: 1 }}>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "white",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.t}
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.38)",
                  }}
                >
                  {s.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA after steps */}
        <div style={{ marginTop: "52px" }}>
          <Link
            href="/tool"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              maxWidth: "320px",
              borderRadius: "14px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "18px 28px",
              textDecoration: "none",
            }}
          >
            Get my score →
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════
          SECOND STATEMENT
      ══════════════════════════════ */}
      <section
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "96px 20px 0",
        }}
      >
        <p
          style={{
            fontSize: "clamp(28px, 6vw, 44px)",
            fontWeight: 600,
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            color: "white",
          }}
        >
          The more athletes test,{" "}
          <span style={{ color: "rgba(255,255,255,0.3)" }}>
            the more accurate your percentile becomes.
          </span>
        </p>
        <p
          style={{
            marginTop: "20px",
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.38)",
            maxWidth: "480px",
          }}
        >
          Every submission improves the benchmark. Your score gets more
          meaningful as the dataset grows — that's the point.
        </p>
      </section>

      {/* ══════════════════════════════
          FAQ
      ══════════════════════════════ */}
      <section
        id="faq"
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "96px 20px 0",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          FAQ
        </div>
        <h2
          style={{
            marginTop: "12px",
            fontSize: "clamp(28px, 6vw, 42px)",
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
            color: "white",
          }}
        >
          Quick answers.
        </h2>

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            flexDirection: "column",
            gap: "0",
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
          }}
        >
          {faqs.map((f) => (
            <details
              key={f.q}
              style={{ borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "22px 0",
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
                    color: "white",
                  }}
                >
                  {f.q}
                </span>
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    color: "rgba(255,255,255,0.4)",
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
              </summary>
              <div
                style={{
                  paddingBottom: "22px",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  color: "rgba(255,255,255,0.38)",
                }}
              >
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          FINAL CTA
      ══════════════════════════════ */}
      <section
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "96px 20px 120px",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(32px, 8vw, 56px)",
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "white",
          }}
        >
          Are you actually a hybrid athlete?
        </h2>
        <p
          style={{
            marginTop: "18px",
            fontSize: "16px",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.38)",
            maxWidth: "440px",
          }}
        >
          Find out in 60 seconds. Free, no sign-up, instant result.
        </p>
        <div
          style={{
            marginTop: "36px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <Link
            href="/tool"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              maxWidth: "320px",
              borderRadius: "14px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "18px 28px",
              textDecoration: "none",
            }}
          >
            Get my score →
          </Link>
          <Link
            href="/rankings"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
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