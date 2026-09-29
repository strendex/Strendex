# Group 2 — Run-time validation

Branch: `launch/group-1-score-consistency` (uncommitted, on top of Group 1).
Staging only (`rnifjhxnxopyrueakxpz`): migration `20260928_01` applied by the
owner and verified. **Production is unchanged.** Nothing committed or deployed.

## What changed

Validation only. Formulas, conversions, tiers, the active dataset and dataset
eligibility are unchanged. `SCORE_VERSION` stays **2.0.0**: every input that
was accepted before scores exactly as before (pinned by golden values in
`tests/runTimeBounds.test.ts`), and newly accepted times score an endurance
index of 100, the value the formula already capped at.

1. **Fast runners are accepted.** The per-distance entered-time windows are now
   the binding limit. Submissions are bounded on the canonical
   (half-marathon-equivalent) time by a new, separate constant,
   `SUBMISSION_CANONICAL_ENDURANCE_SECONDS` = 3151–28800. That is exactly the
   converted span of the windows. The dataset builder still uses
   `VALIDATION_BOUNDS.canonicalEnduranceSeconds` = 4200–28800, unchanged.
2. **Slow maximums match what is actually accepted.** 3 mi, 5K and 10K
   maximums were lowered to the last whole second whose conversion stays within
   28800 s. Nothing accepted before is refused now.
3. **No silent time correction.** The time field no longer clamps `22:75` to
   `22:59`. A malformed time is rejected with the reason, and the field shows the
   distance's accepted range.

| Distance | Accepted (entered) | Before Group 2 | Canonical at ends |
|---|---|---|---|
| 3 mi | 11:00 – 1:40:32 | 14:40 – 1:40:32 | 3151 – 28797 |
| 5K | 11:40 – 1:44:20 | 15:13 – 1:44:20 | 3220 – 28797 |
| 10K | 25:00 – 3:37:33 | 31:44 – 3:37:33 | 3310 – 28800 |
| Half | 55:00 – 8:00:00 | 1:10:00 – 8:00:00 | 3300 – 28800 |
| Marathon | 1:55:00 – 12:00:00 | 2:25:56 – 12:00:00 | 3309 – 20720 |

## Database

`migrations/20260928_01_submissions_canonical_endurance_fast_runners.sql`
widens `submissions_canonical_endurance_range` from 4200 to 3151 (ceiling
28800 unchanged). **Apply it before deploying this code.** Otherwise a fast
runner passes validation and then fails the insert (HTTP 500). It aborts
unless:
- the constraint and `endurance_seconds_range` have their expected definitions;
- `20260924_04` has been applied;
- no other check or trigger touches the endurance columns.

It makes no data change.

## Athlete Review

- **Validation.** The review accepts the same canonical window as a
  submission (`SUBMISSION_CANONICAL_ENDURANCE_SECONDS`, 3151–28800); before,
  it refused anything under 4200. `validateBenchmark` moved unchanged from the
  route into `lib/athleteReview/benchmarkValidation.ts` so it can be tested.
  Next.js route files may only export handlers.
- **Scenarios** (`lib/athleteReview/scenarios.ts`). Both endurance paths — the
  endurance push and the balanced build — now project a time only when it is
  strictly faster. The projection never goes below 4200 s, where the endurance
  index reaches 100, and stays within the submission window. When the index is
  already 100 (any time up to 4203 s, because the index rounds to one decimal),
  both paths use the existing locked, no-improvement state instead:
  `available: false`, no projection, and the text "Your run time already earns
  the maximum endurance index…". Locked scenarios are already excluded from the
  OpenAI prompt. The strength push is unchanged and becomes the primary.
- **Behaviour kept.** Compared against the pre-Group-2 code across 78 cases,
  every athlete at 4204 s or slower gets byte-identical scenarios. Only
  4200–4203 s changed: they previously showed a "0:00" or "0:01 improvement"
  with no score gain, and now show the locked state.
