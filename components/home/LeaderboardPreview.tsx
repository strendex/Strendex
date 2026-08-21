"use client";

/**
 * Section 6 — ranking, deliberately the smallest section on the page.
 *
 * Strendex is not primarily a leaderboard product, so this gets four rows and
 * two sentences. Standings are illustrative placeholders from ./demo-data; the
 * real leaderboard lives at /rankings and is served from approved rows only.
 * Nothing here reads or writes that data, claims verification, or implies a
 * user count.
 */

import Band from "./Band";
import CtaButton from "./CtaButton";
import { DEMO_LEADERBOARD } from "./demo-data";
import { Reveal } from "./motion";

export default function LeaderboardPreview() {
  return (
    <Band tone="band" className="py-[clamp(48px,6vw,88px)]">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-center lg:gap-24">
        <Reveal>
          <div className="max-w-[34rem]">
            <h2 className="text-balance text-[clamp(23px,2.4vw,30px)] font-semibold leading-[1.2] tracking-[-0.02em] text-ink">
              See how your result compares.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.65] text-lead">
              Opt into the public leaderboard to compare your result with other
              submitted athletes. Entries are self-reported, and joining is
              optional.
            </p>
            <div className="mt-7">
              <CtaButton href="/rankings" tone="secondary">
                View rankings
              </CtaButton>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ul>
            {DEMO_LEADERBOARD.map((row) => {
              const isYou = "isYou" in row && row.isYou;
              return (
                <li
                  key={row.rank}
                  className="flex items-center gap-4 border-t border-white/[0.07] py-3"
                >
                  <span className="w-5 shrink-0 text-[13px] tabular-nums text-subtle">
                    {row.rank}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[14px] ${
                      isYou ? "font-semibold text-ink" : "text-lead"
                    }`}
                  >
                    {row.handle}
                  </span>
                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">
                    {row.score}
                  </span>
                </li>
              );
            })}
            <li className="border-t border-white/[0.07] pt-4 text-[12px] text-subtle">
              Illustrative standings — not real athletes.
            </li>
          </ul>
        </Reveal>
      </div>
    </Band>
  );
}
