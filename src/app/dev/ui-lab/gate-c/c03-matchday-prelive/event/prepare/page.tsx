import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCTodayMount } from "../../../shared/today-mount";
import { MatchdayNav } from "../../../shared/matchday-nav";
import { commandCentre, liveNow, matchdayContext, nowIso, squadStatus } from "./fixtures";

/**
 * Gate C W1 — C03, Event · Prepare. A plain server component (matching the real production
 * `today/page.tsx`'s own shape — see `shared/today-mount.tsx`'s own doc comment) that mounts the
 * real, unmodified production `TodaySurface`/`TodayMatchday` against a fixture whose kickoff
 * genuinely crosses `resolveTodayMatchdayPhase()`'s own PREPARE threshold, for an Event match
 * (no venue, no invented tactics readiness — D3.14 "if an Event concept does not exist, omit
 * that readiness fact rather than fabricating parity"). See `docs/ui-lab/gate-c-w1-candidates/`
 * for the full review record.
 */
export default function C03EventPreparePage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C03 &middot; Event &middot; Prepare
      </h1>
      <div className="mb-4">
        <MatchdayNav active="event-prepare" />
      </div>
      <GateCTodayMount commandCentre={commandCentre} liveNow={liveNow} matchdayContext={matchdayContext} nowIso={nowIso} squadStatus={squadStatus} />
    </div>
  );
}
