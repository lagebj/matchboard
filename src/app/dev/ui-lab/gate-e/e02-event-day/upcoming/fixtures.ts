import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { E02Event, E02EventDayFixture, E02LiveSessionRecord } from "../shared/event-day-fixture-types";
import { osloOn } from "../shared/fixture-builders";
import { baseEvent, DAY, matchesAsRecorded, squads } from "../shared/event-day-schedule";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-UPCOMING`. The shared Event-day schedule
 * (`shared/event-day-schedule.ts`) observed at 08:00 Europe/Oslo, before any kickoff and before
 * the 09:40 match was cancelled: nine scheduled matches, no reports, no live session, no scores.
 * NEXT = both 09:00 matches (one per squad).
 */
export const now = osloOn(DAY, "08:00");

export const event: E02Event = { ...baseEvent, status: "DRAFT", finalizedAt: null };
export { squads };

export const liveSessions: E02LiveSessionRecord[] = [];

export const matches = matchesAsRecorded({}, liveSessions);

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-UPCOMING", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-UPCOMING",
  fixtureId: "gate-e-w2-e02-upcoming",
  fixtureVersion: 2,
  fixtureSha256: "11a8e5739501cd37d634a0d2cd819932d023ecf2e4e3f01686ab48b990aa9048",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
