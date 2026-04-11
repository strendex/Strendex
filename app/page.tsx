import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

async function getStats() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase
      .from("submissions")
      .select("rank")
      .eq("status", "approved");
    if (error || !data) return { count: 0, tiers: {} };
    const tiers: Record<string, number> = {};
    data.forEach((r) => {
      const t = r.rank ?? "NOVICE";
      tiers[t] = (tiers[t] ?? 0) + 1;
    });
    return { count: data.length, tiers };
  } catch {
    return { count: 0, tiers: {} };
  }
}

export default async function Home() {
  const { count, tiers } = await getStats();

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

  const ArrowIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 7h10M8 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <main
      className="font-sans antialiased selection:bg-[#DFFF00]/20"
      style={{ backgroundColor: "#020203", color: "#f4f4f5" }}
    >

      {/* ══════════════════════════
          HERO
      ══════════════════════════ */}
      <section
        style={{
          paddingTop: "16px",
          paddingBottom: "0",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "1120px" }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">

            {/* LEFT */}
            <div className="flex-1 lg:max-w-[520px]">
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

              <h1
                style={{
                  marginTop: "20px",
                  fontSize: "clamp(36px, 8.5vw, 66px)",
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "white",
                }}
              >
                Find out where you actually rank.
              </h1>

              <p
                className="hidden lg:block"
                style={{
                  marginTop: "20px",
                  fontSize: "17px",
                  lineHeight: 1.65,
                  color: "rgba(255,255,255,0.45)",
                  maxWidth: "460px",
                }}
              >
                The benchmark for athletes who lift heavy and run far. One
                score, two percentiles, compared against everyone who has
                tested.
              </p>

              <p
                className="lg:hidden"
                style={{
                  marginTop: "16px",
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Strength percentile. Endurance percentile. One score.
              </p>

              <div
                style={{
                  marginTop: "28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <Link
                  href="/tool"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    backgroundColor: "#DFFF00",
                    color: "#000",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    padding: "16px 32px",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Get my score →
                </Link>
                <Link
                  href="/rankings"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.34)",
                    textDecoration: "none",
                    paddingLeft: "4px",
                    lineHeight: 1,
                  }}
                >
                  View Rankings →
                </Link>
              </div>
            </div>

            {/* RIGHT — athlete card preview */}
            <div
              className="hidden lg:block lg:flex-1"
              style={{ maxWidth: "480px", width: "100%" }}
            >
              <div
                className="lg:border lg:border-white/[0.05] lg:bg-white/[0.015]"
                style={{ borderRadius: "24px", overflow: "hidden" }}
              >
                {/* Card header — desktop only */}
                <div
                  className="hidden lg:flex"
                  style={{
                    padding: "20px 24px 16px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.05)",
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
                        border: "0.5px solid rgba(255,255,255,0.08)",
                        background: "rgba(0,0,0,0.4)",
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
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "white", lineHeight: 1 }}>
                        Athlete Card
                      </div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginTop: "3px" }}>
                        Preview
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "999px",
                      border: "0.5px solid rgba(52,211,153,0.22)",
                      background: "rgba(52,211,153,0.08)",
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
                <div style={{ padding: "18px" }}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                        Athlete
                      </div>
                      <div style={{ marginTop: "4px", fontSize: "20px", fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Anonymous
                      </div>
                      <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {["ADVANCED", "STRENGTH-LEANING"].map((tag) => (
                          <span
                            key={tag}
                            style={{
                              borderRadius: "999px",
                              border: "0.5px solid rgba(255,255,255,0.08)",
                              background: "rgba(255,255,255,0.02)",
                              padding: "4px 10px",
                              fontSize: "10px",
                              fontWeight: 600,
                              letterSpacing: "0.15em",
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                        Hybrid Score
                      </div>
                      <div style={{ marginTop: "4px", fontSize: "56px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em", color: "white" }}>
                        68
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[{ label: "Strength", value: "72" }, { label: "Engine", value: "58" }].map((item) => (
                      <div key={item.label} style={{ borderRadius: "14px", border: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "16px" }}>
                        <div style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                          {item.label}
                        </div>
                        <div style={{ marginTop: "6px", fontSize: "26px", fontWeight: 600, color: "white", lineHeight: 1 }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    {[{ k: "BW", v: "195 lb" }, { k: "5K", v: "22:30" }, { k: "Total", v: "1065 lb" }].map((x) => (
                      <div key={x.k} style={{ borderRadius: "12px", border: "0.5px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.012)", padding: "12px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                          {x.k}
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
                          {x.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "20px", textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.05em" }}>
                    This is what you walk away with.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════
          DISTRIBUTION
      ══════════════════════════ */}
      <section style={{ marginTop: "72px" }}>
        <div
          style={{
            height: "0.5px",
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.09), transparent)",
            marginBottom: "40px",
          }}
        />

        {count >= 10 && (
          <>
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.18)",
                margin: "0 0 12px",
              }}
            >
              Score distribution — {count.toLocaleString()} athletes
            </p>

            <div
              style={{
                display: "flex",
                height: "4px",
                borderRadius: "999px",
                overflow: "hidden",
                gap: "2px",
              }}
            >
              {[
                { key: "NOVICE", color: "rgba(255,255,255,0.12)" },
                { key: "INTERMEDIATE", color: "rgba(251,191,36,0.42)" },
                { key: "ADVANCED", color: "rgba(167,139,250,0.52)" },
                { key: "ELITE", color: "rgba(56,189,248,0.58)" },
                { key: "WORLD CLASS", color: "#DFFF00" },
              ].map((tier) => {
                const n = tiers[tier.key] ?? 0;
                const pct = count > 0 ? (n / count) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={tier.key}
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: tier.color,
                      borderRadius: "999px",
                    }}
                  />
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                marginTop: "10px",
              }}
            >
              {[
                { key: "NOVICE", color: "rgba(255,255,255,0.22)", label: "Novice" },
                {
                  key: "INTERMEDIATE",
                  color: "rgba(251,191,36,0.6)",
                  label: "Intermediate",
                },
                {
                  key: "ADVANCED",
                  color: "rgba(167,139,250,0.7)",
                  label: "Advanced",
                },
                { key: "ELITE", color: "rgba(56,189,248,0.7)", label: "Elite" },
                { key: "WORLD CLASS", color: "#DFFF00", label: "World Class" },
              ].map((tier) => {
                const n = tiers[tier.key] ?? 0;
                const pct = count > 0 ? Math.round((n / count) * 100) : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={tier.key}
                    style={{ display: "flex", alignItems: "center", gap: "5px" }}
                  >
                    <div
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        backgroundColor: tier.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.22)",
                      }}
                    >
                      {tier.label} {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ══════════════════════════
          PROBLEM STATEMENT
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(60px, 8vw, 100px)" }}>
        <p
          style={{
            fontSize: "clamp(26px, 6vw, 42px)",
            fontWeight: 600,
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            color: "white",
            maxWidth: "680px",
            margin: "0 0 20px",
          }}
        >
          Strength platforms ignore your endurance.
          Endurance platforms ignore your strength.{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            Neither tells you where you stand as a hybrid athlete.
          </span>
        </p>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.36)",
            maxWidth: "500px",
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
      <section style={{ marginTop: "clamp(60px, 8vw, 100px)" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
            margin: "0 0 16px",
          }}
        >
          How it works
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 5vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "white",
            margin: "0 0 52px",
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
              d: "Download your athlete card, post it, and challenge others. Check the leaderboard to see where you land.",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              style={{
                display: "flex",
                gap: "22px",
                paddingBottom: i < 2 ? "40px" : "0",
                borderBottom:
                  i < 2 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                marginBottom: i < 2 ? "40px" : "0",
              }}
            >
              <div style={{ flexShrink: 0, paddingTop: "2px", width: "28px" }}>
                <span
                  style={{
                    fontSize: "12px",
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
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "white",
                    margin: "0 0 7px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.t}
                </p>
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.36)",
                    margin: 0,
                    maxWidth: "520px",
                  }}
                >
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "48px" }}>
          <Link
            href="/tool"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              borderRadius: "999px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "15px 28px",
              textDecoration: "none",
            }}
          >
            Get my score
            <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════
          SECOND STATEMENT
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(60px, 8vw, 100px)" }}>
        <div
          style={{
            height: "0.5px",
            background: "rgba(255,255,255,0.07)",
            marginBottom: "56px",
          }}
        />
        <p
          style={{
            fontSize: "clamp(24px, 5vw, 36px)",
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "white",
            maxWidth: "600px",
            margin: "0 0 18px",
          }}
        >
          The more athletes test,{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            the more accurate your percentile becomes.
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
          Every submission improves the benchmark. Your score gets more
          meaningful as the dataset grows — that&apos;s the point.
        </p>
      </section>

      {/* ══════════════════════════
          FAQ
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(60px, 8vw, 100px)" }}>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
            margin: "0 0 14px",
          }}
        >
          FAQ
        </p>
        <h2
          style={{
            fontSize: "clamp(24px, 5vw, 34px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "white",
            margin: "0 0 36px",
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
                  padding: "20px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  userSelect: "none",
                }}
              >
                <span
                  style={{ fontSize: "15px", fontWeight: 600, color: "white" }}
                >
                  {f.q}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ flexShrink: 0, opacity: 0.35 }}
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="white"
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
      <section style={{ marginTop: "clamp(60px, 8vw, 100px)", paddingBottom: "60px" }}>
        <div
          style={{
            height: "0.5px",
            background: "rgba(255,255,255,0.07)",
            marginBottom: "72px",
          }}
        />

        <h2
          style={{
            fontSize: "clamp(34px, 9vw, 64px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.035em",
            color: "white",
            maxWidth: "560px",
            margin: "0 0 20px",
          }}
        >
          Are you actually a hybrid athlete?
        </h2>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.33)",
            maxWidth: "380px",
            margin: "0 0 34px",
          }}
        >
          Find out in 60 seconds. Free, no sign-up, instant result.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <Link
            href="/tool"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              borderRadius: "999px",
              backgroundColor: "#DFFF00",
              color: "#000",
              fontSize: "15px",
              fontWeight: 700,
              padding: "15px 28px",
              textDecoration: "none",
            }}
          >
            Get my score
            <ArrowIcon />
          </Link>
          <Link
            href="/rankings"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.25)",
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