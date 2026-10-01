// Homepage Athlete Review section. The example's numbers are static marketing
// constants; this file is what keeps them true to the scoring engine and the
// scenario selection. Layout and motion are verified in a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AthleteReviewPreview from "../components/home/AthleteReviewPreview";
import { DEMO, DEMO_INPUTS, DEMO_LIMITER, REVIEW_EXAMPLE } from "../components/home/demo-data";
import { GOAL_OPTIONS } from "../lib/athleteReview/questions";
import { computeScenarios } from "../lib/athleteReview/scenarios";
import type { GoalOption } from "../lib/athleteReview/types";
import {
  canonicalScoreFromPercentiles,
  getArchetype,
  getTier,
  toCanonicalEnduranceSeconds,
} from "../lib/scoring/core";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../components/home/AthleteReviewPreview.tsx");
// Server-rendered markup: what a visitor sees with JS off or before any reveal.
const html = renderToStaticMarkup(createElement(AthleteReviewPreview));
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("homepage Athlete Review example is pinned to the engine", () => {
  it("starts from the homepage athlete's own percentiles and score", () => {
    assert.equal(REVIEW_EXAMPLE.endurancePercentile.from, DEMO.endurancePercentile);
    assert.equal(REVIEW_EXAMPLE.hybridScore.from, DEMO.hybridScore);
    assert.equal(canonicalScoreFromPercentiles(72, 58), 65);
    assert.equal(
      canonicalScoreFromPercentiles(DEMO.strengthPercentile, REVIEW_EXAMPLE.endurancePercentile.from),
      REVIEW_EXAMPLE.hybridScore.from,
    );
  });

  it("derives the projected score from the projected percentile", () => {
    assert.equal(canonicalScoreFromPercentiles(72, 66), 69);
    assert.equal(
      canonicalScoreFromPercentiles(DEMO.strengthPercentile, REVIEW_EXAMPLE.endurancePercentile.to),
      REVIEW_EXAMPLE.hybridScore.to,
    );
    assert.equal(REVIEW_EXAMPLE.scoreDelta, REVIEW_EXAMPLE.hybridScore.to - REVIEW_EXAMPLE.hybridScore.from);
    assert.equal(REVIEW_EXAMPLE.scoreDelta, 4);
  });

  it("names the lower side and the real gap", () => {
    assert.equal(DEMO_LIMITER.side, "Endurance");
    assert.equal(DEMO_LIMITER.gap, 14);
    assert.equal(REVIEW_EXAMPLE.limiter, `Endurance is the lower side, ${DEMO_LIMITER.gap} points behind strength.`);
  });

  it("recommends the scenario the real selection logic picks", () => {
    const [minutes, seconds] = DEMO_INPUTS.endurance[0].value.split(":").map(Number);
    const lift = (label: string) => Number(DEMO_INPUTS.strength.find((s) => s.label === label)!.value);
    const input = {
      bodyweightKg: DEMO_INPUTS.bodyweightKg,
      benchKg: lift("Bench"),
      squatKg: lift("Squat"),
      deadliftKg: lift("Deadlift"),
      enduranceSeconds: toCanonicalEnduranceSeconds(minutes * 60 + seconds, "5k"),
    };
    // The percentiles are the example's illustrative inputs, so the current
    // result is stated rather than scored. Only the selection is under test;
    // the projections against this empty dataset are not used.
    const current = {
      strengthIndex: DEMO.strengthIndex,
      enduranceIndex: DEMO.enduranceIndex,
      strengthPercentile: DEMO.strengthPercentile,
      endurancePercentile: DEMO.endurancePercentile,
      hq: DEMO.hybridScore,
      tier: getTier(DEMO.hybridScore),
      archetype: getArchetype(DEMO.strengthPercentile, DEMO.endurancePercentile),
    };

    // Every goal that does not name a side outright.
    const goals = GOAL_OPTIONS.map((g) => g.value as GoalOption).filter(
      (g) => !["strength", "endurance", "race_prep"].includes(g),
    );
    assert.ok(goals.includes("raise_score"));
    for (const primaryGoal of goals) {
      const scenarios = computeScenarios({
        input,
        dataset: { strengthScores: [], enduranceScores: [] },
        current,
        primaryGoal,
      });
      const primary = scenarios.find((s) => s.isPrimary);
      assert.equal(primary?.id, REVIEW_EXAMPLE.primaryScenario, primaryGoal);
    }
    assert.equal(REVIEW_EXAMPLE.primaryScenario, "balanced");
    assert.match(REVIEW_EXAMPLE.focus, /^A balanced build is the better fit here/);
  });

  it("claims no run time or lift change, and no extra weight for either side", () => {
    const copy = `${REVIEW_EXAMPLE.limiter} ${REVIEW_EXAMPLE.focus} ${text}`;
    assert.doesNotMatch(copy, /\d+:\d{2}|\bkg\b|\blb\b|\bmin\b|seconds/);
    assert.doesNotMatch(copy, /more valuable|worth more|counts? (for )?more/i);
    assert.match(text, /Strength and endurance each count for half of the score\./);
  });
});

