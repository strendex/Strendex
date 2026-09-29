// Group 4 — share-link data never reaches PostHog; no questionnaire category
// in analytics. No network: PostHog is never initialised here.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { CaptureResult } from "posthog-js";

import {
  SHARE_LINK_PARAMS,
  sanitizeCaptureResult,
  stripQueryAndFragment,
} from "../lib/analytics/sanitize";
// The installed SDK's own masking function — the at-source layer.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { maskQueryParams } = require("../node_modules/posthog-js/lib/src/utils/request-utils.js") as {
  maskQueryParams: (url: string | undefined, params: string[], mask: string) => string | undefined;
};

// Distinctive values that must not survive anywhere.
const NAME = "Zelda Quintrell";
const SHARE_URL =
  `https://www.strendex.fit/tool?name=${encodeURIComponent(NAME)}&bw=187.4&b=263.9&s=351.7&d=417.3&u=lb&dist=5k&t=22%3A31#result`;
const SECRETS = [/Zelda/, /Quintrell/, /187\.4/, /263\.9/, /351\.7/, /417\.3/, /22%3A31/, /bw=/, /#result/, /name=/];

function event(): CaptureResult {
  return {
    uuid: "0190-test",
    event: "$pageview",
    timestamp: new Date("2026-09-29T12:00:00Z"),
    properties: {
      token: "phc_test_token",
      distinct_id: "anon-123",
      $lib: "web",
      $lib_version: "1.360.1",
      $insert_id: "abc123",
      $current_url: SHARE_URL,
      $host: "www.strendex.fit",
      $pathname: "/tool",
      $referrer: SHARE_URL.replace("/tool", "/rankings"),
      $referring_domain: "www.strendex.fit",
      $session_entry_url: SHARE_URL,
      $session_entry_referrer: "https://chat.example.com/thread?id=42#msg",
      $session_entry_pathname: "/tool",
      $prev_pageview_pathname: "/tool?name=Zelda#x",
      $initial_person_info: { r: "$direct", u: SHARE_URL },
      $set: { $current_url: SHARE_URL },
      utm_source: "newsletter",
      $screen_width: 1440,
      nested: { deeper: { href: SHARE_URL } },
    },
    $set: { $current_url: SHARE_URL },
    $set_once: {
      $initial_current_url: SHARE_URL,
      $initial_referrer: "https://www.strendex.fit/rankings?name=Zelda%20Quintrell",
      $initial_pathname: "/tool",
      $initial_host: "www.strendex.fit",
    },
  };
}

describe("PostHog before_send: share-link data is stripped", () => {
  it("removes the name and raw numbers from every URL-valued property", () => {
    const out = sanitizeCaptureResult(event())!;
    const json = JSON.stringify(out);
    for (const secret of SECRETS) assert.doesNotMatch(json, secret, `leaked ${secret}`);
  });

  it("keeps each URL's origin and path", () => {
    const out = sanitizeCaptureResult(event())!;
    const p = out.properties;
    assert.equal(p.$current_url, "https://www.strendex.fit/tool");
    assert.equal(p.$referrer, "https://www.strendex.fit/rankings");
    assert.equal(p.$session_entry_url, "https://www.strendex.fit/tool");
    assert.equal(p.$session_entry_referrer, "https://chat.example.com/thread");
    assert.equal(p.$prev_pageview_pathname, "/tool");
    assert.deepEqual(p.$initial_person_info, { r: "$direct", u: "https://www.strendex.fit/tool" });
    assert.equal(out.$set_once!.$initial_current_url, "https://www.strendex.fit/tool");
    assert.equal(out.$set_once!.$initial_referrer, "https://www.strendex.fit/rankings");
    assert.equal(out.$set!.$current_url, "https://www.strendex.fit/tool");
  });

  it("preserves SDK metadata and non-URL properties exactly", () => {
    const before = event();
    const out = sanitizeCaptureResult(event())!;
    for (const k of ["token", "distinct_id", "$lib", "$lib_version", "$insert_id", "$host", "$pathname",
      "$referring_domain", "utm_source", "$screen_width", "$session_entry_pathname"]) {
      assert.deepEqual(out.properties[k], before.properties[k], k);
    }
    assert.equal(out.uuid, before.uuid);
    assert.equal(out.event, before.event);
    assert.deepEqual(out.timestamp, before.timestamp);
    assert.equal(out.$set_once!.$initial_host, "www.strendex.fit");
  });

  it("never drops an event, and passes null through", () => {
    assert.equal(sanitizeCaptureResult(null), null);
    assert.ok(sanitizeCaptureResult({ uuid: "u", event: "x", properties: {} }));
  });

  it("leaves plain strings alone", () => {
    assert.equal(stripQueryAndFragment("what? really"), "what? really");
    assert.equal(stripQueryAndFragment("/tool?name=x"), "/tool?name=x", "relative only under a URL-ish key");
    assert.equal(stripQueryAndFragment("/tool?name=x", true), "/tool");
  });
});

describe("PostHog at-source masking (the SDK's own function)", () => {
  it("masks every share-link parameter the SDK would store or send", () => {
    const masked = maskQueryParams(SHARE_URL, [...SHARE_LINK_PARAMS], "<masked>")!;
    for (const secret of [/Zelda/, /Quintrell/, /187\.4/, /263\.9/, /351\.7/, /417\.3/, /22%3A31/]) {
      assert.doesNotMatch(masked, secret);
    }
    assert.match(masked, /^https:\/\/www\.strendex\.fit\/tool\?/);
  });

  it("SHARE_LINK_PARAMS is exactly what the share link writes", () => {
    const page = readFileSync(new URL("../app/tool/page.tsx", import.meta.url), "utf8");
    const written = [...page.matchAll(/params\.set\("([a-z]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(written, [...SHARE_LINK_PARAMS].sort());
  });

  it("instrumentation-client wires both layers", () => {
    const src = readFileSync(new URL("../instrumentation-client.ts", import.meta.url), "utf8");
    assert.match(src, /if \(posthogKey\)/, "still off without a key");
    assert.match(src, /mask_personal_data_properties: true/);
    assert.match(src, /custom_personal_data_properties: \[\.\.\.SHARE_LINK_PARAMS\]/);
    assert.match(src, /before_send: sanitizeCaptureResult/);
  });

  it("share links still prefill the calculator", () => {
    const page = readFileSync(new URL("../app/tool/page.tsx", import.meta.url), "utf8");
    for (const p of ["name", "bw", "b", "s", "d", "u", "dist", "t"]) {
      assert.match(page, new RegExp(`params\\.get\\("${p}"\\)`), p);
    }
  });
});

describe("analytics payloads", () => {
  it("the questionnaire's main constraint is no longer sent", () => {
    for (const f of ["../app/athlete-review/page.tsx", "../components/AthleteReviewCTA.tsx", "../app/athlete-review/components/ReportView.tsx"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      assert.equal(/main_constraint|mainConstraint\s*\?\?/.test(src.slice(src.indexOf("trackAthleteReview"))), false, f);
    }
  });
});
