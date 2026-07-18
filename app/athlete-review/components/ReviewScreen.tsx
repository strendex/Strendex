"use client";

// Pre-generation review: summarize benchmark data + assessment answers with
// per-section edit links, show the disclaimer, then generate.

import { optionLabel, visibleQuestions } from "@/lib/athleteReview/questions";
import type {
  AssessmentAnswers,
  ResultSnapshotV1,
} from "@/lib/athleteReview/types";
import { Kicker } from "./primitives";

const KG_TO_LB = 2.2046226218;

function formatWeight(kg: number | null, unitSystem: "lb" | "kg"): string {
  if (kg === null) return "—";
  return unitSystem === "lb"
    ? `${Math.round(kg * KG_TO_LB)} lb`
    : `${Math.round(kg)} kg`;
}

function SectionCard({
  title,
  onEdit,
  rows,
}: {
  title: string;
  onEdit?: () => void;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{title}</div>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-white/55 underline-offset-2 transition hover:text-white hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 text-sm">
            <dt className="text-white/50">{r.label}</dt>
            <dd className="text-right text-white/85">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function answerRows(
  step: 1 | 2 | 3 | 4 | 5,
  answers: Partial<AssessmentAnswers>,
  unitSystem: "lb" | "kg",
): { label: string; value: string }[] {
  return visibleQuestions(step, answers).map((q) => {
    const value = answers[q.id];
    let display = "—";
    if (value !== undefined) {
      if (q.kind === "options") {
        display = optionLabel(q, value, unitSystem);
      } else if (q.kind === "freetext") {
        const text = String(value);
        display = text.length > 60 ? `${text.slice(0, 60)}…` : text;
      } else {
        display = String(value);
      }
    }
    return { label: q.label, value: display };
  });
}

export default function ReviewScreen({
  snapshot,
  answers,
  isGenerating,
  onEditStep,
  onGenerate,
}: {
  snapshot: ResultSnapshotV1;
  answers: Partial<AssessmentAnswers>;
  isGenerating: boolean;
  onEditStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  onGenerate: () => void;
}) {
  const { inputs, display } = snapshot;
  const unitSystem = inputs.unitSystem;

  const benchmarkRows = [
    { label: "Hybrid Score", value: String(display.hybridScore) },
    { label: "Tier", value: display.tier },
    { label: "Athlete type", value: display.archetype },
    { label: "Bodyweight", value: formatWeight(inputs.bodyweightKg, unitSystem) },
    { label: "Bench", value: formatWeight(inputs.benchKg, unitSystem) },
    { label: "Squat", value: formatWeight(inputs.squatKg, unitSystem) },
    { label: "Deadlift", value: formatWeight(inputs.deadliftKg, unitSystem) },
    {
      label: "Run",
      value:
        inputs.runTimeText && inputs.runDistance
          ? `${inputs.runDistance.toUpperCase()} · ${inputs.runTimeText}`
          : inputs.enduranceSeconds !== null
            ? "Provided"
            : "Not provided",
    },
  ];

  const stepSections: { title: string; step: 1 | 2 | 3 | 4 | 5 }[] = [
    { title: "Athlete context", step: 1 },
    { title: "Current training", step: 2 },
    { title: "Goals", step: 3 },
    { title: "Recovery and constraints", step: 4 },
    { title: "Final context", step: 5 },
  ];

  // Hide the free-text section entirely when nothing was written.
  const visibleSections = stepSections.filter(
    ({ step }) =>
      step !== 5 ||
      visibleQuestions(5, answers).some((q) => answers[q.id] !== undefined),
  );

  return (
    <div>
      <Kicker>REVIEW · CONFIRM</Kicker>
      <h1 className="mt-3 text-xl font-semibold text-white">
        Confirm your review inputs
      </h1>
      <p className="mt-1 text-sm text-white/55">
        Your Hybrid Score is recomputed server-side from your raw benchmark —
        the review is built on your verified numbers.
      </p>

      <div className="mt-6 space-y-3">
        <SectionCard title="Your benchmark" rows={benchmarkRows} />
        {visibleSections.map(({ title, step }) => (
          <SectionCard
            key={step}
            title={title}
            onEdit={() => onEditStep(step)}
            rows={answerRows(step, answers, unitSystem)}
          />
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-white/45">
        Strendex Athlete Review provides informational training guidance and is
        not medical advice.
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="mt-4 w-full rounded-2xl bg-[#DFFF00] px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
      >
        Generate My Athlete Review
      </button>
    </div>
  );
}
