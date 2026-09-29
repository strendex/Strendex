# Group 5 — Homepage and calculator polish

**Status: visually approved by the founder** on preview
`strendex-staging-ou8nyugf9` (founder-reported approval of the final mobile
hero and the rest of the preview). Staging only; not deployed to production.

Branch: `launch/group-1-score-consistency` (uncommitted, on top of Groups 1–4).
UI and copy only. No scoring, validation limits, dataset, moderation, ranking,
idempotency, consent default, AI cap or analytics change. No migrations.
Deployed to **staging only** (`strendex-staging`).

**Preview:** `https://strendex-staging-ou8nyugf9-strendexs-projects.vercel.app`
(current: includes the final mobile hero and the time-estimate removal. Earlier
Group 5 previews: `strendex-staging-cvoy6b5cu` (superseded mobile hero) and
`strendex-staging-mu1a0ty7r` (first)).
(Deployment Protection on; staging Supabase; no OpenAI or PostHog credentials).

## What changed

### Homepage

**Hero** (`components/home/Hero.tsx`)
- **Desktop fills the first viewport** below the sticky header, with a ~40px
  glimpse of the next section: `min-height: clamp(480px, 100svh − 150px, 780px)`.
  It is a minimum, so larger text grows it and nothing is clipped. The headline
  is slightly larger (up to 66px).
- **The photo** is inset 4% top and bottom so its dark left band still sits
  under the copy.
- **Mobile (below `lg`), final founder correction:** the hero reads headline →
  short body → full-width lime "Get your Hybrid Score" (links to `/tool`) →
  photo. (An interim version that hid the hero CTA was superseded.)
  - **Body:** "Enter your bodyweight, lifts and run time. Get your Hybrid
    Score out of 100 and see how your strength and endurance compare."
  - **Desktop-only:** "See how it works" and the privacy line.
  - **Height:** the hero fills at least the first viewport beneath the
    header: `min-height: calc(100svh − 89px)`, or `− 103px` from `sm`. That is
    the header (56 + 1px border, or 62 + 1) plus the layout's top padding
    (32px, or 40px).
  - **Photo box:** `flex-1`, so it takes the height the copy leaves. It is
    never shorter than the old 6:5 box, so short screens and enlarged text
    grow and scroll. It is never taller than square, because a taller box
    crops the runner out.
  - **Crop:** 92% across, so both athletes stay in frame.
  - **Spare height on tall phones:** any height left once the photo is square
    is split above and below the copy (`my-auto`, about 35px each at
    402×874).
  - **No fixed heights and no overflow clipping.**
- **The existing entrance animation** is unchanged.

**Copy**
- **Hero:** says what to enter (bodyweight, three lifts, a run from 5K to
  marathon) and that the score combines strength and endurance into 0–100. A
  new line under the CTA: private unless you choose the leaderboard.
- **How it works:**
  - lists all five run distances;
  - explains a percentile in one sentence;
  - explains averaging and athlete type.

  A closing line separates percentiles (reference dataset) from the optional
  leaderboard and links to `/methodology`.
- **Balance story:** "a run" instead of "a 5K", and shorter.
- **Example result:**
  - "Archetype" is renamed "Athlete type";
  - the midpoint sentence is replaced with "a high score can still lean
    heavily to one side";
  - the footnote now says "simulated reference dataset".
- **Leaderboard preview:** private by default, publishing is optional, entries
  are self-reported, top scores are reviewed.
- **Final CTA:** "Your lifts and your run, in one score."

### Calculator (`app/tool/page.tsx`)

**Layout**
- The heading is now just an H1 plus one line. Removed:
  - the lime "actually rank" heading;
  - the "Takes about a minute" box;
  - the empty box in step 1;
  - the "How your score is calculated" box, which claimed "Higher means more
    well-rounded";
  - the redundant hint under the result.
- **Empty state before scoring:** a neutral list of what you'll get and a link
  to `/methodology`. It shows no tier, athlete type or placeholder values.
- **Device-neutral wording** throughout (nothing says "on the left").

**Steps**
- Structure unchanged, with clearer sub-lines.
- The step 2 line "You can still continue if you don't have a run time yet"
  was false and is gone.
- Every input has a real associated `<label>`.
- **Each step is a form**, so Enter continues. `noValidate` keeps browser
  validation out of the way.
- **Validation on Continue** uses the same canonical validator as submission.
  An error appears beside its field, with `aria-invalid`, and focus moves to it.
- **Server errors that name a field** return to that field's step and show
  inline. Other errors appear under the button as an alert.
- **The time field** allows Enter and keyboard shortcuts such as paste.
- **The distance selector** has a visible chevron.

**Motion** (`motion`, already installed; the homepage `EASE` curve is reused)
- a 300ms entrance;
- 120ms / 240ms step transitions;
- animated progress segments;
- button press feedback;
- a 320ms result reveal, keyed to the saved result so a replay doesn't
  re-animate;
- disclosures that expand in 250ms.

`MotionConfig reducedMotion="user"` plus the global reduced-motion CSS apply
throughout. There are no continuous effects: the spinner runs only while a
request is pending.

**Loading**
- The 250ms artificial delay and the fake "CALIBRATING / SCORING / COMPILING"
  stages are gone.
- The button shows a spinner and "Calculating…" (`aria-busy`, disabled).
- The first calculation shows a skeleton; a recalculation dims the old result.
- **Duplicate-submit protection is unchanged:** the session guard, plus the
  disabled button.

**Focus and scrolling**
- **When the step changes**, focus moves to the step region, and the page
  scrolls only if the heading is off-screen.
- **After a save**, focus moves to the result heading, and the panel scrolls
  into view below the sticky header only when needed.
