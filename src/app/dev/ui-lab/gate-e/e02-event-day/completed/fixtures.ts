import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { E02Event, E02EventDayFixture, E02LiveSessionRecord } from "../shared/event-day-fixture-types";
import { osloOn } from "../shared/fixture-builders";
import { baseEvent, DAY, matchesAsRecorded, matchId, squads } from "../shared/event-day-schedule";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-COMPLETED`. The shared Event-day schedule
 * observed at 18:00 Europe/Oslo. The Event is FINALIZED (17:10). Eight matches have recorded
 * results, the 09:40 match stays cancelled, and NOT every report is LOCKED — 12:40 Blå vs Sjøvik
 * SK is REPORTED (a completed result, ADR-0001/0003, but not locked). Event finalisation is never
 * read as "every report is completed".
 *
 * The 10:20 Rød match's final LOCKED score (2–0) differs from its 11:30 DRAFT value (1–0) — a
 * draft is not a result. The 11:20 continuity match (LIVE at 11:30) is now LOCKED 2–1, and its
 * live session has ENDED.
 */
export const now = osloOn(DAY, "18:00");

export const event: E02Event = { ...baseEvent, status: "FINALIZED", finalizedAt: osloOn(DAY, "17:10") };
export { squads };

export const liveSessions: E02LiveSessionRecord[] = [
  { eventMatchId: matchId("m06"), status: "ENDED", clockPeriod: "FULL_TIME", clockRunning: false },
];

export const matches = matchesAsRecorded(
  {
    [matchId("m01")]: { report: { status: "LOCKED", ourScore: 3, opponentScore: 1 } },
    [matchId("m02")]: { report: { status: "LOCKED", ourScore: 2, opponentScore: 2 } },
    [matchId("m03")]: { cancelled: { at: osloOn(DAY, "08:15"), reason: "Sjøvik SK withdrew before kickoff" } },
    [matchId("m04")]: { report: { status: "LOCKED", ourScore: 0, opponentScore: 2 } },
    [matchId("m05")]: { report: { status: "LOCKED", ourScore: 2, opponentScore: 0 } },
    [matchId("m06")]: { report: { status: "LOCKED", ourScore: 2, opponentScore: 1 } },
    [matchId("m07")]: { report: { status: "REPORTED", ourScore: 1, opponentScore: 1 } },
    [matchId("m08")]: { report: { status: "LOCKED", ourScore: 1, opponentScore: 3 } },
    [matchId("m09")]: { report: { status: "LOCKED", ourScore: 4, opponentScore: 0 } },
  },
  liveSessions,
);

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-COMPLETED", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-COMPLETED",
  fixtureId: "gate-e-w2-e02-completed",
  fixtureVersion: 2,
  fixtureSha256: "e2411bbe28ebcb66b4ebc6aaff76ad8ebc926401005ed3310e1a00f5dfa0a57f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
