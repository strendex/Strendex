// Validation of the benchmark snapshot POST /api/athlete-review receives.
//
// PURE MODULE — no HTTP, database or OpenAI. Moved out of the route file
// unchanged (Next.js route files may only export handlers), so it can be
// tested directly. The one Group 2 change: endurance is bounded by the SAME
// canonical window a submission may convert to, so every athlete
// POST /api/score accepts can also be reviewed.

import {
  SUBMISSION_CANONICAL_ENDURANCE_SECONDS,
  hasOnlyAllowedKeys,
  isPlainObject,
} from "@/lib/scoring/core";

export type ValidatedBenchmark = {
  bodyweightKg: number;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  enduranceSeconds: number | null;
  unitSystem: "lb" | "kg";
  /** The frozen dataset the saved result was scored against. */
  datasetVersionId: string;
  scoreVersion: string;
};

/**
 * Shown when a review cannot be tied to the benchmark its result was scored
 * against. Never answered by silently using whichever dataset is active now.
 */
export const RECALCULATE_MESSAGE =
  "This result needs to be recalculated before it can be reviewed. Go back to the calculator, recalculate your score, then start the review again.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same validity rules as /api/rank — a review athlete is a legal athlete —
// except endurance, which follows POST /api/score (see the header).
export function validateBenchmark(
  raw: unknown,
):
  | { ok: true; benchmark: ValidatedBenchmark }
  | { ok: false; error: string; recalculate?: true } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Benchmark must be an object." };
  }

  const allowed = [
    "bodyweight_kg",
    "endurance_seconds",
    "bench_kg",
    "squat_kg",
    "deadlift_kg",
    "unit_system",
    "dataset_version_id",
    "score_version",
  ];
  if (!hasOnlyAllowedKeys(raw, allowed)) {
    return { ok: false, error: "Benchmark contains unexpected fields." };
  }

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  const bw = Number(raw.bodyweight_kg);
  if (!Number.isFinite(bw) || bw < 36 || bw > 181) {
    return { ok: false, error: "Bodyweight must be between 36 and 181 kg." };
  }

  const bench = num(raw.bench_kg);
  const squat = num(raw.squat_kg);
  const deadlift = num(raw.deadlift_kg);
  const endurance = num(raw.endurance_seconds);

  if (bench !== null && (!Number.isFinite(bench) || bench < 20 || bench > 318)) {
    return { ok: false, error: "Bench must be between 20 and 318 kg." };
  }
  if (squat !== null && (!Number.isFinite(squat) || squat < 20 || squat > 409)) {
    return { ok: false, error: "Squat must be between 20 and 409 kg." };
  }
  if (
    deadlift !== null &&
    (!Number.isFinite(deadlift) || deadlift < 20 || deadlift > 454)
  ) {
    return { ok: false, error: "Deadlift must be between 20 and 454 kg." };
  }
  if (bench === null && squat === null && deadlift === null && endurance === null) {
    return { ok: false, error: "At least one lift or an endurance time is required." };
  }
  if (bench !== null && bench / bw > 3.2) {
    return { ok: false, error: "Bench-to-bodyweight ratio looks unrealistic." };
  }
  if (squat !== null && squat / bw > 4.0) {
    return { ok: false, error: "Squat-to-bodyweight ratio looks unrealistic." };
  }
  if (deadlift !== null && deadlift / bw > 4.5) {
    return { ok: false, error: "Deadlift-to-bodyweight ratio looks unrealistic." };
  }
  // Canonical (half-marathon-equivalent) seconds. The submission window, not
  // the 4200-28800 dataset eligibility bound, which stays unchanged.
  if (
    endurance !== null &&
    (!Number.isFinite(endurance) ||
      endurance < SUBMISSION_CANONICAL_ENDURANCE_SECONDS.min ||
      endurance > SUBMISSION_CANONICAL_ENDURANCE_SECONDS.max)
  ) {
    return { ok: false, error: "Endurance time looks out of range." };
  }

  const unitSystem = raw.unit_system === "kg" ? "kg" : "lb";

  // The saved result's benchmark. Missing or malformed means the review cannot
  // be tied to the dataset the result was scored against: ask to recalculate.
  const datasetVersionId = raw.dataset_version_id;
  const scoreVersion = raw.score_version;
  if (
    typeof datasetVersionId !== "string" ||
    !UUID_PATTERN.test(datasetVersionId) ||
    typeof scoreVersion !== "string" ||
    scoreVersion.length === 0 ||
    scoreVersion.length > 32
  ) {
    return { ok: false, error: RECALCULATE_MESSAGE, recalculate: true };
  }

  return {
    ok: true,
    benchmark: {
      bodyweightKg: bw,
      benchKg: bench,
      squatKg: squat,
      deadliftKg: deadlift,
      enduranceSeconds: endurance,
      unitSystem,
      datasetVersionId: datasetVersionId.toLowerCase(),
      scoreVersion,
    },
  };
}
