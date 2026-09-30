import Hero from "@/components/home/Hero";
import BalanceStory from "@/components/home/BalanceStory";
import HowItWorks from "@/components/home/HowItWorks";
import ExampleResult from "@/components/home/ExampleResult";
import AthleteReviewPreview from "@/components/home/AthleteReviewPreview";
import FinalCTA from "@/components/home/FinalCTA";

export const metadata = {
  title: "STRENDEX | Hybrid Athlete Benchmarking",
  description:
    "Benchmark your strength and endurance together. Get a Hybrid Score, see your balance, identify the limiting side of your profile, and compare your result.",
};

export default function Home() {
  return (
    <>
      {/*
        Scroll reveals start at opacity 0. With JS disabled they would never
        run, so this restores every revealed element to its resting state.
        Scoped to the homepage; `[data-reveal]` is set by components/home/motion.tsx.
      */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/*
        Tonal rhythm rather than rules: base → band → base → deep → base →
        base. Each step is 1–3%, so the page gains depth without reading as
        alternating panels. Sections own their vertical padding so compositions
        can differ instead of stacking uniformly.

        LeaderboardPreview (a band section between AthleteReviewPreview and
        FinalCTA) is temporarily hidden while rankings are closed. The
        component is kept; re-import and render it there to restore it.
      */}
      <div className="selection:bg-accent/20">
        <Hero />
        <BalanceStory />
        <HowItWorks />
        <ExampleResult />
        <AthleteReviewPreview />
        <FinalCTA />
      </div>
    </>
  );
}
