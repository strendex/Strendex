"use client";

// /athlete-review — landing state, five-step guided assessment, generation and
// structured report. The benchmark snapshot transfers via sessionStorage; the
// server re-derives all canonical numbers from raw inputs.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUESTIONS,
  isStepComplete,
  visibleQuestions,
} from "@/lib/athleteReview/questions";
import {
  clearAnswers,
  loadAnswers,
  loadSnapshot,
  saveAnswers,
} from "@/lib/athleteReview/snapshot";
import type {
  AssessmentAnswers,
  AthleteReviewResponse,
  ResultSnapshotV1,
} from "@/lib/athleteReview/types";
import { scoreBand, trackAthleteReview } from "@/lib/athleteReview/analytics";
import AssessmentStep, { type AnswerValue } from "./components/AssessmentStep";
import ReviewScreen from "./components/ReviewScreen";
import ReportView from "./components/ReportView";
import {
  ErrorState,
  GeneratingScreen,
  IntroScreen,
  LandingState,
} from "./components/screens";
import { StepNavButtons } from "./components/primitives";

type Phase =
  | "booting"
  | "landing"
  | "intro"
  | "assessment"
  | "review"
  | "generating"
  | "report"
  | "error";

type StepN = 1 | 2 | 3 | 4 | 5;

// Drop answers whose question is no longer visible (e.g. after the primary
// goal changed) so state, storage, and the server all agree.
function pruneAnswers(
  answers: Partial<AssessmentAnswers>,
): Partial<AssessmentAnswers> {
  const next: Record<string, unknown> = { ...answers };
  for (const q of QUESTIONS) {
    if (next[q.id] === undefined) continue;
    if (q.showIf && !q.showIf(next as Partial<AssessmentAnswers>)) {
      delete next[q.id];
      continue;
    }
    const excluded = q.excludeValue?.(next as Partial<AssessmentAnswers>);
    if (excluded !== null && excluded !== undefined && next[q.id] === excluded) {
      delete next[q.id];
    }
  }
  return next as Partial<AssessmentAnswers>;
}

function visibleAnswersOnly(
  answers: Partial<AssessmentAnswers>,
): Partial<AssessmentAnswers> {
  const out: Record<string, unknown> = {};
  for (const step of [1, 2, 3, 4, 5] as StepN[]) {
    for (const q of visibleQuestions(step, answers)) {
      const v = answers[q.id];
      if (v !== undefined) out[q.id] = v;
    }
  }
  return out as Partial<AssessmentAnswers>;
}

