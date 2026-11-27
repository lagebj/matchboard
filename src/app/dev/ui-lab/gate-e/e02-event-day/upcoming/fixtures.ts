import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type {
  E02Event,
  E02EventDayFixture,
  E02EventSquad,
  E02LiveSessionRecord,
} from "../shared/event-day-fixture-types";
import { eventMatch, osloOn } from "../shared/fixture-builders";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-UPCOMING`. The morning of the Event day
 * (08:15 Europe/Oslo), before any kickoff: one Event, two squads, six scheduled matches, no
 * reports, no live session, no scores anywhere.
 *
 * - 09:00 Blå vs Nordbyen FK — NEXT (the one genuine earliest upcoming match)
 * - 09:40 Rød vs Kvisten IL
 * - 10:20 Blå vs Kvisten IL — same opponent as 09:40, other squad
 * - 11:00 Rød vs Nordbyen FK — same opponent as 09:00, other squad
 * - 12:40 Blå vs Sjøvik SK
 * - 12:40 Rød vs Bakkely IF — simultaneous with the match above
 */
const DAY = "2027-03-13";
export const now = osloOn(DAY, "08:15");

export const event: E02Event = {
  id: "gate-e-w2-e02-upcoming-event",
  name: "Fjellsiden Vårcup",
  eventType: "TOURNAMENT",
  gameFormat: "SEVEN_A_SIDE",
  startsAt: osloOn(DAY, "09:00"),
  endsAt: osloOn(DAY, "16:00"),
  status: "DRAFT",
  finalizedAt: null,
};

export const squads: E02EventSquad[] = [
  { id: "gate-e-w2-e02-upcoming-squad-bla", eventId: event.id, name: "Fjellsiden Blå" },
  { id: "gate-e-w2-e02-upcoming-squad-rod", eventId: event.id, name: "Fjellsiden Rød" },
];
const [BLA, ROD] = squads.map((s) => s.id);

export const liveSessions: E02LiveSessionRecord[] = [];

const m = (input: Omit<Parameters<typeof eventMatch>[0], "eventId">) => eventMatch({ ...input, eventId: event.id }, liveSessions);

export const matches = [
  m({ id: "gate-e-w2-e02-upcoming-m01", eventSquadId: BLA, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "09:00") }),
  m({ id: "gate-e-w2-e02-upcoming-m02", eventSquadId: ROD, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "09:40") }),
  m({ id: "gate-e-w2-e02-upcoming-m03", eventSquadId: BLA, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "10:20") }),
  m({ id: "gate-e-w2-e02-upcoming-m04", eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "11:00") }),
  m({ id: "gate-e-w2-e02-upcoming-m05", eventSquadId: BLA, opponentName: "Sjøvik SK", startsAt: osloOn(DAY, "12:40") }),
  m({ id: "gate-e-w2-e02-upcoming-m06", eventSquadId: ROD, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "12:40") }),
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-UPCOMING", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-UPCOMING",
  fixtureId: "gate-e-w2-e02-upcoming",
  fixtureVersion: 1,
  fixtureSha256: "16b6eb1ab2cea06f0b6add453450e2c201b0ef90f06791c5cbe6678384961a8f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
