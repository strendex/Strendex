// Client-side persistence for the Athlete Review flow.
// sessionStorage only — versioned, validated, and safe against corrupt data.
// Snapshot scores are display-only; the server always re-derives from raw inputs.

import { isRunDistance } from "@/lib/scoring/core";
import type { AssessmentAnswers, ResultSnapshotV1 } from "./types";

const SNAPSHOT_KEY = "strendex_ar_snapshot_v1";
const ANSWERS_KEY = "strendex_ar_answers_v1";
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a snapshot names the benchmark its result was scored against. When
 * it does not, the review must not run: the athlete is asked to recalculate.
 */
export function snapshotHasBenchmark(snapshot: ResultSnapshotV1): boolean {
  return (
    snapshot.benchmark.datasetVersionId !== null &&
    UUID_PATTERN.test(snapshot.benchmark.datasetVersionId) &&
    snapshot.benchmark.scoreVersion !== null
  );
}

/**
 * Whether a snapshot carries the run the athlete entered. A snapshot with an
 * endurance benchmark but no original run predates the review using it: the
 * athlete is asked to recalculate rather than shown a guessed distance.
 */
export function snapshotHasRunContext(snapshot: ResultSnapshotV1): boolean {
  if (snapshot.inputs.enduranceSeconds === null) return true;
  return (
    isRunDistance(snapshot.inputs.runDistance) &&
    snapshot.inputs.runSeconds !== null &&
    Number.isInteger(snapshot.inputs.runSeconds)
  );
}

export function saveSnapshot(
  snapshot: Omit<ResultSnapshotV1, "v" | "savedAt">,
): void {
  const store = storage();
  if (!store) return;
  try {
    const full: ResultSnapshotV1 = { v: 1, savedAt: Date.now(), ...snapshot };
    store.setItem(SNAPSHOT_KEY, JSON.stringify(full));
  } catch {
    // Storage full/blocked — the flow degrades to the landing state.
  }
}

export function loadSnapshot(): ResultSnapshotV1 | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("bad");
    const s = parsed as ResultSnapshotV1;

    if (s.v !== 1) throw new Error("version");
    if (
      typeof s.savedAt !== "number" ||
      !Number.isFinite(s.savedAt) ||
      Date.now() - s.savedAt > SNAPSHOT_MAX_AGE_MS
    ) {
      throw new Error("stale");
    }

    const inputs = s.inputs;
    if (
      typeof inputs !== "object" ||
      inputs === null ||
      typeof inputs.bodyweightKg !== "number" ||
      !Number.isFinite(inputs.bodyweightKg) ||
      inputs.bodyweightKg < 36 ||
      inputs.bodyweightKg > 181 ||
      (inputs.unitSystem !== "lb" && inputs.unitSystem !== "kg")
    ) {
      throw new Error("inputs");
    }

    // Tolerated when absent (pre-Group-3 snapshot): the review page asks for a
    // recalculation instead of silently using the active dataset.
    const rawBenchmark = (s as { benchmark?: unknown }).benchmark;
    const benchmarkRecord =
      typeof rawBenchmark === "object" && rawBenchmark !== null
        ? (rawBenchmark as Record<string, unknown>)
        : {};

    const display = s.display;
    if (
      typeof display !== "object" ||
      display === null ||
      typeof display.hybridScore !== "number" ||
      !Number.isFinite(display.hybridScore) ||
      typeof display.tier !== "string" ||
      typeof display.archetype !== "string"
    ) {
      throw new Error("display");
    }

    // Re-normalize nullable numerics defensively.
    return {
      v: 1,
      savedAt: s.savedAt,
      inputs: {
        bodyweightKg: inputs.bodyweightKg,
        benchKg: numOrNull(inputs.benchKg),
        squatKg: numOrNull(inputs.squatKg),
        deadliftKg: numOrNull(inputs.deadliftKg),
        enduranceSeconds: numOrNull(inputs.enduranceSeconds),
        runDistance:
          typeof inputs.runDistance === "string" ? inputs.runDistance : null,
        runTimeText:
          typeof inputs.runTimeText === "string" ? inputs.runTimeText : null,
        runSeconds: numOrNull((inputs as { runSeconds?: unknown }).runSeconds),
        unitSystem: inputs.unitSystem,
      },
      benchmark: {
        datasetVersionId: strOrNull(benchmarkRecord.datasetVersionId),
        scoreVersion: strOrNull(benchmarkRecord.scoreVersion),
      },
      display: {
        hybridScore: display.hybridScore,
        strengthPercentile: numOrNull(display.strengthPercentile),
        endurancePercentile: numOrNull(display.endurancePercentile),
        strengthIndex: numOrNull(display.strengthIndex),
        enduranceIndex: numOrNull(display.enduranceIndex),
        tier: display.tier,
        archetype: display.archetype,
        rank: numOrNull(display.rank),
        totalAthletes: numOrNull(display.totalAthletes),
        betterThanPercent: numOrNull(display.betterThanPercent),
      },
    };
  } catch {
    try {
      store.removeItem(SNAPSHOT_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function clearSnapshot(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

type SavedAnswers = {
  v: 1;
  step: number;
  answers: Partial<AssessmentAnswers>;
};

export function saveAnswers(
  answers: Partial<AssessmentAnswers>,
  step: number,
): void {
  const store = storage();
  if (!store) return;
  try {
    const payload: SavedAnswers = { v: 1, step, answers };
    store.setItem(ANSWERS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadAnswers(): {
  step: number;
  answers: Partial<AssessmentAnswers>;
} | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(ANSWERS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("bad");
    const p = parsed as SavedAnswers;
    if (
      p.v !== 1 ||
      typeof p.step !== "number" ||
      p.step < 1 ||
      p.step > 5 ||
      typeof p.answers !== "object" ||
      p.answers === null
    ) {
      throw new Error("shape");
    }
    return { step: Math.floor(p.step), answers: p.answers };
  } catch {
    try {
      store.removeItem(ANSWERS_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function clearAnswers(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(ANSWERS_KEY);
  } catch {
    // ignore
  }
}
