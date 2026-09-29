// Group 5 — homepage and calculator polish. Source-level checks for the few
// behaviour changes that matter; layout and motion were verified in a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildScoreRequestDraft } from "../lib/tool/scoreSubmission";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tool = read("../app/tool/page.tsx");

describe("homepage copy", () => {
  const home = ["Hero", "BalanceStory", "HowItWorks", "ExampleResult", "LeaderboardPreview", "FinalCTA"]
    .map((c) => read(`../components/home/${c}.tsx`))
    .join("\n")
    // JSX text wraps across source lines; compare it as rendered.
    .replace(/\s+/g, " ");

  it("no longer implies a 5K is the only run accepted", () => {
    assert.doesNotMatch(home, /lifts and (your )?5K|and 5K time|a recent 5K|your 5K/i);
    assert.match(home, /5K to marathon/);
  });

  it("says publishing to the leaderboard is optional", () => {
    assert.match(home, /private unless you choose/);
  });

  it("makes no time-estimate claim, here or in the calculator intro", () => {
    assert.doesNotMatch(home, /about a minute/i);
    assert.doesNotMatch(tool, /about a minute/i);
  });

  it("does not claim a high score means a balanced profile", () => {
    assert.doesNotMatch(home, /well-rounded/i);
    assert.match(home, /a high score can still lean heavily to one side/i);
  });
});

describe("calculator", () => {
  it("has no artificial delay or staged loading theatre", () => {
    assert.doesNotMatch(tool, /new Promise\(\(r\) => setTimeout/);
    assert.doesNotMatch(tool, /CALIBRATING|COMPILING|scanStage/);
  });

  it("shows no tier or athlete type before a saved result exists", () => {
    const preview = tool.slice(tool.indexOf("function ResultPreview()"), tool.indexOf("function ResultLoading()"));
    for (const tier of ["WORLD CLASS", "ELITE", "ADVANCED", "INTERMEDIATE", "NOVICE"]) {
      assert.ok(!preview.includes(tier), tier);
    }
    // The tier table marks only the saved result's tier.
    assert.match(tool, /const active = result\.tier === \(row\.label as Tier\);/);
    // A shared link pre-fills the form but is not a result.
    assert.match(tool, /const hasResults = saved !== null;/);
    assert.doesNotMatch(tool, /setHasResults/);
  });

  it("drops the claim that a higher score is more well-rounded", () => {
    assert.doesNotMatch(tool, /well-rounded/i);
    assert.doesNotMatch(tool, /on the left/);
  });

  it("respects reduced motion", () => {
    assert.match(tool, /<MotionConfig reducedMotion="user">/);
  });

  it("maps every field the validator can name to the step that owns it", () => {
    const map = tool.slice(tool.indexOf("const FIELD_STEP"), tool.indexOf("};", tool.indexOf("const FIELD_STEP")));
    for (const field of ["display_name", "bodyweight", "bench", "squat", "deadlift", "run_distance", "run_seconds"]) {
      assert.match(map, new RegExp(`\\b${field}: [1-3],`), field);
    }
  });
});

describe("required-field message", () => {
  it("no longer says a private result is 'ranked'", () => {
    const built = buildScoreRequestDraft({
      displayName: "",
      unitSystem: "kg",
      bodyweight: "",
      bench: "100",
      squat: "140",
      deadlift: "180",
      runDistance: "5k",
      runSeconds: 1400,
      visibility: "private",
    });
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.message, "Bodyweight is required.");
      assert.equal(built.error.code, "MISSING_EVENT");
    }
  });
});
