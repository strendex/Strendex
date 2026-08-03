// Shared dataset fixtures.
//
// Snapshots are built through the SAME hash helper production uses, so a test
// dataset is always internally consistent and a deliberately broken one is
// broken in exactly one named way.

import {
  SCORE_VERSION,
  datasetConfidence,
  type DatasetKind,
  type ScoringDatasetSnapshot,
} from "../../lib/scoring/core";
import { computeDatasetHash } from "../../lib/server/hashing";

/** `below` members under the athlete's index, `above` members over it. */
export function around(index: number, below: number, above: number): number[] {
  return [
    ...Array.from({ length: below }, () => index - 10),
    ...Array.from({ length: above }, () => index + 10),
  ];
}

export function makeSnapshot(
  strength: number[],
  endurance: number[],
  overrides: Partial<ScoringDatasetSnapshot> = {},
): ScoringDatasetSnapshot {
  const kind: DatasetKind = overrides.kind ?? "observed";
  const scoreVersion = overrides.scoreVersion ?? SCORE_VERSION;
  const eligibleSampleSize = overrides.eligibleSampleSize ?? strength.length;

  const base: ScoringDatasetSnapshot = {
    datasetVersionId: "11111111-1111-1111-1111-111111111111",
    label: "test dataset",
    kind,
    scoreVersion,
    strengthReference: strength,
    enduranceReference: endurance,
    eligibleSampleSize,
    confidence: datasetConfidence(eligibleSampleSize),
    datasetHash: computeDatasetHash({
      scoreVersion,
      datasetKind: kind,
      eligibleSampleSize,
      strengthReference: strength,
      enduranceReference: endurance,
    }),
  };

  return { ...base, ...overrides };
}