export default function AthleteReviewPage() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [snapshot, setSnapshot] = useState<ResultSnapshotV1 | null>(null);
  const [step, setStep] = useState<StepN>(1);
  const [answers, setAnswers] = useState<Partial<AssessmentAnswers>>({});
  const [resumeStep, setResumeStep] = useState<StepN | null>(null);
  const [result, setResult] = useState<AthleteReviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [editingFromReview, setEditingFromReview] = useState(false);
  const stepRef = useRef<StepN>(1);
  stepRef.current = step;

  useEffect(() => {
    const snap = loadSnapshot();
    if (!snap) {
      setPhase("landing");
      trackAthleteReview("athlete_review_landing_viewed");
      return;
    }
    setSnapshot(snap);
    const saved = loadAnswers();
    if (saved && Object.keys(saved.answers).length > 0) {
      setAnswers(pruneAnswers(saved.answers));
      const s = Math.min(5, Math.max(1, saved.step)) as StepN;
      setStep(s);
      setResumeStep(s);
    }
    setPhase("intro");
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase, step]);

  const setAnswer = useCallback(
    (id: keyof AssessmentAnswers, value: AnswerValue) => {
      setAnswers((prev) => {
        const merged: Record<string, unknown> = { ...prev };
        if (value === undefined) delete merged[id];
        else merged[id] = value;
        const next = pruneAnswers(merged as Partial<AssessmentAnswers>);
        saveAnswers(next, stepRef.current);
        return next;
      });
    },
    [],
  );

  function startAssessment() {
    trackAthleteReview("athlete_review_started", {
      mode: resumeStep ? "resume" : "fresh",
    });
    setPhase("assessment");
  }

  function startOver() {
    clearAnswers();
    setAnswers({});
    setStep(1);
    setResumeStep(null);
    trackAthleteReview("athlete_review_started", { mode: "fresh" });
    setPhase("assessment");
  }

  function continueFromStep() {
    trackAthleteReview("athlete_review_step_completed", {
      step,
      visible_question_count: visibleQuestions(step, answers).length,
    });
    if (editingFromReview || step === 5) {
      setEditingFromReview(false);
      setPhase("review");
      return;
    }
    const next = (step + 1) as StepN;
    setStep(next);
    saveAnswers(answers, next);
  }

  function backFromStep() {
    if (editingFromReview) {
      setEditingFromReview(false);
      setPhase("review");
      return;
    }
    if (step === 1) {
      setPhase("intro");
      return;
    }
    const prev = (step - 1) as StepN;
    setStep(prev);
    saveAnswers(answers, prev);
  }

  function editStep(target: StepN) {
    setEditingFromReview(true);
    setStep(target);
    setPhase("assessment");
  }

  async function generate() {
    if (!snapshot) return;
    setPhase("generating");
    const startedAt = Date.now();
    trackAthleteReview("athlete_review_generation_started", {
      primary_goal: answers.primaryGoal ?? null,
      main_constraint: answers.mainConstraint ?? null,
    });

    let failType = "network";
    let status: number | null = null;
    try {
      const res = await fetch("/api/athlete-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benchmark: {
            bodyweight_kg: snapshot.inputs.bodyweightKg,
            bench_kg: snapshot.inputs.benchKg,
            squat_kg: snapshot.inputs.squatKg,
            deadlift_kg: snapshot.inputs.deadliftKg,
            endurance_seconds: snapshot.inputs.enduranceSeconds,
            unit_system: snapshot.inputs.unitSystem,
          },
          answers: visibleAnswersOnly(answers),
        }),
      });
      status = res.status;
      const data: unknown = await res.json();

      if (!res.ok) {
        failType =
          res.status === 429
            ? "rate_limit"
            : res.status === 400
              ? "validation"
              : "ai_unavailable";
        const message =
          typeof data === "object" &&
          data !== null &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Something went wrong. Please try again.";
        throw new Error(message);
      }

      const review = data as AthleteReviewResponse;
      setResult(review);
      clearAnswers();
      setPhase("report");
      trackAthleteReview("athlete_review_generated", {
        duration_ms: Date.now() - startedAt,
        model: review.meta?.model ?? null,
        primary_scenario_id:
          review.scenarios?.find((s) => s.isPrimary)?.id ?? null,
        score_band: scoreBand(review.computed.hq),
      });
    } catch (err) {
      trackAthleteReview("athlete_review_generation_failed", {
        error_type: failType,
        http_status: status,
      });
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't reach the review engine. Check your connection and try again — your answers are saved.",
      );
      setPhase("error");
    }
  }

  function retake() {
    clearAnswers();
    setAnswers({});
    setStep(1);
    setResult(null);
    setResumeStep(null);
    setPhase("assessment");
  }

  const isReport = phase === "report";

  return (
    <div className={`mx-auto w-full ${isReport ? "max-w-2xl" : "max-w-xl"} py-4`}>
      {phase === "booting" ? (
        <div className="min-h-[40vh]" aria-hidden="true" />
      ) : phase === "landing" ? (
        <LandingState />
      ) : phase === "intro" && snapshot ? (
        <IntroScreen
          hybridScore={snapshot.display.hybridScore}
          tier={snapshot.display.tier}
          archetype={snapshot.display.archetype}
          resumeStep={resumeStep}
          onStart={startAssessment}
          onStartOver={resumeStep ? startOver : null}
        />
      ) : phase === "assessment" && snapshot ? (
        <div>
          <AssessmentStep
            step={step}
            answers={answers}
            unitSystem={snapshot.inputs.unitSystem}
            onChange={setAnswer}
          />
          <StepNavButtons
            canContinue={isStepComplete(step, answers)}
            continueLabel={
              editingFromReview
                ? "Save changes"
                : step === 5
                  ? "Review my answers"
                  : "Continue"
            }
            onBack={backFromStep}
            onContinue={continueFromStep}
          />
        </div>
      ) : phase === "review" && snapshot ? (
        <ReviewScreen
          snapshot={snapshot}
          answers={answers}
          isGenerating={false}
          onEditStep={editStep}
          onGenerate={generate}
        />
      ) : phase === "generating" ? (
        <GeneratingScreen />
      ) : phase === "report" && result ? (
        <ReportView result={result} onRetake={retake} />
      ) : phase === "error" ? (
        <ErrorState message={errorMessage} onRetry={() => setPhase("review")} />
      ) : (
        <LandingState />
      )}
    </div>
  );
}
