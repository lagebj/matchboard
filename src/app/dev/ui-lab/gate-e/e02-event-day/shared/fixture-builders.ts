import { resolveLiveReportingPrimaryAction } from "@/lib/live-match/live-reporting-primary-action";
import { getEventPeriodConfig } from "@/lib/live-match/period-config";
import type { E02EventMatchRecord, E02LiveSessionRecord } from "./event-day-fixture-types";

/**
 * Fixture-only record builders for E02. Nothing here classifies a match — classification is the
 * projection's job (`event-day-projection.ts`). These helpers only assemble canonical
 * `EventMatchWithReport`-shaped records with explicit, non-defaulted facts.
 */

/** A wall-clock time on the fixture's event day, written with its explicit Europe/Oslo offset
 *  (CET, +01:00 — the event day is before the 28 March 2027 DST change). */
export function osloOn(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+01:00`);
}

/**
 * Derives `isLive`/`livePrimaryAction` from a canonical live-session record exactly the way
 * production's private `deriveEventLiveState()` (`src/lib/stats/event-match-stats.ts`) does for
 * a session with no frozen format snapshot: `isLive` only for an ACTIVE session, and the action
 * from the real, pure `resolveLiveReportingPrimaryAction()` over the real
 * `getEventPeriodConfig(null, 2, null)` two-half config (unknown durations, never faked zeros).
 * That function itself cannot be imported here — its module imports the server `db` client.
 */
export function deriveLiveFields(session: E02LiveSessionRecord | undefined): Pick<E02EventMatchRecord, "isLive" | "livePrimaryAction"> {
  if (!session || session.status !== "ACTIVE") return { isLive: false, livePrimaryAction: null };
  return {
    isLive: true,
    livePrimaryAction: resolveLiveReportingPrimaryAction({
      sessionStatus: "ACTIVE",
      clock: { period: session.clockPeriod, running: session.clockRunning },
      periodConfig: getEventPeriodConfig(null, 2, null),
    }),
  };
}

type MatchInput = {
  id: string;
  eventId: string;
  eventSquadId: string;
  opponentName: string;
  startsAt: Date;
  cancelled?: { at: Date; reason: string };
  report?: { status: "DRAFT" | "REPORTED" | "LOCKED"; ourScore: number | null; opponentScore: number | null };
};

export function eventMatch(input: MatchInput, liveSessions: E02LiveSessionRecord[]): E02EventMatchRecord {
  return {
    id: input.id,
    eventId: input.eventId,
    eventSquadId: input.eventSquadId,
    category: "CUP",
    opponentName: input.opponentName,
    // Unknown opponent identity stays unknown (neutral treatment, XR-S01) — never a fabricated
    // canonical OpponentTeam link.
    opponentTeamId: null,
    startsAt: input.startsAt,
    // No venue/pitch is recorded for any fixture match; none is invented.
    location: null,
    notes: null,
    status: input.cancelled ? "CANCELLED" : "SCHEDULED",
    cancelledAt: input.cancelled?.at ?? null,
    cancelledReason: input.cancelled?.reason ?? null,
    report: input.report
      ? {
          id: `${input.id}-report`,
          status: input.report.status,
          ourScore: input.report.ourScore,
          opponentScore: input.report.opponentScore,
        }
      : null,
    ...deriveLiveFields(liveSessions.find((s) => s.eventMatchId === input.id)),
  };
}
