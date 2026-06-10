---
name: strendex-deploy-check
description: Walks the safe Strendex ship-and-verify workflow. Use when about to push, deploy, merge, or verify a change to Strendex.
---
# Strendex Deploy Check

Never edit main directly. Follow this order; stop for human verification at each VERIFY.

## Ship
1. Create a branch (never main). Make the minimal change.
2. Commit and push the branch.
3. VERIFY (Vercel): the branch preview deploy is green (Ready), not failed.
4. VERIFY (human): open the preview link on BOTH laptop and phone; confirm the change looks right and nothing else broke.
5. Only then merge the branch into main and push.
6. VERIFY (Vercel): main deploy is green.
7. VERIFY (human): load strendex.fit on laptop and phone.

## Data
- For any database check, use Supabase read-only first (table view or SELECT). Never run DELETE/DROP/UPDATE without an explicit, separate, confirmed instruction.

## Principle
Do not report done until a human confirms the VERIFY steps.
