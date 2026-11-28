import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { E02Event, E02EventDayFixture, E02LiveSessionRecord } from "../shared/event-day-fixture-types";
import { osloOn } from "../shared/fixture-builders";
import { baseEvent, DAY, matchesAsRecorded, matchId, squads } from "../shared/event-day-schedule";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-MIXED` (primary multi-match acceptance
 * case). The shared Event-day schedule observed at 11:30 Europe/Oslo:
 *
 * - 09:00 Blå vs Nordbyen FK — LOCKED 3–1
 * - 09:00 Rød vs Kvisten IL — LOCKED 2–2 (simultaneous)
 * - 09:40 Rød vs Sjøvik SK — CANCELLED at 08:15, with its recorded reason
 * - 10:20 Blå vs Bakkely IF — kicked off, no report (report missing)
 * - 10:20 Rød vs Nordbyen FK — DRAFT report with a draft score (never displayed)
 * - 11:20 Blå vs Kvisten IL — LIVE (canonical ACTIVE session, first half running) — the
 *   continuity match: scheduled in UPCOMING, completed in COMPLETED
 * - 12:40 Blå vs Sjøvik SK and 12:40 Rød vs Bakkely IF — both NEXT
 * - 14:00 Rød vs Nordbyen FK — LATER (same squad AND opponent as 10:20, distinct match)
 */
export const now = osloOn(DAY, "11:30");

export const event: E02Event = { ...baseEvent, status: "DRAFT", finalizedAt: null };
export { squads };

export const liveSessions: E02LiveSessionRecord[] = [
  { eventMatchId: matchId("m06"), status: "ACTIVE", clockPeriod: "FIRST_HALF", clockRunning: true },
];

export const matches = matchesAsRecorded(
  {
    [matchId("m01")]: { report: { status: "LOCKED", ourScore: 3, opponentScore: 1 } },
    [matchId("m02")]: { report: { status: "LOCKED", ourScore: 2, opponentScore: 2 } },
    [matchId("m03")]: { cancelled: { at: osloOn(DAY, "08:15"), reason: "Sjøvik SK withdrew before kickoff" } },
    [matchId("m05")]: { report: { status: "DRAFT", ourScore: 1, opponentScore: 0 } },
  },
  liveSessions,
);

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-MIXED", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-MIXED",
  fixtureId: "gate-e-w2-e02-mixed-progression",
  fixtureVersion: 2,
  fixtureSha256: "170bef84703db1e6556cee5655bdc21639977062b9c9d222c9ddb3a11a5d56dd",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
