"use client";

// Landing / intro / generating / error screens for the Athlete Review flow.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kicker } from "./primitives";

export function LandingState() {
  return (
    <div>
      <Kicker>ATHLETE REVIEW</Kicker>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
        Your review starts with an objective baseline
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
        The Athlete Review is built on your real Strendex numbers — your Hybrid
        Score, strength and endurance percentiles, and athlete type. Calculate
        your score first, then answer a short assessment about your training,
        goals and recovery.
      </p>

      <div className="mt-6 space-y-3">
        {[
          {
            title: "Your highest-leverage move",
            sub: "The single change most likely to move your Hybrid Score.",
          },
          {
            title: "Three strengths, three limiters",
            sub: "What is carrying your profile and what is holding it back — with evidence.",
          },
          {
            title: "Estimated score scenarios",
            sub: "Deterministic Strendex projections for realistic 8-week improvements.",
          },
        ].map((row) => (
          <div
            key={row.title}
            className="rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <div className="text-sm font-semibold text-white">{row.title}</div>
            <div className="mt-0.5 text-xs text-white/50">{row.sub}</div>
          </div>
        ))}
      </div>

      <Link
        href="/tool?intent=athlete-review"
        className="mt-6 block w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-center text-sm font-semibold text-black transition hover:opacity-90"
      >
        Get My Baseline First
      </Link>
      <p className="mt-3 text-center text-xs text-white/40">
        Takes about 2 minutes · the review takes 3–5 more · Free
      </p>
    </div>
  );
}

export function IntroScreen({
  hybridScore,
  tier,
  archetype,
  resumeStep,
  onStart,
  onStartOver,
}: {
  hybridScore: number;
  tier: string;
  archetype: string;
  resumeStep: number | null;
  onStart: () => void;
  onStartOver: (() => void) | null;
}) {
  return (
    <div>
      <Kicker>ATHLETE REVIEW</Kicker>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
        Let&apos;s find what will move your score
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
        Five short steps about your training, goals and recovery. Your benchmark
        transfers automatically — no re-entering numbers.
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
          Your baseline
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-4xl font-semibold text-[#DFFF00]">
            {hybridScore}
          </span>
          <span className="text-sm text-white/70">{tier}</span>
        </div>
        <div className="mt-1 text-sm text-white/55">{archetype}</div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
      >
        {resumeStep ? `Resume review — step ${resumeStep} of 5` : "Start my review"}
      </button>
      {resumeStep && onStartOver ? (
        <button
          type="button"
          onClick={onStartOver}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
        >
          Start over
        </button>
      ) : null}
      <p className="mt-3 text-center text-xs text-white/40">
        3–5 minutes · about 20 questions · Free
      </p>
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
