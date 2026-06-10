---
name: strendex-code-review
description: Reviews a proposed Strendex code change or git diff against architecture, security, scope, and brand rules. Use when reviewing a diff or PR, or before committing changes.
---
# Strendex Code Review

Review the change against the lists below. Report issues by severity (Blocker / Warning / Nit) and propose the smallest fix for each. Do not rewrite large sections.

## Architecture
- Scoring math appears only in lib/scoring.ts; both /api/submit and /api/rank import it. Flag any duplicated or inlined scoring logic.
- Server routes recalculate the canonical score from raw inputs. Flag any path that trusts a client-sent score.
- Weights are kg internally; lb is converted before scoring.
- Hybrid Score = 50% strength + 50% endurance percentile.
- Leaderboard reads filter status = approved. Score >= 95 is saved as pending.

## Security
- No secrets, keys, or service-role tokens in client code or committed to the repo.
- Supabase RLS is not bypassed; writes go through API routes.
- User inputs are range-checked server-side.

## Scope & quality
- Diff is minimal: only files the task needs were changed. Flag unrelated edits or broad rewrites.
- TypeScript types are correct. No leftover console logs or debug code.

## Output
List Blockers first. If there are none, say so plainly.
