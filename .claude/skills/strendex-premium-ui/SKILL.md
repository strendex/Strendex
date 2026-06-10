---
name: strendex-premium-ui
description: Enforces Strendex's premium dark visual style and mobile-first layout when creating or changing any UI, component, page, or Tailwind styling. Use for any visual, design, or CSS work.
---
# Strendex Premium UI

Apply whenever touching UI. The feel is restrained and premium (WHOOP / Apple Fitness / Strava). When in doubt, remove rather than add.

## Tokens (use these; never invent colors)
- Background base #0E1014; surface #16191F; elevated #21252D.
- Text primary #F5F7FA; secondary #A0A6B0. Borders: hairline rgba(255,255,255,0.09).
- Accent lime #DFFF00 only on the primary CTA and the score number. No emerald, green, blue, or violet theme colors anywhere, including the leaderboard.

## Layout
- Mobile-first: design the narrow view first, then scale up. Generous tap targets.
- 8px spacing scale. Large section gaps. Consistent horizontal padding aligned to content width on every page.
- No layout shift: reserve space for async content with skeletons, never a flashing "0".

## Rules
- Every page uses the same tokens so home, tool, and rankings look like one product.
- One clear H1 per page; restrained weights. No competing gradients or multiple glows.
