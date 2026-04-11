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
  const { count } = await getStats();

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
      style={{ backgroundColor: "#020203", color: "#f4f4f5" }}
    >

      {/* ══════════════════════════
          HERO
      ══════════════════════════ */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:gap-16">

        {/* LEFT */}
        <div className="flex-1 lg:max-w-[520px]">

          {/* Label */}
          <div
            className="inline-flex items-center gap-2"
            style={{
              borderRadius: "999px",
              border: "0.5px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              padding: "5px 13px",
              fontSize: "10px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#DFFF00", flexShrink: 0 }} />
            Hybrid Athlete Benchmark
          </div>

          {/* Headline */}
          <h1
            style={{
              marginTop: "18px",
              fontSize: "clamp(42px, 10vw, 72px)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: "white",
            }}
          >
            Find out where you actually rank.
          </h1>

          {/* Subheading mobile */}
          <p
            className="lg:hidden"
            style={{
              marginTop: "14px",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.38)",
            }}
          >
            Strength percentile. Endurance percentile. One score — compared against every hybrid athlete who has tested.
          </p>

          {/* Subheading desktop only */}
          <p
            className="hidden lg:block"
            style={{
              marginTop: "18px",
              fontSize: "17px",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.42)",
              maxWidth: "420px",
            }}
          >
            The benchmark for athletes who lift heavy and run far.
            One score, two percentiles, compared against everyone who has tested.
          </p>

          {/* CTAs */}
          <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
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
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              Get my score
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            {count > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingLeft: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#DFFF00", opacity: 0.7, boxShadow: "0 0 6px rgba(223,255,0,0.5)" }} />
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)" }}>
                    {count.toLocaleString()} athletes ranked
                  </span>
                </div>
                <Link href="/rankings" style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>
                  View Rankings →
                </Link>
              </div>
            )}
            {count === 0 && (
              <Link href="/rankings" style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.28)", textDecoration: "none", paddingLeft: "2px" }}>
                View Rankings →
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT — Athlete card */}
        <div
          className="hidden lg:block lg:flex-1"
          style={{ maxWidth: "460px", width: "100%" }}
        >
          {/* Card — inspired by tool page */}
          <div
            style={{
              position: "relative",
              borderRadius: "28px",
              background: "linear-gradient(180deg, #0A0B0F 0%, #07070A 50%, #050507 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Background glow */}
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
              <div style={{
                position: "absolute",
                top: "-80px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "320px",
                height: "240px",
                borderRadius: "50%",
                background: "radial-gradient(circle at center, rgba(223,255,0,0.14), transparent 65%)",
                filter: "blur(50px)",
              }} />
              <div style={{
                position: "absolute",
                inset: 0,
                opacity: 0.06,
                backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 70%)",
              }} />
              <div style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(85% 55% at 50% 0%, transparent 0%, rgba(7,7,10,0.5) 55%, rgba(7,7,10,0.97) 100%)",
              }} />
            </div>

            <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", border: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)", overflow: "hidden", position: "relative", flexShrink: 0 }}>
                    <Image src="/logo.png" alt="Strendex" fill className="object-contain p-1" priority />
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>STRENDEX</span>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "999px", border: "0.5px solid rgba(167,139,250,0.22)", background: "rgba(167,139,250,0.08)", padding: "4px 10px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", color: "rgb(196,181,253)" }}>
                  ADVANCED
                </span>
              </div>

              {/* Score */}
              <div style={{ marginTop: "24px", textAlign: "center", padding: "28px 0 24px", borderRadius: "18px", border: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: "-50px", left: "50%", transform: "translateX(-50%)", width: "180px", height: "180px", borderRadius: "50%", background: "radial-gradient(circle, rgba(223,255,0,0.1), transparent 68%)", filter: "blur(18px)", pointerEvents: "none" }} />
                <div style={{ fontSize: "10px", letterSpacing: "0.28em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>Hybrid Score</div>
                <div style={{ fontSize: "88px", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.05em", color: "white", marginTop: "10px", textShadow: "0 0 60px rgba(223,255,0,0.15)" }}>68</div>
                <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginTop: "8px" }}>out of 100</div>
              </div>

              {/* Percentiles */}
              <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[{ label: "Strength", value: "72" }, { label: "Engine", value: "58" }].map((item) => (
                  <div key={item.label} style={{ borderRadius: "14px", border: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>{item.label}</div>
                    <div style={{ marginTop: "5px", fontSize: "26px", fontWeight: 700, color: "white", lineHeight: 1, letterSpacing: "-0.02em" }}>{item.value}</div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", marginTop: "3px", letterSpacing: "0.1em" }}>percentile</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: "14px", height: "0.5px", background: "linear-gradient(to right, transparent, rgba(223,255,0,0.18), transparent)" }} />
              <div style={{ marginTop: "10px", textAlign: "center", fontSize: "10px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>
                This is what you walk away with.
              </div>

            </div>
          </div>
        </div>

      </section>

      {/* ══════════════════════════
          PROBLEM
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <div style={{ height: "0.5px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)", marginBottom: "clamp(48px, 7vw, 80px)" }} />
        <p style={{ fontSize: "clamp(24px, 5vw, 38px)", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.02em", color: "white", maxWidth: "640px", margin: "0 0 18px" }}>
          Strength platforms ignore your endurance.
          Endurance platforms ignore your strength.{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            Neither tells you where you stand as a hybrid athlete.
          </span>
        </p>
        <p style={{ fontSize: "16px", lineHeight: 1.7, color: "rgba(255,255,255,0.36)", maxWidth: "480px", margin: 0 }}>
          STRENDEX is the first benchmark built for athletes who do both — a single honest score that measures your complete athletic profile.
        </p>
      </section>

      {/* ══════════════════════════
          HOW IT WORKS
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", margin: "0 0 14px" }}>
          How it works
        </p>
        <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.025em", color: "white", margin: "0 0 48px" }}>
          Three inputs. One verdict.
        </h2>

        <div>
          {[
            { n: "01", t: "Enter 5 numbers", d: "Bodyweight, bench, squat, deadlift, and your 5K time. Takes under a minute." },
            { n: "02", t: "Get your verdict", d: "Hybrid Score (0–100), Strength Percentile, Endurance Percentile, tier, and archetype — all calculated against the real dataset." },
            { n: "03", t: "Share and compare", d: "Download your athlete card, post it, challenge others. Check the leaderboard to see where you land." },
          ].map((s, i) => (
            <div
              key={s.n}
              style={{
                display: "flex",
                gap: "20px",
                paddingBottom: i < 2 ? "36px" : "0",
                borderBottom: i < 2 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                marginBottom: i < 2 ? "36px" : "0",
              }}
            >
              <div style={{ flexShrink: 0, paddingTop: "2px", width: "24px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#DFFF00", letterSpacing: "0.06em", opacity: 0.9 }}>{s.n}</span>
              </div>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "white", margin: "0 0 6px", letterSpacing: "-0.01em" }}>{s.t}</p>
                <p style={{ fontSize: "14px", lineHeight: 1.65, color: "rgba(255,255,255,0.36)", margin: 0, maxWidth: "480px" }}>{s.d}</p>
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
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════
          STATEMENT
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: "clamp(48px, 7vw, 72px)" }} />
        <p style={{ fontSize: "clamp(22px, 5vw, 34px)", fontWeight: 600, lineHeight: 1.22, letterSpacing: "-0.02em", color: "white", maxWidth: "560px", margin: "0 0 16px" }}>
          The more athletes test,{" "}
          <span style={{ color: "rgba(255,255,255,0.22)" }}>
            the more accurate your percentile becomes.
          </span>
        </p>
        <p style={{ fontSize: "15px", lineHeight: 1.7, color: "rgba(255,255,255,0.34)", maxWidth: "440px", margin: 0 }}>
          Every submission improves the benchmark. Your score gets more meaningful as the dataset grows — that&apos;s the point.
        </p>
      </section>

      {/* ══════════════════════════
          FAQ
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", margin: "0 0 12px" }}>FAQ</p>
        <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, letterSpacing: "-0.025em", color: "white", margin: "0 0 32px" }}>
          Quick answers.
        </h2>

        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          {faqs.map((f) => (
            <details key={f.q} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", userSelect: "none" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{f.q}</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: 0.3 }} aria-hidden="true">
                  <path d="M3.5 5.5l4 4 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </summary>
              <div style={{ paddingBottom: "18px", fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.36)" }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ══════════════════════════
          FINAL CTA
      ══════════════════════════ */}
      <section style={{ marginTop: "clamp(64px, 10vw, 104px)", paddingBottom: "72px" }}>
        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: "clamp(48px, 7vw, 72px)" }} />
        <h2 style={{ fontSize: "clamp(30px, 8vw, 56px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "white", maxWidth: "520px", margin: "0 0 16px" }}>
          Are you actually a hybrid athlete?
        </h2>
        <p style={{ fontSize: "15px", lineHeight: 1.65, color: "rgba(255,255,255,0.32)", maxWidth: "360px", margin: "0 0 30px" }}>
          Find out in 60 seconds. Free, no sign-up, instant result.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
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
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link href="/rankings" style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.24)", textDecoration: "none" }}>
            View the leaderboard →
          </Link>
        </div>
      </section>

    </main>
  );
}