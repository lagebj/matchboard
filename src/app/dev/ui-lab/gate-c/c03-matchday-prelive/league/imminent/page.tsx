import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCTodayMount } from "../../../shared/today-mount";
import { MatchdayNav } from "../../../shared/matchday-nav";
import { commandCentre, liveNow, matchdayContext } from "./fixtures";

/**
 * Gate C W1 — C03, League · Imminent. A plain server component (matching the real production
 * `today/page.tsx`'s own shape — see `shared/today-mount.tsx`'s own doc comment) that mounts the
 * real, unmodified production `TodaySurface`/`TodayMatchday` against a fixture whose kickoff
 * genuinely crosses `resolveTodayMatchdayPhase()`'s own IMMINENT threshold. See
 * `docs/ui-lab/gate-c-w1-candidates/` for the full review record.
 */
export default function C03LeagueImminentPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C03 &middot; League &middot; Imminent
      </h1>
      <div className="mb-4">
        <MatchdayNav active="league-imminent" />
      </div>
      <GateCTodayMount commandCentre={commandCentre} liveNow={liveNow} matchdayContext={matchdayContext} />
    </div>
  );
}
