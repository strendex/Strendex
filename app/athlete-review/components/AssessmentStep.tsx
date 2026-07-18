"use client";

// Config-driven renderer for one assessment step. All question definitions and
// conditional logic live in lib/athleteReview/questions.ts.

import {
  STEP_META,
  visibleQuestions,
  type QuestionDef,
} from "@/lib/athleteReview/questions";
import type { AssessmentAnswers, UnitSystem } from "@/lib/athleteReview/types";
import {
  CountPicker,
  LimitedTextArea,
  NumberField,
  OptionCards,
  QuestionShell,
  ShortTextField,
  StepperHeader,
} from "./primitives";

export type AnswerValue = string | number | undefined;

function questionOptions(
  q: QuestionDef,
  answers: Partial<AssessmentAnswers>,
  unitSystem: UnitSystem,
): { value: string; label: string }[] {
  const excluded = q.excludeValue?.(answers) ?? null;
  return (q.options ?? [])
    .filter((o) => o.value !== excluded)
    .map((o) => ({
      value: o.value,
      label:
        unitSystem === "lb" && o.labelImperial ? o.labelImperial : o.label,
    }));
}

export default function AssessmentStep({
  step,
  answers,
  unitSystem,
  onChange,
}: {
  step: 1 | 2 | 3 | 4 | 5;
  answers: Partial<AssessmentAnswers>;
  unitSystem: UnitSystem;
  onChange: (id: keyof AssessmentAnswers, value: AnswerValue) => void;
}) {
  const meta = STEP_META[step];
  const questions = visibleQuestions(step, answers);

  return (
    <div>
      <StepperHeader
        step={step}
        kicker={meta.kicker}
        title={meta.title}
        sub={meta.sub}
      />
      <div className="mt-6 space-y-7">
        {questions.map((q) => {
          const value = answers[q.id];
          return (
            <QuestionShell key={q.id} label={q.label} helper={q.helper}>
              {q.kind === "options" ? (
                <OptionCards
                  name={q.label}
                  options={questionOptions(q, answers, unitSystem)}
                  value={typeof value === "string" ? value : undefined}
                  onChange={(v) => onChange(q.id, v)}
                />
              ) : q.kind === "count" ? (
                <CountPicker
                  name={q.label}
                  min={q.min ?? 0}
                  max={q.max ?? 7}
                  value={typeof value === "number" ? value : undefined}
                  onChange={(v) => onChange(q.id, v)}
                />
              ) : q.kind === "number" ? (
                <NumberField
                  label={q.label}
                  value={typeof value === "number" ? value : undefined}
                  min={q.min}
                  max={q.max}
                  placeholder={q.placeholder}
                  onChange={(v) => onChange(q.id, v)}
                />
              ) : q.kind === "shorttext" ? (
                <ShortTextField
                  label={q.label}
                  value={typeof value === "string" ? value : undefined}
                  maxLength={q.maxLength ?? 100}
                  placeholder={q.placeholder}
                  onChange={(v) => onChange(q.id, v)}
                />
              ) : (
                <LimitedTextArea
                  label={q.label}
                  value={typeof value === "string" ? value : undefined}
                  maxLength={q.maxLength ?? 500}
                  onChange={(v) => onChange(q.id, v)}
                />
              )}
            </QuestionShell>
          );
        })}
      </div>
    </div>
  );
}
