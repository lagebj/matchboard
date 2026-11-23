import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { PlayerMatchTimeline } from "@/components/touchline/player/player-match-timeline";
import { matches } from "./fixtures";

/**
 * Gate D W1 — D04, partial/unknown minute coverage. Mounts the real, unmodified
 * `PlayerMatchTimeline` against matches with three distinct not-recorded shapes (see
 * `./fixtures.ts`).
 */
export default function D04PartialCoveragePage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d04-matches-coverage" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D04
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D04 &middot; Partial / unknown coverage
      </h1>
      <PlayerMatchTimeline matches={matches} />
    </div>
  );
}
