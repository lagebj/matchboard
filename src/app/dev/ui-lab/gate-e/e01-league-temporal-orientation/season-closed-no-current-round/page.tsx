import { Suspense } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { LeagueFixtureMount } from "@/app/dev/ui-lab/gate-e/shared/league-fixture-mount";
import { periods, now } from "./fixtures";

/** Gate E W1 — E01, season-closed state: no current or future round exists anywhere. */
export default function E01SeasonClosedNoCurrentRoundPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-e/e01-league-temporal-orientation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; E01
        </Link>
        <AppearanceControl />
      </div>
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        E01 &middot; Season closed, no current round
      </h2>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>}>
        <LeagueFixtureMount periods={periods} now={now} />
      </Suspense>
    </div>
  );
}
