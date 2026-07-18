"use client";

// Structured report renderer — premium modular layout, never one text blob.
// AI text renders inside modules; every number in the scenario module comes
// from deterministic Strendex code.

import { useEffect } from "react";
import Link from "next/link";
import type {
  AthleteReviewResponse,
  Scenario,
} from "@/lib/athleteReview/types";
import { trackAthleteReview } from "@/lib/athleteReview/analytics";
import { Kicker } from "./primitives";

function Module({
  kicker,
  children,
  highlight = false,
}: {
  kicker: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border p-6 ${
        highlight
          ? "border-white/20 bg-white/[0.05]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <Kicker>{kicker}</Kicker>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const IMPACT_META: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: { label: "High impact", className: "border-white/30 bg-white/[0.08] text-white" },
  medium: { label: "Medium impact", className: "border-white/15 bg-white/[0.04] text-white/70" },
  low: { label: "Low impact", className: "border-white/10 bg-white/[0.03] text-white/50" },
};

function ScenarioCard({ scenario, currentScore }: { scenario: Scenario; currentScore: number }) {
  useEffect(() => {
    trackAthleteReview("athlete_review_scenario_viewed", {
      scenario_id: scenario.id,
      available: scenario.available,
      is_primary: scenario.isPrimary,
    });
    // fire once per card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!scenario.available || !scenario.projected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white/45">{scenario.title}</div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/40">
            Locked
          </span>
        </div>
        <p className="mt-2 text-xs text-white/40">{scenario.description}</p>
      </div>
    );
  }

  const { projected } = scenario;
  const gain = projected.hqDelta;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        scenario.isPrimary
          ? "border-white/25 bg-white/[0.06]"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{scenario.title}</div>
        <div className="flex items-center gap-1.5">
          {scenario.isPrimary ? (
            <span className="rounded-full border border-white/25 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/80">
              Best fit
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/45">
            Estimate
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">
        {scenario.description}
      </p>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-sm text-white/50">{currentScore}</span>
        <span aria-hidden="true" className="text-white/30">
          →
        </span>
        <span className="text-2xl font-semibold text-[#DFFF00]">
          {projected.hq}
        </span>
        <span className="text-sm font-semibold text-white/80">
          {gain >= 0 ? `+${gain}` : gain} pts
        </span>
      </div>
      <div className="mt-1 text-[11px] text-white/40">
        Estimated over ~{scenario.horizonWeeks} weeks · {projected.tier}
      </div>
    </div>
  );
}

export default function ReportView({
  result,
  onRetake,
}: {
  result: AthleteReviewResponse;
  onRetake: () => void;
}) {
  const { report, scenarios, computed } = result;

  return (
    <div className="space-y-4">
      {/* 1–2 · Header, headline + summary */}
      <header className="pt-2">
        <Kicker>ATHLETE REVIEW</Kicker>
        <h1 className="mt-3 text-2xl font-semibold leading-snug text-white sm:text-3xl">
          {report.headline}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/65">
          {report.athleteSummary}
        </p>
      </header>

      {/* 3 · Current performance profile */}
      <Module kicker="CURRENT PROFILE">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold text-[#DFFF00]">
            {computed.hq}
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{computed.tier}</div>
            <div className="text-xs text-white/50">{computed.archetype}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Strength %ile", value: computed.strengthPercentile },
            { label: "Endurance %ile", value: computed.endurancePercentile },
            { label: "Strength index", value: computed.strengthIndex },
            { label: "Endurance index", value: computed.enduranceIndex },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-black/30 p-3"
            >
              <div className="text-[11px] text-white/45">{stat.label}</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          {report.profileInterpretation}
        </p>
      </Module>

      {/* 4 · Strengths */}
      <Module kicker="WHAT'S WORKING · 3 STRENGTHS">
        <div className="space-y-4">
          {report.strengths.map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm font-semibold text-white">{s.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                {s.explanation}
              </p>
              <div className="mt-2 text-xs text-white/45">
                <span className="text-white/60">Evidence:</span> {s.evidence}
              </div>
            </div>
          ))}
        </div>
      </Module>

      {/* 5 · Limiters */}
      <Module kicker="WHAT'S HOLDING YOU BACK · 3 LIMITERS">
        <div className="space-y-4">
          {report.limiters.map((l, i) => {
            const impact = IMPACT_META[l.impact];
            return (
              <div key={i} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{l.title}</div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${impact.className}`}
                  >
                    {impact.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                  {l.explanation}
                </p>
                <div className="mt-2 text-xs text-white/45">
                  <span className="text-white/60">Evidence:</span> {l.evidence}
                </div>
              </div>
            );
          })}
        </div>
      </Module>

      {/* 6 · Highest-leverage move */}
      <Module kicker="HIGHEST-LEVERAGE MOVE" highlight>
        <h2 className="text-lg font-semibold text-white">
          {report.highestLeverageMove.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {report.highestLeverageMove.why}
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              What to do
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {report.highestLeverageMove.whatToDo}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              What to maintain
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {report.highestLeverageMove.whatToMaintain}
            </p>
          </div>
        </div>
      </Module>

      {/* 7 · Estimated score scenarios */}
      <Module kicker="ESTIMATED SCORE SCENARIOS">
        <div className="space-y-3">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} currentScore={computed.hq} />
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-white/40">
          Scenarios are computed by Strendex&apos;s deterministic scoring — not by
          AI — and are estimates, not guarantees. Rankings and population data
          can change as the dataset grows. Nothing here is submitted to the
          leaderboard.
        </p>
      </Module>

      {/* 8 · Priorities */}
      <Module kicker="YOUR PRIORITIES · IN ORDER">
        <ol className="space-y-4">
          {report.priorities.map((p) => (
            <li key={p.priority} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white">
                {p.priority}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{p.action}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  {p.reason}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Module>

      {/* 9 · Focus plan */}
      <Module kicker={`NEXT ${report.focusPlan.durationWeeks} WEEKS · FOCUS`}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              Strength
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {report.focusPlan.strengthFocus}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              Endurance
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {report.focusPlan.enduranceFocus}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-white/45">
            Weekly structure
          </div>
          <ul className="mt-2 space-y-1.5">
            {report.focusPlan.weeklyStructure.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-white/70">
                <span aria-hidden="true" className="text-white/30">
                  —
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </Module>

      {/* 10 · Recovery priority */}
      <Module kicker="RECOVERY PRIORITY">
        <p className="text-sm leading-relaxed text-white/75">
          {report.focusPlan.recoveryFocus}
        </p>
      </Module>

      {/* 11 · Retest */}
      <Module kicker="WHEN TO RETEST">
        <div className="text-sm font-semibold text-white">
          Retest in about {report.retest.recommendedWeeks} weeks
        </div>
        <ul className="mt-3 space-y-1.5">
          {report.retest.metricsToRetest.map((m, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-white/70">
              <span aria-hidden="true" className="text-white/30">
                —
              </span>
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          <span className="text-white/75">Success signal:</span>{" "}
          {report.retest.successSignal}
        </p>
      </Module>

      {/* 12 · Confidence + disclaimer */}
      <footer className="px-2 pb-4 pt-2">
        <p className="text-xs leading-relaxed text-white/45">
          {report.confidenceNote}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          {report.disclaimer}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/tool"
            className="flex-1 rounded-2xl bg-[#DFFF00] px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
          >
            Back to my score
          </Link>
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
          >
            Retake assessment
          </button>
        </div>
      </footer>
    </div>
  );
}