- Nothing scrolls or steals focus on an ordinary edit.
- Steps add no history entries, so the browser Back button behaves as before.

**Result**
- The score is lime with "/ 100", next to a neutral tier pill.
- **"How is this calculated?"** is a real disclosure (`aria-expanded`). It
  replaces the hover tooltip and includes the same `scoreExplanation` text and a
  methodology link.
- **Tiles:** the two percentiles sit side by side on phones.
- **Placement line and stale notice:** both kept. The submit button reads
  "Update my score" when the result is stale.
- **Buttons:** "View rankings" is now secondary, so the only lime action is
  Athlete Review. The breakdown toggle has `aria-expanded`.
- **Lime** is removed from the tier pill, the tier-table highlight and two
  athlete-type badges. The downloadable athlete card is unchanged.
- **The saved-status line** gives way to the consent line once the entries
  change.

**Bugs fixed along the way**
- **Mobile bar "Card" button:** it did nothing while the breakdown was closed.
  It now opens the breakdown and downloads.
- **Invisible bar score:** the bar's score used `text-base`, which in this
  project also sets the *base background colour*, so the number was invisible.
  All calculator `text-base` uses are now `text-[16px]`.
- **Shared links:** they no longer mark a result as present before one exists.

### Shared copy
- `lib/tool/scoreSubmission.ts`: a missing field now says "Bodyweight is
  required." instead of "…is required for a ranked result." Results are
  private by default. The code, field and retry flag are unchanged.

## Verification

**Local**
- `npm test`: **446/446** (437 existing + 9 in `tests/group5Polish.test.ts`).
- `tests/group4Consent.test.ts`: the Reset check now looks for `resetForm`
  instead of exact whitespace; the same behaviour is asserted.
- `tsc` clean. ESLint clean on every changed file; the old `ArchetypeIcon`
  warning is gone with the dead code.
- `next build` succeeds, with staging values injected.

**Browser (headless Chrome, local dev server)**
- `/api/score` was **intercepted and answered in the browser**, so nothing was
  written.
- 54 checks, all passing, in each of: 1440×900, 1280×720 and 390×844 with full
  motion; 1440×900 and 390×844 with reduced motion; and 375×667 with full motion.
  (375×667 was also run with reduced motion in an earlier pass.)

  The checks cover:
  - first-viewport placement of the inputs and Continue;
  - labels;
  - inline errors, their focus and clearing;
  - Enter to continue, and focus on step change;
  - the heading staying below the sticky header;
  - time formatting and range;
  - the unticked default and private copy;
  - the pending state, and one request despite a double click;
  - result focus and visibility;
  - the explainer disclosure;
  - stale detection on ticking;
  - the public placement line;
  - the breakdown;
  - a server field error returning to its step;
  - a general server error keeping the inputs;
  - Reset unticking;
  - no history entries, no horizontal scroll, no console errors.
- Screenshots were reviewed at laptop and phone sizes.

**Staging preview (13/13)**
- `/`, `/tool`, `/rankings` and `/methodology` return 200.
- The review route reports "Server configuration error." (no OpenAI).
- **The deployed bundle** has the Group 5 UI, the opt-in checkbox and the
  private default. It has no PostHog key, Supabase refs, service-role or JWT
  strings.
- `/rankings` = 11 rows = a service-role read of staging's eligible rows.
- **One idempotent replay** of the existing G4 private submission returned the
  stored row (`res_7ayz9aw1k7ahakbqyaz59e58`), private with no placement. No new
  rows.

**Time estimates removed.** "Free, about a minute" is gone from the homepage
at every size. The desktop privacy line now reads "Your result stays private
unless you choose to add it to the public leaderboard." The calculator intro
now reads "Your result is private unless you choose to publish it." No other
tagline or time estimate replaces them. `tests/group5Polish.test.ts` asserts
that neither page says "about a minute".

**Final mobile hero (browser, 37/37 locally and 37/37 on the deployed preview)**

Checked at scroll position 0 on 402×874, 390×844 and 375×667:

| Size | Headline | Body | CTA (full width) | Photo | Hero bottom | Next-section text starts |
|---|---|---|---|---|---|---|
| 402×874 | 157–225 | 245–317 | 341–389 | 448–850 | 874 | 938 |
| 390×844 | 148–216 | 236–308 | 332–380 | 430–820 | 844 | 908 |
| 375×667 | 122–190 | 210–282 | 306–354 | 378–690 | 714 (grows; scrolls) | 778 |

- **Every size:** no horizontal overflow, and the hero CTA opens `/tool`.
- **Desktop 1440×900:** unchanged. The CTA and "See how it works" are
  visible, and the measurements are identical to before.
- **Screenshots:** inspected directly. Both athletes are fully in frame at
  402 and 390 (only the outer edge of the left plate is cropped), and at 375.
  An earlier attempt without the square cap cropped the runner to an arm at
  402 and 390; it was rejected on inspection.
- **Build and tests:** `npm test` 447/447, `tsc` and lint clean, and
  `next build` succeeds.
- **Preview checks:** 13/13, no new rows.

## Not verified here
- **Real devices:** real phones (iOS Safari, Android Chrome) and trackpad
  scrolling.
- **Real use:** the deployed preview's interactive flow in a signed-in browser.
  The local mocked flow ran the same code.
- **Assistive tech:** a real screen reader.
- **Text size:** OS-level larger text sizes. The layouts use minimum heights
  only, but this wasn't checked visually.

## Left as is (outside this group or needing a decision)
- `/rankings` still uses lime on its glow and tier dots.
- The homepage Athlete Review excerpt has a lime rule.
- `AthleteReviewCTA`'s copy and lime button.
- The downloadable athlete card.
