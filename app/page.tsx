import Hero from "@/components/home/Hero";
import AssessmentPreview from "@/components/home/AssessmentPreview";
import BalanceStory from "@/components/home/BalanceStory";
import HowItWorks from "@/components/home/HowItWorks";
import AthleteReviewPreview from "@/components/home/AthleteReviewPreview";
import FinalCTA from "@/components/home/FinalCTA";

export const metadata = {
  title: "STRENDEX | Hybrid Athlete Assessment",
  description:
    "Assess your strength and endurance together. See where you stand, how your profile leans, and what’s limiting your hybrid performance.",
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
        Tonal rhythm rather than rules: base → deep → band → base → base,
        closing on a hairline. Each step is 1–3%, so the page gains depth
        without reading as alternating panels. Sections own their vertical
        padding so compositions can differ instead of stacking uniformly.

        LeaderboardPreview (a band section between AthleteReviewPreview and
        FinalCTA) is temporarily hidden while rankings are closed. The
        component is kept; re-import and render it there to restore it.
      */}
      <div className="selection:bg-accent/20">
        <Hero />
        <AssessmentPreview />
        <BalanceStory />
        <HowItWorks />
        <AthleteReviewPreview />
        <FinalCTA />
      </div>
    </>
  );
}
