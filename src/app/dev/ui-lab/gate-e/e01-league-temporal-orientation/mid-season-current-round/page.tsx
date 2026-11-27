import { Suspense } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { LeagueFixtureMount } from "@/app/dev/ui-lab/gate-e/shared/league-fixture-mount";
import { periods, now } from "./fixtures";

/**
 * Gate E W1 — E01, mid-season state (current round + full past/future rail + period switching).
 *
 * UI Lab chrome (back link, appearance control, scenario label) is kept at a comfortable reading
 * width, deliberately separate from the actual League product surface below it, which uses the
 * same `max-w-[96rem]` content container the real app shell uses
 * (`src/app/(app)/layout.tsx`) — not an artificially narrower column (E01-R2 remediation).
 */
export default function E01MidSeasonCurrentRoundPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-2 px-4 pt-8">
        <Link href="/dev/ui-lab/gate-e/e01-league-temporal-orientation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; E01
        </Link>
        <AppearanceControl />
      </div>
      <h2 className="mx-auto mb-4 max-w-[720px] px-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        E01 &middot; Mid-season state
      </h2>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>}>
        <div className="mx-auto w-full max-w-[96rem] px-4 pb-8 sm:px-6">
          <LeagueFixtureMount periods={periods} now={now} />
        </div>
      </Suspense>
    </div>
  );
}
