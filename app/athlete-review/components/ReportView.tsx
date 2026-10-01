"use client";

// Structured report renderer. The top of the report is the deterministic
// performance diagnosis — every number there is read from `result.diagnosis`,
// which the server builds from Strendex scoring (lib/athleteReview/diagnosis.ts).
// The AI-written analysis follows it and never supplies a number above it.

import { useEffect } from "react";
import Link from "next/link";
import type {
  AthleteReviewDiagnosis,
  AthleteReviewResponse,
  Scenario,
} from "@/lib/athleteReview/types";
import { trackAthleteReview } from "@/lib/athleteReview/analytics";
import { unavailableScenarioCopy, type ScenarioTargets } from "@/lib/athleteReview/targets";
import type { RunDistance } from "@/lib/scoring/core";

const KICKER = "text-[10px] uppercase tracking-[0.25em] text-white/40";
const PROSE = "text-[15px] leading-relaxed text-white/75";
const PANEL = "rounded-3xl border border-white/10 bg-white/[0.03]";

/** One analytics event per scenario shown, wherever the report shows it. */
function useScenarioViewed(scenario: { id: string; available: boolean; isPrimary: boolean }) {
  useEffect(() => {
    trackAthleteReview("athlete_review_scenario_viewed", {
      scenario_id: scenario.id,
      available: scenario.available,
      is_primary: scenario.isPrimary,
    });
    // fire once per scenario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const points = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
const percentilePoints = (n: number) => `${n} percentile point${n === 1 ? "" : "s"}`;

function formatGain(gain: number): string {
  if (gain === 0) return "No change";
  return `${gain > 0 ? "+" : "−"}${Math.abs(gain)} pt${Math.abs(gain) === 1 ? "" : "s"}`;
}

const SIDE_LABEL = { strength: "Strength", endurance: "Endurance" } as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-white/10 pt-8">
      <h2 id={id} className="text-lg font-semibold text-white">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---- Deterministic diagnosis ------------------------------------------------

function ProfileBar({
  label,
  value,
  lower,
}: {
  label: string;
  value: number;
  lower: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-lg font-semibold tabular-nums text-white">
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="presentation">
        <div
          className={`h-full rounded-full ${lower ? "bg-white/35" : "bg-white/75"}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function HoldingBack({ d }: { d: AthleteReviewDiagnosis }) {
  if (d.leadingSide === "balanced" || d.trailingSide === null) {
    return (
      <>
        <p className="text-[15px] font-medium leading-snug text-white">
          Your strength and endurance are closely matched.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/50">
          {d.percentileGap === 0
            ? "Your percentiles are level"
            : `Only ${percentilePoints(d.percentileGap)} apart`}
          , so your next points can come from either side.
        </p>
      </>
    );
  }
  const lower = SIDE_LABEL[d.trailingSide];
  const higher = SIDE_LABEL[d.leadingSide];
  return (
    <>
      <p className="text-[15px] font-medium leading-snug text-white">
        {lower} is your lower side, {percentilePoints(d.percentileGap)} behind{" "}
        {higher.toLowerCase()}.
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">
        It often has more room to move. A percentile point counts the same on
        either side of your Hybrid Score.
      </p>
    </>
  );
}

function Diagnosis({ result }: { result: AthleteReviewResponse }) {
  const d = result.diagnosis;
  return (
    <section aria-labelledby="diagnosis-heading">
      <h2 id="diagnosis-heading" className={KICKER}>
        Performance diagnosis
      </h2>
      <div className={`mt-3 ${PANEL}`}>
        <div className="flex items-end justify-between gap-4 p-5 sm:p-6">
          <div>
            <div className="text-sm text-white/55">Hybrid Score</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight tabular-nums text-[#DFFF00]">
                {d.hybridScore}
              </span>
              <span className="text-sm font-medium text-white/50">/ 100</span>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-widest text-white/85">
              {d.tier}
            </span>
            <div className="mt-2 text-xs leading-snug text-white/55">{d.archetype}</div>
          </div>
        </div>

        <div className="space-y-4 border-t border-white/[0.08] px-5 py-5 sm:px-6">
          <ProfileBar
            label="Strength percentile"
            value={d.strengthPercentile}
            lower={d.trailingSide === "strength"}
          />
          <ProfileBar
            label="Endurance percentile"
            value={d.endurancePercentile}
            lower={d.trailingSide === "endurance"}
          />
        </div>

        <div className="border-t border-white/[0.08] px-5 py-5 sm:px-6">
          <h3 className={KICKER}>What’s holding your score back</h3>
          <div className="mt-2">
            <HoldingBack d={d} />
          </div>
        </div>

        {/* The raw indices stay available but out of the way: percentiles are
            what the score is built from and what athletes compare. */}
        <details className="group border-t border-white/[0.08] px-5 py-3.5 sm:px-6">
          <summary className="cursor-pointer list-none text-xs text-white/45 transition hover:text-white/70">
            Underlying index values
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Strength index {result.computed.strengthIndex} · Endurance index{" "}
            {result.computed.enduranceIndex}. These 0–100 ratings come from your
            lifts and run, and your percentiles place them against the reference
            baseline.
          </p>
        </details>
      </div>
    </section>
  );
}

/**
 * A scenario's exact projected inputs in the athlete's own run distance and
 * units — what the scenario would mean in numbers they actually train.
 */
function TargetRows({ t, large = false }: { t: ScenarioTargets; large?: boolean }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  const value = large ? "text-[15px]" : "text-sm";

  if (t.run) {
    rows.push({
      label: t.run.label,
      value: t.run.target ? (
        <>
          <span className="text-white/50">{t.run.current}</span>
          <span aria-hidden="true" className="px-1.5 text-white/35">→</span>
          <span className="sr-only"> to </span>
          <span className="font-semibold text-white">~{t.run.target}</span>
        </>
      ) : t.run.fasterBySeconds === 0 ? (
        <span className="text-white/75">A few seconds faster than {t.run.current}</span>
      ) : (
        <span className="text-white/75">Hold around {t.run.current}</span>
      ),
    });
  }

  const allLiftsHeld = t.lifts.length > 0 && t.lifts.every((l) => l.target === null);
  if (allLiftsHeld) {
    rows.push({
      label: "Lifts",
      value: <span className="text-white/75">Hold current performance</span>,
    });
  } else {
    for (const l of t.lifts) {
      rows.push({
        label: l.label,
        value:
          l.target !== null ? (
            <>
              <span className="text-white/50">{l.current}</span>
              <span aria-hidden="true" className="px-1.5 text-white/35">→</span>
              <span className="sr-only"> to </span>
              <span className="font-semibold text-white">
                ~{l.target} {t.unit}
              </span>
            </>
          ) : (
            <span className="text-white/75">
              Hold {l.current} {t.unit}
            </span>
          ),
      });
    }
  }

  return (
    <dl className="divide-y divide-white/[0.08]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-sm text-white/55">{r.label}</dt>
          <dd className={`text-right tabular-nums ${value}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BestFit({ bestFit }: { bestFit: NonNullable<AthleteReviewDiagnosis["bestFit"]> }) {
  useScenarioViewed({ id: bestFit.id, available: true, isPrimary: true });
  return (
    <div className="rounded-3xl border border-white/20 bg-white/[0.05] p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-white">{bestFit.title}</h3>

      <h4 className={`mt-4 ${KICKER}`}>What this would mean in your numbers</h4>
      <div className="mt-1">
        <TargetRows t={bestFit.targets} large />
      </div>

      <div className="mt-3 border-t border-white/10 pt-4">
        <div className="text-sm text-white/55">Hybrid Score</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums text-white/50">
            {bestFit.currentHybridScore}
          </span>
          <span aria-hidden="true" className="text-xl text-white/35">
            →
          </span>
          <span className="sr-only">to</span>
          <span className="text-5xl font-semibold tracking-tight tabular-nums text-[#DFFF00]">
            {bestFit.projectedHybridScore}
          </span>
          <span className="text-lg font-semibold tabular-nums text-white">
            {formatGain(bestFit.projectedGain)}
          </span>
        </div>
        <p className="mt-2 text-xs text-white/50">
          Estimated over ~{bestFit.horizonWeeks} weeks
          {bestFit.reachesHigherTier ? null : ` · stays ${bestFit.projectedTier}`}
        </p>
        {bestFit.reachesHigherTier ? (
          <p className="mt-3 text-sm font-medium text-white">
            That would move you into {bestFit.projectedTier}.
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-white/40">
        Calculated by Strendex scoring from your numbers, not by AI. The targets
        are what the scenario assumes, not a promised result.
      </p>
    </div>
  );
}

function BestFitSection({ d }: { d: AthleteReviewDiagnosis }) {
  return (
    <section aria-labelledby="best-fit-heading">
      <h2 id="best-fit-heading" className={KICKER}>
        Best-fit scenario
      </h2>
      <div className="mt-3">
        {d.bestFit ? (
          <BestFit bestFit={d.bestFit} />
        ) : (
          <div className={`${PANEL} p-5 sm:p-6`}>
            <p className="text-sm leading-relaxed text-white/70">
              Strendex couldn’t project a score change for this profile, so this
              review makes no score estimate.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function NextTier({ d }: { d: AthleteReviewDiagnosis }) {
  return (
    <section
      aria-labelledby="next-tier-heading"
      className={`${PANEL} flex items-center justify-between gap-4 px-5 py-4 sm:px-6`}
    >
      <div>
        <h2 id="next-tier-heading" className={KICKER}>
          Next tier
        </h2>
        {d.nextTier ? (
          <p className="mt-1.5 text-[15px] font-medium text-white">
            {d.nextTier.tier} starts at {d.nextTier.threshold}
          </p>
        ) : (
          <p className="mt-1.5 text-[15px] font-medium text-white">Top tier reached</p>
        )}
      </div>
      <p className="text-right text-sm leading-snug text-white/60">
        {d.nextTier ? (
          <>
            You’re <span className="font-semibold tabular-nums text-white">{points(d.nextTier.pointsAway)}</span> away
            {d.bestFit?.reachesHigherTier ? (
              <span className="block text-xs text-white/45">Your best-fit scenario gets you there</span>
            ) : null}
          </>
        ) : (
          <>WORLD CLASS is the highest Strendex tier</>
        )}
      </p>
    </section>
  );
}

// ---- Scenario cards (the scenarios not shown above) ------------------------

function ScenarioCard({
  scenario,
  targets,
  run,
  currentScore,
}: {
  scenario: Scenario;
  targets: ScenarioTargets | undefined;
  run: RunDistance | null;
  currentScore: number;
}) {
  useScenarioViewed(scenario);

  if (!scenario.available || !scenario.projected || !targets) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white/45">{scenario.title}</div>
          <span className="text-[10px] uppercase tracking-wider text-white/40">Not available</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/40">
          {unavailableScenarioCopy(scenario, run)}
        </p>
      </div>
    );
  }

  const { projected } = scenario;
  return (
    <div className="py-4">
      <div className="text-sm font-semibold text-white">{scenario.title}</div>
      <div className="mt-1">
        <TargetRows t={targets} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-sm text-white/55">Hybrid Score</span>
        <span className="text-sm tabular-nums text-white/50">{currentScore}</span>
        <span aria-hidden="true" className="text-white/30">
          →
        </span>
        <span className="sr-only">to</span>
        <span className="text-xl font-semibold tabular-nums text-white">{projected.hq}</span>
        <span className="text-sm font-semibold tabular-nums text-white/75">
          {formatGain(projected.hqDelta)}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-white/40">
        Estimated over ~{scenario.horizonWeeks} weeks · {projected.tier}
      </div>
    </div>
  );
}

/** What success looks like, in the athlete's own run and lifts. Deterministic. */
function SuccessTargets({ d }: { d: AthleteReviewDiagnosis }) {
  if (!d.bestFit) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
      <TargetRows t={d.bestFit.targets} />
      <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.08] py-2.5">
        <span className="text-sm text-white/55">Modeled Hybrid Score</span>
        <span className="text-sm tabular-nums text-white/75">
          {d.bestFit.currentHybridScore}
          <span aria-hidden="true" className="px-1.5 text-white/35">→</span>
          <span className="sr-only"> to </span>
          <span className="font-semibold text-white">{d.bestFit.projectedHybridScore}</span>
        </span>
      </div>
      <p className="pb-1 text-[11px] leading-relaxed text-white/40">
        From your best-fit scenario: what it assumes over ~{d.bestFit.horizonWeeks} weeks, not a
        promised result.
      </p>
    </div>
  );
}

// ---- Report ------------------------------------------------------------------

export default function ReportView({
  result,
  onRetake,
}: {
  result: AthleteReviewResponse;
  onRetake: () => void;
}) {
  const { report, scenarios, computed, diagnosis } = result;
  // The best-fit scenario is already shown in full above; list the rest.
  const otherScenarios = diagnosis.bestFit
    ? scenarios.filter((s) => s.id !== diagnosis.bestFit!.id)
    : scenarios;

  return (
    <article className="space-y-8">
      {/* A static heading: the first thing in the report is Strendex's own
          findings, never AI prose. */}
      <header className="pt-2">
        <h1 className="text-2xl font-semibold leading-snug text-white sm:text-[28px]">
          Your Athlete Review
        </h1>
      </header>

      {/* 1 · Deterministic diagnosis — Strendex scoring only */}
      <div className="space-y-4" data-section="diagnosis">
        <Diagnosis result={result} />
        <BestFitSection d={diagnosis} />
        <NextTier d={diagnosis} />
      </div>

      {/* 2 onward · The written analysis */}
      <p className="border-t border-white/10 pt-6 text-xs leading-relaxed text-white/45">
        The numbers above come from Strendex scoring. The analysis below is
        written by AI from those numbers and your answers.
      </p>

      <section aria-labelledby="meaning-heading">
        <h2 id="meaning-heading" className="text-lg font-semibold text-white">
          What this means
        </h2>
        <div className="mt-4 space-y-3">
          <p className="text-[17px] font-semibold leading-snug text-white">{report.headline}</p>
          <p className={PROSE}>{report.athleteSummary}</p>
          <p className={PROSE}>{report.profileInterpretation}</p>
        </div>
      </section>

      <Section id="working-heading" title="What’s already working">
        <ol className="divide-y divide-white/[0.08]">
          {report.strengths.map((s, i) => (
            <li key={i} className="py-4 first:pt-0">
              <h3 className="text-[15px] font-semibold text-white">{s.title}</h3>
              <p className={`mt-1.5 ${PROSE}`}>{s.explanation}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Based on: {s.evidence}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="holding-heading" title="What’s getting in the way">
        <ol className="divide-y divide-white/[0.08]">
          {report.limiters.map((l, i) => (
            <li key={i} className="py-4 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-white">{l.title}</h3>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/45">
                  {l.impact} impact
                </span>
              </div>
              <p className={`mt-1.5 ${PROSE}`}>{l.explanation}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Based on: {l.evidence}</p>
            </li>
          ))}
        </ol>
      </Section>

      <section
        aria-labelledby="change-heading"
        className="rounded-3xl border border-white/15 bg-white/[0.04] p-5 sm:p-6"
      >
        {/* The best-fit scenario is chosen for goal and profile fit, not as the
            largest possible gain, so this section applies it rather than
            claiming it is the single biggest lever. */}
        <h2 id="change-heading" className={KICKER}>
          {diagnosis.bestFit ? "How to apply your best-fit scenario" : "Your best-fit training direction"}
        </h2>
        {diagnosis.bestFit ? (
          <p className="mt-2 text-xs text-white/45">
            Best-fit scenario: {diagnosis.bestFit.title}
          </p>
        ) : null}
        <h3 className="mt-4 text-lg font-semibold text-white">{report.highestLeverageMove.title}</h3>
        <p className={`mt-2 ${PROSE}`}>{report.highestLeverageMove.why}</p>
        <dl className="mt-5 divide-y divide-white/10 border-t border-white/10">
          <div className="py-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">The main shift</dt>
            <dd className={`mt-1.5 ${PROSE}`}>{report.highestLeverageMove.whatToDo}</dd>
          </div>
          <div className="py-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">Keep</dt>
            <dd className={`mt-1.5 ${PROSE}`}>{report.highestLeverageMove.whatToMaintain}</dd>
          </div>
          <div className="pt-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">Deprioritize this block</dt>
            <dd className={`mt-1.5 ${PROSE}`}>{report.highestLeverageMove.deprioritize}</dd>
          </div>
        </dl>
      </section>

      {otherScenarios.length > 0 ? (
        <Section
          id="scenarios-heading"
          title={diagnosis.bestFit ? "Other modeled scenarios" : "Modeled scenarios"}
        >
          <div className="divide-y divide-white/[0.08] [&>*:first-child]:pt-0">
            {otherScenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                targets={diagnosis.scenarioTargets[s.id]}
                run={diagnosis.benchmark.run?.distance ?? null}
                currentScore={computed.hq}
              />
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/40">
            Scenarios are calculated by Strendex scoring, not AI, against the same
            reference baseline as your score. They are estimates, not
            guarantees, and nothing here is submitted to the leaderboard.
          </p>
        </Section>
      ) : null}

      <Section id="priorities-heading" title="Your priorities">
        <ol className="space-y-5">
          {report.priorities.map((p) => (
            <li key={p.priority} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-white">
                {p.priority}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-white">{p.action}</h3>
                <p className={`mt-1 ${PROSE}`}>{p.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="focus-heading" title="Your next training block">
        <p className="-mt-2 mb-4 text-xs text-white/45">
          The next {report.focusPlan.durationWeeks} weeks ·{" "}
          {report.focusPlan.weeklyStructure.length} training day
          {report.focusPlan.weeklyStructure.length === 1 ? "" : "s"} a week
        </p>
        <dl className="divide-y divide-white/[0.08]">
          <div className="pb-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">Strength</dt>
            <dd className={`mt-1.5 ${PROSE}`}>{report.focusPlan.strengthFocus}</dd>
          </div>
          <div className="py-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">Endurance</dt>
            <dd className={`mt-1.5 ${PROSE}`}>{report.focusPlan.enduranceFocus}</dd>
          </div>
          <div className="pt-4">
            <dt className="text-[11px] uppercase tracking-wider text-white/45">Weekly structure</dt>
            <dd>
              <ul className="mt-2 space-y-1.5">
                {report.focusPlan.weeklyStructure.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white/70">
                    <span aria-hidden="true" className="text-white/30">
                      —
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              {report.focusPlan.weeklyStructure.length < 7 ? (
                <p className="mt-2 text-xs text-white/45">Rest or easy recovery on the other days.</p>
              ) : null}
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="recovery-heading" title="Recovery and constraint guardrail">
        <p className={PROSE}>{report.focusPlan.recoveryFocus}</p>
      </Section>

      <Section id="retest-heading" title="What success looks like">
        <SuccessTargets d={diagnosis} />
        <p className="mt-5 text-[15px] font-medium text-white">
          Retest in about {report.retest.recommendedWeeks} weeks
        </p>
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
          <span className="text-white/75">You’ll know it’s working when:</span>{" "}
          {report.retest.successSignal}
        </p>
      </Section>

      <footer className="border-t border-white/10 pb-4 pt-6">
        <p className="text-xs leading-relaxed text-white/45">{report.confidenceNote}</p>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          {report.disclaimer}{" "}
          <Link
            href="/methodology"
            className="text-white/60 underline underline-offset-4 hover:text-white"
          >
            Read the methodology
          </Link>
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
    </article>
  );
}
