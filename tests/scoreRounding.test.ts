// Rounding equivalence between the application and the database constraint.
//
// The Hybrid Score had two implementations that disagreed: the server's
// Math.round(0.5*sp + 0.5*ep), and the database's
// round(0.5*strength_percentile + 0.5*endurance_percentile) over two double
// precision columns, which is round(double precision) -> rint() -> ties-to-even
// on the usual build.
//
// 20260924_03 removes the database's copy and replaces the CHECK with
//   round((strength_percentile::numeric + endurance_percentile::numeric) / 2)
// which is exact decimal arithmetic with ties away from zero.
//
// WHAT THIS FILE PROVES, AND WHAT IT DOES NOT
//   It proves the two rules agree for EVERY value the application can produce.
//   It does NOT prove what Postgres does — round(double precision) is
//   platform-dependent and the float8 -> numeric cast has its own semantics.
//   migrations/verify/20260924_verify_score_rounding.sql is the check that
//   settles Postgres behaviour, and it has to be run against staging.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  REVIEW_THRESHOLD,
  canonicalScoreFromPercentiles,
  getTier,
  moderationStatusForScore,
} from "@/lib/scoring/core";

/**
 * The domain of the problem. percentileMidrank() returns
 * Number(p.toFixed(1)) clamped to [0,100], so a percentile is always a
 * 1-decimal value in that range: 1001 possibilities, 1,002,001 pairs.
 */
const TENTHS = 1000;

/**
 * The SQL constraint's arithmetic, modelled exactly with integers.
 *
 * round((sp::numeric + ep::numeric) / 2) is exact decimal arithmetic with ties
 * away from zero. With both percentiles expressed in tenths, the exact value is
 * (spTenths + epTenths) / 20, and rounding that half-upward for non-negative
 * input is floor((spTenths + epTenths + 10) / 20).
 *
 * No floating point appears anywhere in this function, which is the point: it
 * is an independent oracle, not a re-run of the code under test.
 */
function sqlConstraintValue(spTenths: number, epTenths: number): number {
  return Math.floor((spTenths + epTenths + 10) / 20);
}

/** round(double precision) as rint() does it on a ties-to-even build. */
function floatRoundTiesToEven(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (frac > 0.5) return floor + 1;
  if (frac < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

describe("Hybrid Score rounding: application vs database constraint", () => {
  test("agree on every supported percentile pair", () => {
    let compared = 0;
    const counterExamples: string[] = [];

    for (let sp = 0; sp <= TENTHS; sp++) {
      for (let ep = 0; ep <= TENTHS; ep++) {
        const app = canonicalScoreFromPercentiles(sp / 10, ep / 10);
        const sql = sqlConstraintValue(sp, ep);
        compared++;
        if (app !== sql && counterExamples.length < 10) {
          counterExamples.push(
            `sp=${sp / 10} ep=${ep / 10}: app=${app} constraint=${sql}`,
          );
        }
      }
    }

    assert.equal(compared, (TENTHS + 1) ** 2, "domain not fully covered");
    assert.deepEqual(
      counterExamples,
      [],
      `constraint disagrees with the application:\n${counterExamples.join("\n")}`,
    );
  });

  test("exact .5 ties are all resolved upward, never to even", () => {
    // Every tie in the domain: spTenths + epTenths congruent to 10 mod 20.
    let ties = 0;
    for (let sp = 0; sp <= TENTHS; sp++) {
      for (let ep = 0; ep <= TENTHS; ep++) {
        if ((sp + ep) % 20 !== 10) continue;
        ties++;
        const exactLower = (sp + ep - 10) / 20; // the integer below the tie
        assert.equal(
          canonicalScoreFromPercentiles(sp / 10, ep / 10),
          exactLower + 1,
          `tie at ${(sp + ep) / 20} did not round up`,
        );
      }
    }
    assert.equal(ties, 50100, "unexpected number of ties in the domain");
  });
});

describe("the divergence the migration removes", () => {
  test("only the 75/ELITE threshold is reachable by ties-to-even", () => {
    const boundaries = [40, 60, 75, 90] as const;
    const diverging: number[] = [];

    for (const boundary of boundaries) {
      const tie = boundary - 0.5;
      if (Math.round(tie) !== floatRoundTiesToEven(tie)) {
        diverging.push(boundary);
      }
    }

    // 74 is even so 74.5 rounds down under ties-to-even; 39, 59 and 89 are odd
    // so those ties round up under both rules.
    assert.deepEqual(diverging, [75]);
  });

  test("a tier label could disagree with the saved score, and now cannot", () => {
    // The concrete bug: the server chose ELITE from 75, the trigger then stored
    // 74, and the row read back as "74, ELITE".
    const app = canonicalScoreFromPercentiles(74.0, 75.0); // raw 74.5
    assert.equal(app, 75);
    assert.equal(getTier(app), "ELITE");

    assert.equal(floatRoundTiesToEven(74.5), 74);
    assert.equal(getTier(74), "ADVANCED");

    // The constraint now agrees with the application, so the pair is consistent.
    assert.equal(sqlConstraintValue(740, 750), 75);
  });

  test("moderation is never affected by the rounding change", () => {
    // The review threshold is 90, whose tie is 89.5. 89 is odd, so both rules
    // round it to 90 — no submission changes moderation state either way.
    assert.equal(REVIEW_THRESHOLD, 90);
    assert.equal(Math.round(89.5), 90);
    assert.equal(floatRoundTiesToEven(89.5), 90);

    let divergentModeration = 0;
    for (let sp = 0; sp <= TENTHS; sp++) {
      for (let ep = 0; ep <= TENTHS; ep++) {
        const raw = 0.5 * (sp / 10) + 0.5 * (ep / 10);
        const underApp = Math.round(raw);
        const underTrigger = floatRoundTiesToEven(raw);
        if (underApp === underTrigger) continue;
        if (
          moderationStatusForScore(underApp) !==
          moderationStatusForScore(underTrigger)
        ) {
          divergentModeration++;
        }
      }
    }
    assert.equal(divergentModeration, 0);
  });

  test("divergence is always exactly one point, and always downward in the database", () => {
    let divergent = 0;
    for (let sp = 0; sp <= TENTHS; sp++) {
      for (let ep = 0; ep <= TENTHS; ep++) {
        const raw = 0.5 * (sp / 10) + 0.5 * (ep / 10);
        const app = Math.round(raw);
        const trigger = floatRoundTiesToEven(raw);
        if (app === trigger) continue;
        divergent++;
        assert.equal(app - trigger, 1, `unexpected gap at ${raw}`);
      }
    }
    // 2.50% of the domain. The production audit found 9 such rows in 534.
    assert.equal(divergent, 25050);
  });
});

describe("clamping survives the change", () => {
  test("0 and 100 are preserved exactly, not treated as missing", () => {
    assert.equal(canonicalScoreFromPercentiles(0, 0), 0);
    assert.equal(sqlConstraintValue(0, 0), 0);
    assert.equal(canonicalScoreFromPercentiles(100, 100), 100);
    assert.equal(sqlConstraintValue(1000, 1000), 100);
  });

  test("out-of-range percentiles are clamped before the blend", () => {
    assert.equal(canonicalScoreFromPercentiles(-10, 50), 25);
    assert.equal(canonicalScoreFromPercentiles(150, 50), 75);
  });
});
