# Group 4 — Publication consent, Athlete Review cost cap, privacy

Branch: `launch/group-1-score-consistency` (uncommitted, on top of Groups 1–3).
Verified on **staging only** (`rnifjhxnxopyrueakxpz`) through the separate Vercel
project `strendex-staging`. No production access or changes, no migrations, no
paid calls.

## What changed

**Publication is opt-in.**
- **The checkbox:** "Add my result to the public leaderboard" is unticked by
  default. Unticked sends `private` and ticked sends `public`
  (`submissionVisibility`).
- **Part of the submission:** visibility is part of the request draft, so it
  counts towards stale-result detection and the idempotency key. Changing the
  box marks a shown result as stale, and recalculating saves a new result.
- **Copy:** under the box, "Applies to your next calculation. Unticking it
  later won't remove a result you've already published."
- **Reset** unticks it.
- **Scoring is identical** for private and public results. A private result
  gets no placement, and placement isn't even computed.
- **Explanations check visibility before moderation:** a private 90+ result is
  told it was saved privately, not that it awaits leaderboard review.

**Athlete Review daily attempt cap** (`lib/server/reviewCap.ts`).
- **`ATHLETE_REVIEW_DAILY_CAP`:** absent means **50**; `0` disables reviews;
  empty, negative, fractional, text or out-of-range values also disable them
  (fail closed).
- **One shared counter per UTC day** in Postgres, through `ai_rl_hit`, under the
  key `review-cap:global`. No per-IP key (`<scope>:<ip>`) can equal it.
- **One attempt is reserved after all validation**, immediately before the
  OpenAI call. A counter error, an invalid return or an over-cap count means no
  OpenAI call and a 503.
- **At most one OpenAI attempt per accepted request:** the manual retry is
  removed and SDK retries stay off. `max_output_tokens` stays at 3,500.
- **This caps attempts, not dollars.** The cost per attempt depends on the
  model and current pricing.

**Privacy.**
- **Share-link data kept out of PostHog, in two layers:**
  - The SDK's own `mask_personal_data_properties` with the share-link
    parameters. This masks them at source, including the stored first-visit
    URL and the feature-flag request.
  - A `before_send` hook that strips query strings and fragments from every
    URL-valued event property.

  Share links still work.
- **Analytics payload:** the Athlete Review event no longer sends
  `main_constraint`.
- **Logs:** review-route logs use the allow-list logger (route, event, code).
  No IPs, request contents, answers or error messages.
- **Not covered:** session replay, which isn't enabled in code.

## Preconditions

| Environment | `ai_rl_hit` definition | Status |
|---|---|---|
| Staging | `INSERT … ON CONFLICT (ip, bucket, bucket_id) DO UPDATE SET count = count + 1 … RETURNING count` | **Satisfied.** A single atomic statement, keyed on the full `p_ip`. Confirmed by the owner, and by 8 concurrent calls returning exactly 1–8 |
| Production | Not yet checked | **Must be verified before rollout:** `SELECT pg_get_functiondef('public.ai_rl_hit(text,text,bigint)'::regprocedure);` |

## Configuration

- `ATHLETE_REVIEW_DAILY_CAP`: optional, server-only, and not set in any Vercel
  project yet, so it defaults to 50. Set it deliberately in production, or leave
  it unset for 50.
- No migrations.

## Staging verification (2026-09-29)

**Atomic counter:** 8 concurrent service-role `ai_rl_hit` calls on the
test-only key `zz-staging-g4-atomic:ly183m`, bucket `minute`/`9100538038`, all
returned HTTP 200 with counts exactly `[1, 2, 3, 4, 5, 6, 7, 8]` and no
duplicates. The real global review counter was not touched.

**Preview:** `https://strendex-staging-i4dobcfj2-strendexs-projects.vercel.app`.
It was deployed from a fresh copy of the Group 4 working tree, identical except
for the excluded files plus a framework-only `vercel.json`. The dry run listed
152 files with no env files, archives, agent/config folders or review exports.
The project's only variables are the three staging Supabase ones: no OpenAI or
PostHog credentials.

**API checks through the deployed preview (25/25):**

| Check | Result |
|---|---|
| `/tool`, `/rankings` | 200 |
| OpenAI disabled | `POST /api/athlete-review` returns "Server configuration error." before any work |
| Deployed browser code | Has the opt-in checkbox and none of the old auto-publish copy. No PostHog key, Supabase refs, service-role or JWT strings (12 chunks) |
| Same inputs, private vs public | Both 201, with identical Hybrid Score (70), strength and endurance indexes, percentiles (98.1 / 41.3), tier, archetype, moderation status, dataset and score version |
| Private | Saved `private`, `leaderboard: null`, absent from `/rankings` |
| Public | Saved `public` and approved. Placement `{rank 4, total 10}` equals the independent competition rank. `/rankings` lists it at #4 of 10, tied at 70 with an earlier test row |

**Test data kept (nothing deleted):**
- `ZZ Staging G4 private ly3ogq`: id `d444d733-3748-489f-877e-e4b19fff0a05`,
  result `res_7ayz9aw1k7ahakbqyaz59e58`, key `sx-staging-g4-private-ly3ogq`.
  Approved and private.
- `ZZ Staging G4 public ly3ogq`: id `a3de54e6-dd3a-48c4-a531-7485a7878f30`,
  result `res_qhvgsqzbp29q1g0rhkdm6rbg`, key `sx-staging-g4-public-ly3ogq`.
  Approved and public, **visible on the staging leaderboard**.
- Rate-limit test key `zz-staging-g4-atomic:ly183m`, now at 8.

**Local tests:** `npm test` passes 437/437. The Group 4 suites have 13 consent,
10 privacy and 49 review-cap tests. `tsc` is clean, `next build` succeeds, and
lint on the Group 4 files is clean.

**Browser checks: passed, founder-reported.** The founder reported passing the
checklist below on the Group 4 preview. This is recorded as founder-reported
verification; Claude did not run these checks in a browser for Group 4. (Group 5
later exercised the same behaviours in headless Chrome against mocked
responses — see `docs/group-5-homepage-calculator-polish.md`.)

The checklist, on laptop and mobile:
1. `/tool` opens with the checkbox **unticked**, and the line under the button
   says the result stays private.
2. Score privately: the placement line says the result is private, and it isn't
   on `/rankings`.
3. With a result shown, tick the box: the stale-result notice appears.
   Recalculate: the placement line shows a rank, and the result appears on
   `/rankings`.
4. Reset: the box is unticked again.
5. Untick after publishing: the earlier public result stays on `/rankings`, as
   the copy says.

## Remaining limitations

- **Production's `ai_rl_hit` definition** must be checked before rollout.
- **The cap limits attempts, not spend;** set an OpenAI project budget as the
  final backstop.
- **Unpublishing:** a published result can't be made private from the UI.
  Unticking only affects the next submission.
- **Session replay** isn't addressed. Check the PostHog project settings.
