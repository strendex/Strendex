"use client";

// Landing / intro / generating / error screens for the Athlete Review flow.

import { useEffect, useState } from "react";
import Link from "next/link";
import { REVIEW_ANSWERS } from "@/lib/athleteReview/entryCopy";
import { Kicker } from "./primitives";

const PRIMARY_CTA =
  "block w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-center text-sm font-semibold text-black transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1014]";

// Two columns from lg up: the header spans both, the review index sits on the
// right, and the baseline and action stack on the left. On mobile the index
// comes before the action, so the athlete sees what they get first.
const ENTRY_GRID =
  "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-12";

function ReviewIndex({ label }: { label: string }) {
  return (
    <section
      aria-label={label}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-2"
    >
      <Kicker>{label}</Kicker>
      <ol className="mt-4 divide-y divide-white/[0.08]">
        {REVIEW_ANSWERS.map((row, i) => (
          <li key={row.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className={`w-5 shrink-0 pt-px text-[11px] font-medium tabular-nums ${
                row.primary ? "text-white/80" : "text-white/35"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div
                className={
                  row.primary
                    ? "text-[15px] font-semibold text-white"
                    : "text-sm font-medium text-white/85"
                }
              >
                {row.title}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/50">
                {row.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LandingState({ notice }: { notice?: string } = {}) {
  return (
    <div className={ENTRY_GRID}>
      <header className="lg:col-span-2">
        {notice ? (
          <p
            role="status"
            className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/70"
          >
            {notice}
          </p>
        ) : null}
        <Kicker>ATHLETE REVIEW</Kicker>
        <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Start with your Strendex result.
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
          Athlete Review builds on your Hybrid Score and strength/endurance
          profile. Take the free assessment first, then your results carry over
          automatically.
        </p>
      </header>

      <ReviewIndex label="What Athlete Review answers" />

      <div className="lg:col-start-1 lg:row-start-2">
        <Link href="/tool?intent=athlete-review" className={PRIMARY_CTA}>
          Take the free assessment
        </Link>
        <p className="mt-3 text-center text-xs text-white/40">
          Free · no account required
        </p>
      </div>
    </div>
  );
}

function formatPercentile(value: number | null): string | null {
  return value === null ? null : `${value.toFixed(1)}%`;
}

export function IntroScreen({
  hybridScore,
  tier,
  archetype,
  strengthPercentile,
  endurancePercentile,
  resuming,
  onStart,
  onStartOver,
}: {
  hybridScore: number;
  tier: string;
  archetype: string;
  strengthPercentile: number | null;
  endurancePercentile: number | null;
  resuming: boolean;
  onStart: () => void;
  onStartOver: (() => void) | null;
}) {
  const percentiles = [
    { label: "Strength percentile", value: formatPercentile(strengthPercentile) },
    { label: "Endurance percentile", value: formatPercentile(endurancePercentile) },
  ].filter((p): p is { label: string; value: string } => p.value !== null);

  return (
    <div className={ENTRY_GRID}>
      <header className="lg:col-span-2">
        <Kicker>ATHLETE REVIEW</Kicker>
        <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
          You know where you stand. Now find where the next points are.
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
          Your Strendex numbers are already loaded. Add your training, goals and
          recovery to see what is most likely to move your score.
        </p>
      </header>

      <section
        aria-label="Your baseline"
        className="rounded-2xl border border-white/10 bg-white/[0.03] lg:col-start-1 lg:row-start-2"
      >
        <div className="p-5 sm:p-6">
          <Kicker>Your baseline</Kicker>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-white/55">Hybrid Score</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight tabular-nums text-[#DFFF00]">
                  {hybridScore}
                </span>
                <span className="text-sm font-medium text-white/50">/ 100</span>
              </div>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-widest text-white/85">
              {tier}
            </div>
          </div>
        </div>

        {percentiles.length > 0 ? (
          <dl
            className={`grid divide-x divide-white/[0.08] border-t border-white/[0.08] ${
              percentiles.length === 2 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {percentiles.map((p) => (
              <div key={p.label} className="px-5 py-4 sm:px-6">
                <dt className="text-xs text-white/55">{p.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-white">
                  {p.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <dl className="border-t border-white/[0.08] px-5 py-4 sm:px-6">
          <dt className="text-xs text-white/55">Athlete type</dt>
          <dd className="mt-1 text-sm font-semibold leading-snug text-white">
            {archetype}
          </dd>
        </dl>
      </section>

      <ReviewIndex label="What your review will answer" />

      <div className="lg:col-start-1 lg:row-start-3">
        <button type="button" onClick={onStart} className={PRIMARY_CTA}>
          {resuming ? "Continue my Athlete Review" : "Start my Athlete Review"}
        </button>
        <p className="mt-3 text-center text-xs text-white/40">
          {resuming ? "Your answers are saved." : "Free · uses your existing results"}
        </p>
        {resuming && onStartOver ? (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={onStartOver}
              className="rounded-md px-2 py-2 text-xs text-white/50 underline-offset-4 transition hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Start over
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const GENERATION_STAGES = [
  "Analyzing performance balance",
  "Mapping goals and constraints",
  "Building your review",
] as const;

export function GeneratingScreen() {
  const [stage, setStage] = useState(0);

  // Truthful staging: the request is genuinely in flight the whole time; these
  // labels advance on a timer but never claim fake percentages.
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 2500);
    const t2 = setTimeout(() => setStage(2), 7000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#DFFF00]" />
        <span className="text-[11px] uppercase tracking-[0.25em] text-white/60">
          {GENERATION_STAGES[stage]}
        </span>
      </div>
      <div className="mt-6 space-y-2">
        {GENERATION_STAGES.map((label, i) => (
          <div
            key={label}
            className={`text-sm transition ${
              i < stage
                ? "text-white/35 line-through decoration-white/20"
                : i === stage
                  ? "text-white"
                  : "text-white/25"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <p className="mt-8 max-w-xs text-xs text-white/40">
        Your scenarios are computed by Strendex scoring — the review interprets
        them for your goals.
      </p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <Kicker>ATHLETE REVIEW</Kicker>
      <h1 className="mt-3 text-xl font-semibold text-white">
        That didn&apos;t work
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">
        {message}
      </p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Back to my answers
        </button>
        <Link
          href="/tool"
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
        >
          Back to my score
        </Link>
      </div>
    </div>
  );
}
