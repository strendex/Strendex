# Strendex — Project Memory

## What this is
Hybrid-athlete benchmarking. Inputs: bodyweight, bench, squat, deadlift, 5K time.
Output: Hybrid Score (0-100), strength + endurance percentiles, tier, archetype, leaderboard placement.

## Stack
Next.js (App Router) + TypeScript, Tailwind, Supabase, Vercel, GitHub.

## Hard rules (never break)
- All scoring lives in lib/scoring.ts. Both /api/submit and /api/rank import it. Never duplicate or inline scoring math.
- Weights are kilograms internally. Convert lb to kg before scoring.
- Hybrid Score = 50% strength percentile + 50% endurance percentile.
- Never trust a score sent from the browser. Server routes recalculate the canonical score from raw inputs.
- Public leaderboard shows only rows where status = approved.
- Hybrid Score >= 95 is saved as status = pending for manual review.
- No medical claims. No fake precision. The dataset is currently simulated - never imply real users exist.

## Brand / UI
- Background base #0E1014; surface #16191F; elevated #21252D.
- Text primary #F5F7FA; secondary #A0A6B0. Hairline borders rgba(255,255,255,0.09).
- Accent lime #DFFF00 used sparingly: primary CTA and the score number only. No other accent colors anywhere, including the leaderboard.
- 8px spacing scale. Mobile-first. Restrained WHOOP / Apple Fitness / Strava feel: lots of negative space.

## Naming
- The metric is "Hybrid Score" in all user-facing text. Do not use "HQ Score" or "Hybrid Quotient".

## Workflow (always)
- Never edit main directly. Branch -> change -> push -> Vercel preview -> verify on mobile AND laptop -> merge -> verify live.
- Keep changes minimal and reversible. No broad rewrites. Touch only files the task needs.
- Before editing, output a plan and wait for approval.
- Never report a task done without verification. "It should work" is not "I saw it work."
