"use client";

// Small input primitives for the Athlete Review assessment.

import type { ReactNode } from "react";

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
      {children}
    </div>
  );
}

export function StepperHeader({
  step,
  kicker,
  title,
  sub,
}: {
  step: number;
  kicker: string;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Kicker>{kicker}</Kicker>
        <div className="text-[11px] text-white/40">Step {step} of 5</div>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= step ? "bg-white/70" : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <h1 className="mt-4 text-xl font-semibold text-white">{title}</h1>
      <p className="mt-1 text-sm text-white/55">{sub}</p>
    </div>
  );
}

export function QuestionShell({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-white">{label}</div>
      {helper ? <div className="mt-0.5 text-xs text-white/45">{helper}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function OptionCards({
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`grid gap-2 ${columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? undefined : opt.value)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              selected
                ? "border-white/40 bg-white/[0.08] font-semibold text-white"
                : "border-white/10 bg-black/30 text-white/75 hover:bg-white/[0.05]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CountPicker({
  name,
  min,
  max,
  value,
  onChange,
}: {
  name: string;
  min: number;
  max: number;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const counts: number[] = [];
  for (let i = min; i <= max; i++) counts.push(i);
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {counts.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? undefined : n)}
            className={`h-11 w-11 rounded-2xl border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              selected
                ? "border-white/40 bg-white/[0.08] font-semibold text-white"
                : "border-white/10 bg-black/30 text-white/75 hover:bg-white/[0.05]"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value ?? ""}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(undefined);
          return;
        }
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
    />
  );
}

export function ShortTextField({
  label,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value ?? ""}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
    />
  );
}

export function LimitedTextArea({
  label,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}) {
  const used = value?.length ?? 0;
  return (
    <div>
      <textarea
        aria-label={label}
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={4}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
      />
      <div className="mt-1 text-right text-[11px] text-white/35">
        {used}/{maxLength}
      </div>
    </div>
  );
}

export function StepNavButtons({
  canContinue,
  continueLabel = "Continue",
  onBack,
  onContinue,
}: {
  canContinue: boolean;
  continueLabel?: string;
  onBack: (() => void) | null;
  onContinue: () => void;
}) {
  return (
    <div className="mt-8 flex gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
        >
          Back
        </button>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="flex-1 rounded-2xl bg-[#DFFF00] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
      >
        {continueLabel}
      </button>
    </div>
  );
}
