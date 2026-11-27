import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type {
  E02Event,
  E02EventDayFixture,
  E02EventSquad,
  E02LiveSessionRecord,
} from "../shared/event-day-fixture-types";
import { eventMatch, osloOn } from "../shared/fixture-builders";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-COMPLETED`. The evening after the Event
 * day (18:00 Europe/Oslo). The Event is FINALIZED; every one of its six matches has a recorded
 * result, but NOT every report is LOCKED — the 12:40 Blå match is REPORTED (a legacy completed
 * state, ADR-0001/ADR-0003). This is the case that proves Event finalisation is never read as
 * "every report is completed", and that a past kickoff is never read as a result.
 *
 * - 09:00 Blå vs Nordbyen FK — LOCKED 3–1
 * - 09:00 Rød vs Kvisten IL — LOCKED 2–2
 * - 10:20 Blå vs Bakkely IF — LOCKED 0–2
 * - 10:20 Rød vs Nordbyen FK — LOCKED 4–0 (same opponent as 09:00, other squad)
 * - 12:40 Blå vs Sjøvik SK — REPORTED 1–1 (not locked)
 * - 12:40 Rød vs Bakkely IF — LOCKED 1–3 (same opponent as 10:20, other squad)
 */
const DAY = "2027-03-13";
export const now = osloOn(DAY, "18:00");

export const event: E02Event = {
  id: "gate-e-w2-e02-completed-event",
  name: "Fjellsiden Vårcup",
  eventType: "TOURNAMENT",
  gameFormat: "SEVEN_A_SIDE",
  startsAt: osloOn(DAY, "09:00"),
  endsAt: osloOn(DAY, "16:00"),
  status: "FINALIZED",
  finalizedAt: osloOn(DAY, "17:10"),
};

export const squads: E02EventSquad[] = [
  { id: "gate-e-w2-e02-completed-squad-bla", eventId: event.id, name: "Fjellsiden Blå" },
  { id: "gate-e-w2-e02-completed-squad-rod", eventId: event.id, name: "Fjellsiden Rød" },
];
const [BLA, ROD] = squads.map((s) => s.id);

export const liveSessions: E02LiveSessionRecord[] = [];

const m = (input: Omit<Parameters<typeof eventMatch>[0], "eventId">) => eventMatch({ ...input, eventId: event.id }, liveSessions);

export const matches = [
  m({ id: "gate-e-w2-e02-completed-m01", eventSquadId: BLA, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "09:00"), report: { status: "LOCKED", ourScore: 3, opponentScore: 1 } }),
  m({ id: "gate-e-w2-e02-completed-m02", eventSquadId: ROD, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "09:00"), report: { status: "LOCKED", ourScore: 2, opponentScore: 2 } }),
  m({ id: "gate-e-w2-e02-completed-m03", eventSquadId: BLA, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "10:20"), report: { status: "LOCKED", ourScore: 0, opponentScore: 2 } }),
  m({ id: "gate-e-w2-e02-completed-m04", eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "10:20"), report: { status: "LOCKED", ourScore: 4, opponentScore: 0 } }),
  m({ id: "gate-e-w2-e02-completed-m05", eventSquadId: BLA, opponentName: "Sjøvik SK", startsAt: osloOn(DAY, "12:40"), report: { status: "REPORTED", ourScore: 1, opponentScore: 1 } }),
  m({ id: "gate-e-w2-e02-completed-m06", eventSquadId: ROD, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "12:40"), report: { status: "LOCKED", ourScore: 1, opponentScore: 3 } }),
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-COMPLETED", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-COMPLETED",
  fixtureId: "gate-e-w2-e02-completed",
  fixtureVersion: 1,
  fixtureSha256: "008d06ca5797b519b769c21e166605d10b48cef736b42741ca5c52851d8181f9",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
