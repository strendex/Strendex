// Athlete Review entry flow — the results-page invitation, the intro once a
// result has carried over, and the landing for direct visitors. The screens are
// rendered to markup; the results page is checked at source level because it
// needs the app router. Layout and motion are verified in a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { IntroScreen, LandingState } from "../app/athlete-review/components/screens";
import { createResultViewTracker } from "../lib/athleteReview/analytics";
import { ctaTension, type TensionInput } from "../lib/athleteReview/entryCopy";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// JSX text wraps across source lines; compare it as rendered.
const flat = (path: string) => read(path).replace(/\s+/g, " ");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const FULL_INPUTS: TensionInput["inputs"] = {
  benchKg: 100,
  squatKg: 140,
  deadliftKg: 180,
  enduranceSeconds: 1500,
};

function intro(resuming: boolean) {
  return renderToStaticMarkup(
    createElement(IntroScreen, {
      hybridScore: 61,
      tier: "ADVANCED",
      archetype: "STRENGTH-LEANING HYBRID",
      strengthPercentile: 72.4,
      endurancePercentile: 54.1,
      resuming,
      onStart: () => {},
      onStartOver: resuming ? () => {} : null,
    }),
  );
}

describe("results page: Athlete Review placement", () => {
  const tool = read("../app/tool/page.tsx");

  it("sits after the key result tiles and before the full breakdown", () => {
    const order = [
      'label="Strength percentile"',
      'label="Endurance percentile"',
      'label="Athlete type"',
      "<AthleteReviewCTA",
      '"See full breakdown"',
      'id="result-details"',
    ].map((marker) => tool.indexOf(marker));
    assert.ok(order.every((i) => i >= 0), "every marker is present");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("still hands the review the SAVED result and its benchmark", () => {
    const cta = tool.slice(tool.indexOf("<AthleteReviewCTA"), tool.indexOf('"See full breakdown"'));
    assert.match(cta, /hybridScore=\{saved\.result\.hybridScore\}/);
    assert.match(cta, /datasetVersionId: saved\.result\.datasetVersionId/);
    assert.match(cta, /toCanonicalEnduranceSeconds\(/);
  });
});

describe("results page: Athlete Review invitation", () => {
  const cta = flat("../components/AthleteReviewCTA.tsx");

  it("asks what would move the score, under the Athlete Review label", () => {
    assert.match(cta, /Your score shows where you stand\. What would move it most\?/);
    assert.match(cta, />\s*Athlete Review\s*</);
  });

  it("says the numbers carry over", () => {
    assert.match(cta, /Your lifts, run, score and profile are already loaded\. Add your training, goals and recovery\./);
  });

  it("offers 'Build my Athlete Review' and drops the old teaser", () => {
    assert.match(cta, />\s*Build my Athlete Review\s*</);
    assert.doesNotMatch(cta, /Reveal My Fastest Path/);
    assert.doesNotMatch(cta, /New ·/);
  });

  it("has no blur or lock paywall treatment", () => {
    assert.doesNotMatch(cta, /blur-/);
    assert.doesNotMatch(cta, /<rect|M8 11V8a4 4 0 0 1 8 0v3/);
  });

  it("makes no duration claim", () => {
    assert.match(cta, /Free · uses your existing results/);
    assert.doesNotMatch(cta, /minute/i);
  });

  it("previews what the review covers", () => {
    for (const title of [
      "What’s holding your score back",
      "The change most likely to raise it",
      "Your next training focus",
    ]) {
      assert.ok(read("../lib/athleteReview/entryCopy.ts").includes(`"${title}"`), title);
    }
  });
});

describe("results page: personal tension line", () => {
  it("names endurance as the trailing side, with the real gap", () => {
    const t = ctaTension({
      strengthPercentile: 72.4,
      endurancePercentile: 54.1,
      archetype: "STRENGTH-LEANING HYBRID",
      inputs: FULL_INPUTS,
    });
    assert.equal(t.variant, "gap");
    assert.match(t.copy, /^Your endurance trails your strength by 18 percentile points\./);
    assert.match(t.copy, /most likely/);
    assert.doesNotMatch(t.copy, /fastest|guarantee/i);
  });

  it("names strength as the trailing side when it is", () => {
    const t = ctaTension({
      strengthPercentile: 30,
      endurancePercentile: 81.6,
      archetype: "ENDURANCE MACHINE",
      inputs: FULL_INPUTS,
    });
    assert.equal(t.variant, "gap");
    assert.match(t.copy, /^Your strength trails your endurance by 52 percentile points\./);
  });

  it("uses the balanced branch for a balanced athlete", () => {
    const t = ctaTension({
      strengthPercentile: 60.2,
      endurancePercentile: 55.9,
      archetype: "BALANCED HYBRID",
      inputs: FULL_INPUTS,
    });
    assert.equal(t.variant, "balanced");
    assert.match(t.copy, /^Your two sides are close\./);
  });

  it("does not call a leaning athlete 'close' beside their athlete type", () => {
    const t = ctaTension({
      strengthPercentile: 70,
      endurancePercentile: 55,
      archetype: "STRENGTH-LEANING HYBRID",
      inputs: FULL_INPUTS,
    });
    assert.equal(t.variant, "gap");
    assert.match(t.copy, /by 15 percentile points/);
  });

  it("stays truthful when part of the profile is missing", () => {
    const t = ctaTension({
      strengthPercentile: null,
      endurancePercentile: 55,
      archetype: "BALANCED HYBRID",
      inputs: { ...FULL_INPUTS, benchKg: null, squatKg: null },
    });
    assert.equal(t.variant, "incomplete");
    assert.match(t.copy, /still unresolved/);
  });
});

describe("intro once a result has carried over", () => {
  it("starts from the athlete's own baseline", () => {
    const page = text(intro(false));
    assert.match(page, /You know where you stand\. Now find where the next points are\./);
    assert.match(page, /Your Strendex numbers are already loaded\./);
    for (const value of ["61", "ADVANCED", "STRENGTH-LEANING HYBRID", "72.4%", "54.1%"]) {
      assert.ok(page.includes(value), value);
    }
  });

  it("shows what the finished review answers", () => {
    const page = text(intro(false));
    for (const title of [
      "What’s holding your score back",
      "The one change most likely to raise it",
      "Estimated score scenarios",
      "What you should keep doing",
      "Your next training focus",
    ]) {
      assert.ok(page.includes(title), title);
    }
  });

  it("says 'Start my Athlete Review' on a fresh visit", () => {
    const page = text(intro(false));
    assert.match(page, /Start my Athlete Review/);
    assert.doesNotMatch(page, /Continue my Athlete Review|Start over/);
  });

  it("says 'Continue my Athlete Review' when answers are saved, without a step count", () => {
    const page = text(intro(true));
    assert.match(page, /Continue my Athlete Review/);
    assert.match(page, /Your answers are saved\./);
    assert.match(page, /Start over/);
    assert.doesNotMatch(page, /Resume review|step \d of 5/i);
  });

  it("omits percentiles the snapshot does not have", () => {
    const page = text(
      renderToStaticMarkup(
        createElement(IntroScreen, {
          hybridScore: 40,
          tier: "INTERMEDIATE",
          archetype: "BASE BUILDER",
          strengthPercentile: null,
          endurancePercentile: null,
          resuming: false,
          onStart: () => {},
          onStartOver: null,
        }),
      ),
    );
    assert.doesNotMatch(page, /Strength percentile|Endurance percentile/);
  });
});

describe("landing for direct visitors", () => {
  it("asks for a Strendex result first, without claiming one is loaded", () => {
    const html = renderToStaticMarkup(createElement(LandingState));
    const page = text(html);
    assert.match(page, /Start with your Strendex result\./);
    assert.match(page, /Take the free assessment/);
    assert.match(html, /href="\/tool\?intent=athlete-review"/);
    assert.doesNotMatch(page, /already loaded/);
  });

  it("keeps the recalculation notice", () => {
    const page = text(renderToStaticMarkup(LandingState({ notice: "Recalculate first." })));
    assert.match(page, /Recalculate first\./);
  });
});

describe("no duration claims on the entry surfaces", () => {
  it("none of the touched surfaces says how many minutes it takes", () => {
    for (const html of [intro(false), intro(true), renderToStaticMarkup(createElement(LandingState))]) {
      assert.doesNotMatch(text(html), /3–5|minute/i);
    }
    assert.doesNotMatch(flat("../components/AthleteReviewCTA.tsx"), /3–5|minute/i);
  });
});

describe("analytics", () => {
  it("keeps every existing Athlete Review event name", () => {
    const sources = [
      flat("../app/athlete-review/page.tsx"),
      flat("../components/AthleteReviewCTA.tsx"),
      flat("../app/athlete-review/components/ReportView.tsx"),
    ].join(" ");
    for (const event of [
      "athlete_review_cta_viewed",
      "athlete_review_cta_clicked",
      "athlete_review_landing_viewed",
      "athlete_review_started",
      "athlete_review_step_completed",
      "athlete_review_generation_started",
      "athlete_review_generated",
      "athlete_review_generation_failed",
      "athlete_review_scenario_viewed",
    ]) {
      assert.ok(sources.includes(`"${event}"`), event);
    }
  });

  it("tracks a result view once per saved result, not once per render", () => {
    const calls: [string, unknown][] = [];
    const track = createResultViewTracker((event, props) => calls.push([event, props]));
    const props = { score_band: "60-69", archetype: "BALANCED HYBRID" };

    track("result-a", props);
    track("result-a", props);
    track("result-a", props);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ["athlete_review_result_viewed", props]);

    track("result-b", props);
    assert.equal(calls.length, 2);
  });

  it("the result view sends only coarse properties", () => {
    const tool = read("../app/tool/page.tsx");
    const call = tool.slice(tool.indexOf("trackResultViewed(result.resultId"), tool.indexOf("}, [result, trackResultViewed]"));
    assert.match(call, /score_band: scoreBand\(result\.hybridScore\)/);
    assert.match(call, /archetype: result\.archetype/);
    assert.doesNotMatch(call, /display_name|bench|squat|deadlift|run_seconds|bodyweight/);
  });
});