- **Edge left as is.** An endurance-only fast runner, which only a direct API
  call can produce, because the calculator requires all lifts, gets three
  locked scenarios. Nothing is projected for them to cite.

## Group 3 — required before launch

`/api/submit` and `/api/rank` are still deployed and unchanged. They accept
incomplete benchmarks and trust values converted by the browser, and
`/api/submit` saves such rows as `approved`, so they reach the public
leaderboard. Retire both before launch.

## Test results (2026-09-28, local)

- `npm test`: **288 pass, 0 fail**. That is the 248 Group 1 tests, 30 in
  `tests/runTimeBounds.test.ts` and 10 in `tests/athleteReviewGroup2.test.ts`.
- `tsc --noEmit`: clean. ESLint on changed files: only the old
  `ArchetypeIcon` unused warning in `app/tool/page.tsx`.
- Golden checks against the pre-Group-2 code: 40 scoring cases give identical
  scores, and every scenario case at 4204 s or slower is identical.
- The four scenario-safety tests fail when run against the pre-Group-2
  `scenarios.ts`, so they detect the defect.
- `GET /tool` and `GET /athlete-review` compile on the local dev server.
  **Not verified in a browser** yet. `/api/athlete-review` was never called,
  so no OpenAI request was made.

## Staging results (2026-09-28)

**Migration verified by the owner.** All three constraints are validated:
- `endurance_seconds_range`: 2400–28800.
- `submissions_canonical_endurance_range`: 3151–28800.
- `submissions_original_run_seconds_range`: over 0, up to 43200.

**`POST /api/score` integration run.** Local `next dev` connected to staging:
URL and service key both resolved from `.env.development.local`, server started
after the last env edit. 55/55 checks passed. Athlete: 195 lb, 275/365/425 lb,
private, labelled `ZZ Staging G2 ltzcgs …`.

| # | Input | Result |
|---|---|---|
| 1 | 5K 12:00 | **201.** Response matches the saved row. Both `canonical_endurance_seconds` and `endurance_seconds` are 3312. Endurance index 100. Hybrid Score 100 / WORLD CLASS, saved `pending` because the score is at or above the review threshold. |
| 2 | 5K 11:39 | **400** `OUT_OF_RANGE` on `run_seconds`. No row saved. |
| 3 | 3 mi 1:40:33 | **400** `OUT_OF_RANGE` on `run_seconds`. No row saved. |
| 4 | 5K 22:30 | **201.** 81 / ELITE, percentiles 99.7 / 61.7, identical to Group 1. Active dataset `8bd76e2f-4cfb-47f0-8407-e5b812a6709d`, score version 2.0.0. |

Net rows added: 2 (543 → 545). Rows kept (not deleted):
- #1 — id `37f52b31-83a8-4d46-ac88-8f95866ad541`, result
  `res_0y6cp1hw4rbfdbadtq8wmvxc`, key `sx-staging-g2-ltzcgs-t1-5k-1200`.
- #4 — id `ca8ec4d0-0a4d-4e31-8c97-a049e5cc143c`, result
  `res_sydsns54g5bhc8ay6bzxy1m1`, key `sx-staging-g2-ltzcgs-t4-5k-2230`.

Observation, not changed: the code's review threshold is 90
(`REVIEW_THRESHOLD`), while `CLAUDE.md` says 95. This predates Group 2.

## Browser check (founder, 2026-09-28)

Passed on `localhost:3000/tool` against staging:
- a malformed time (seconds 60 or more) is rejected with the seconds message;
- correcting the time clears the error;
- switching distance updates the readable accepted-range text.

## Still pending

1. Athlete Review for a fast runner (e.g. 5K 12:00): the questionnaire
   completes, the endurance and balanced cards show as locked with the
   maximum-index text, and the strength push is primary. **This makes one paid
   OpenAI request** — owner's call.
2. Production: migration `20260928_01` must be applied before this code is
   deployed there.
