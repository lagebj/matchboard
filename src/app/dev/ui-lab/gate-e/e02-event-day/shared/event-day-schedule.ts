import type { E02Event, E02EventMatchRecord, E02EventSquad, E02LiveSessionRecord } from "./event-day-fixture-types";
import { eventMatch, osloOn } from "./fixture-builders";

/**
 * The ONE Event-day schedule all three E02 child candidates observe (XR-S01: "planned/live/
 * completed versions of one fixture remain recognizably the same object"). UPCOMING, MIXED and
 * COMPLETED are the same Event, the same two squads and the same nine matches — same ids, same
 * squads, same opponents, same kickoffs — seen at three different reference instants (08:00,
 * 11:30, 18:00 Europe/Oslo). Only the facts that are recorded over the day differ between the
 * fixtures: reports, the live session, the cancellation, and the Event's finalisation.
 *
 * The designated continuity match is 11:20 Fjellsiden Blå vs Kvisten IL
 * (`CONTINUITY_MATCH_ID`): scheduled (NEXT-eligible later match) at 08:00, LIVE at 11:30,
 * LOCKED result at 18:00. Every E02 capture run selects it in all three states.
 */
export const DAY = "2027-03-13";
export const EVENT_ID = "gate-e-w2-e02-event";

export const baseEvent: Omit<E02Event, "status" | "finalizedAt"> = {
  id: EVENT_ID,
  name: "Fjellsiden Vårcup",
  eventType: "TOURNAMENT",
  gameFormat: "SEVEN_A_SIDE",
  startsAt: osloOn(DAY, "09:00"),
  endsAt: osloOn(DAY, "16:00"),
};

export const squads: E02EventSquad[] = [
  { id: "gate-e-w2-e02-squad-bla", eventId: EVENT_ID, name: "Fjellsiden Blå" },
  { id: "gate-e-w2-e02-squad-rod", eventId: EVENT_ID, name: "Fjellsiden Rød" },
];
const [BLA, ROD] = squads.map((s) => s.id);

export const matchId = (n: string) => `gate-e-w2-e02-${n}`;
export const CONTINUITY_MATCH_ID = matchId("m06");

type ScheduledMatch = { id: string; eventSquadId: string; opponentName: string; startsAt: Date };

/** Fixed schedule facts — identical in every fixture. */
export const SCHEDULE: ScheduledMatch[] = [
  { id: matchId("m01"), eventSquadId: BLA, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "09:00") },
  { id: matchId("m02"), eventSquadId: ROD, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "09:00") },
  { id: matchId("m03"), eventSquadId: ROD, opponentName: "Sjøvik SK", startsAt: osloOn(DAY, "09:40") },
  { id: matchId("m04"), eventSquadId: BLA, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "10:20") },
  { id: matchId("m05"), eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "10:20") },
  { id: matchId("m06"), eventSquadId: BLA, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "11:20") },
  { id: matchId("m07"), eventSquadId: BLA, opponentName: "Sjøvik SK", startsAt: osloOn(DAY, "12:40") },
  { id: matchId("m08"), eventSquadId: ROD, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "12:40") },
  { id: matchId("m09"), eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "14:00") },
];

export type RecordedFacts = Partial<
  Record<
    string,
    {
      cancelled?: { at: Date; reason: string };
      report?: { status: "DRAFT" | "REPORTED" | "LOCKED"; ourScore: number | null; opponentScore: number | null };
    }
  >
>;

/** The schedule plus whatever was recorded by a fixture's reference instant. */
export function matchesAsRecorded(facts: RecordedFacts, liveSessions: E02LiveSessionRecord[]): E02EventMatchRecord[] {
  return SCHEDULE.map((s) => eventMatch({ ...s, eventId: EVENT_ID, ...(facts[s.id] ?? {}) }, liveSessions));
}