describe("homepage Athlete Review section renders", () => {
  it("shows the example numbers, labelled EXAMPLE", () => {
    assert.match(text, /Example/);
    assert.match(text, /Fictional athlete\. Not a real result\./);
    assert.match(text, /Endurance percentile 58 → to 66/);
    assert.match(text, /Hybrid Score 65 → to 69/);
    assert.match(text, /\+4 pts/);
  });

  it("leads with the outcome headline and the short support line", () => {
    assert.match(text, /Your score shows where you stand\. Athlete Review shows what to train next\./);
    assert.match(text, /Built from your Strendex result, then shaped by how you train, recover and what you’re working toward\./);
  });

  it("shows both findings and the rest of the report", () => {
    for (const line of [
      "What’s holding the score back",
      REVIEW_EXAMPLE.limiter,
      "What to focus on",
      "A balanced build is the better fit here — improve endurance while still moving strength forward.",
      "The change most likely to raise it",
      "What to keep doing",
      "Your next training focus",
    ]) {
      assert.ok(text.includes(line), line);
    }
  });

  it("offers 'Build my Athlete Review' with the free line", () => {
    assert.match(text, /Build my Athlete Review/);
    assert.match(text, /Free · uses your existing results/);
    assert.match(html, /href="\/athlete-review"/);
  });

  it("puts the one CTA after the example's findings and before the rest of the report", () => {
    const order = [
      "Score scenario",
      "What’s holding the score back",
      "What to focus on",
      "Build my Athlete Review",
      "Free · uses your existing results",
      "Also in the full review",
    ].map((marker) => text.indexOf(marker));
    assert.ok(order.every((i) => i >= 0), "every marker is present");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.equal(html.match(/href="\/athlete-review"/g)?.length, 1, "the CTA is not duplicated");
  });

  it("drops the old copy", () => {
    assert.doesNotMatch(text, /A written breakdown of your result\./);
    assert.doesNotMatch(text, /See what’s included|See what's included/);
    assert.doesNotMatch(text, /early access/i);
  });

  it("makes no time estimate", () => {
    assert.doesNotMatch(text, /minute|\bmin\b|questions|3–5|~2/i);
  });

  it("has no blur, lock or fade-out paywall treatment", () => {
    assert.doesNotMatch(source, /blur-|backdrop-blur|mask-image|padlock|M8 11V8a4 4 0 0 1 8 0v3/);
    assert.doesNotMatch(text, /unlock|locked|upgrade|premium|price/i);
  });
});

describe("homepage Athlete Review section stays static", () => {
  it("calls no API, database or runtime scoring", () => {
    assert.doesNotMatch(source, /fetch\(|\/api\/|supabase|lib\/scoring|computeScore|saveSnapshot/i);
    assert.doesNotMatch(read("../components/home/demo-data.ts"), /from ["'][^"']*(lib\/scoring|supabase)/);
  });

  it("animates only through the shared reveal, which respects reduced motion", () => {
    assert.match(source, /import \{ Reveal \} from "\.\/motion"/);
    assert.doesNotMatch(source, /from "motion\/react"|useCountUp|animate\(|repeat/);
    const motion = read("../components/home/motion.tsx");
    assert.match(motion, /const transition = reduced \? \{ duration: 0 \}/);
  });
});
