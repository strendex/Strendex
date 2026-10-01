// Group 2 — homepage framed as a hybrid assessment. Source-level checks for the
// decisions that matter; layout and motion are verified in a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getTier } from "../lib/scoring/core";
import { TIER_SCALE } from "../components/home/AssessmentPreview";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// JSX text wraps across source lines; compare it as rendered.
const flat = (path: string) => read(path).replace(/\s+/g, " ");

describe("assessment section tier scale", () => {
  it("matches the engine's tier boundaries exactly", () => {
    let expectedMin = 0;
    for (const t of TIER_SCALE) {
      assert.equal(t.min, expectedMin, `${t.tier} starts where the last tier ended`);
      assert.equal(getTier(t.min), t.tier);
      assert.equal(getTier(t.max), t.tier);
      expectedMin = t.max + 1;
    }
    assert.equal(TIER_SCALE.at(-1)!.max, 100);
  });
});

describe("homepage structure", () => {
  const page = read("../app/page.tsx");

  it("puts the assessment section directly under the hero", () => {
    const order = ["<Hero />", "<AssessmentPreview />", "<BalanceStory />", "<HowItWorks />", "<AthleteReviewPreview />", "<FinalCTA />"]
      .map((tag) => page.indexOf(tag));
    assert.ok(order.every((i) => i >= 0), "every section is rendered");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("keeps the worked example and rankings off the page", () => {
    assert.doesNotMatch(page, /ExampleResult|<LeaderboardPreview \/>/);
  });

  it("uses the assessment metadata", () => {
    assert.match(page, /title: "STRENDEX \| Hybrid Athlete Assessment"/);
  });
});

describe("assessment section shows no pretend result", () => {
  const section = read("../components/home/AssessmentPreview.tsx");

  it("does not draw on the demo athlete", () => {
    assert.doesNotMatch(section, /from ["']\.\/demo-data["']/);
    assert.doesNotMatch(section, /\bDEMO(_[A-Z]+)?\b|\bAlex\b/);
  });

  it("explains where you stand, what kind of athlete you are and what holds you back", () => {
    for (const title of ["Where you stand", "What kind of athlete you are", "What’s holding you back"]) {
      assert.ok(section.includes(`title="${title}"`), title);
    }
  });
});

describe("homepage copy", () => {
  it("keeps the hero headline", () => {
    const hero = read("../components/home/Hero.tsx");
    assert.match(hero, /<span className="block">Built for both\.<\/span>/);
    assert.match(hero, /<span className="block">Know where you stand\.<\/span>/);
  });

  it("says 'Test yourself' on every primary product CTA", () => {
    for (const file of ["../components/Header.tsx", "../components/home/Hero.tsx", "../components/home/FinalCTA.tsx"]) {
      const source = flat(file);
      assert.match(source, /Test yourself/, file);
      assert.doesNotMatch(source, /Get your Hybrid Score/, file);
    }
  });

  it("keeps the dataset disclosure off the homepage", () => {
    const balance = flat("../components/home/BalanceStory.tsx");
    assert.match(balance, /Illustrative example\./);
    assert.doesNotMatch(balance, /simulated reference dataset/);
  });

  it("shows no example athlete in the Athlete Review preview", () => {
    const review = flat("../components/home/AthleteReviewPreview.tsx");
    assert.doesNotMatch(review, /DEMO\.name|Hybrid Score \{DEMO/);
    assert.doesNotMatch(review, /Excerpt from an example review/);
  });

  it("closes on the new final line", () => {
    const close = flat("../components/home/FinalCTA.tsx");
    assert.match(close, /See what your training says about you\./);
    assert.doesNotMatch(close, /Your lifts and your run, in one score\./);
  });
});
