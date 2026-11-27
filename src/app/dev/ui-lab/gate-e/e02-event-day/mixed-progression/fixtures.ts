import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type {
  E02Event,
  E02EventDayFixture,
  E02EventSquad,
  E02LiveSessionRecord,
} from "../shared/event-day-fixture-types";
import { eventMatch, osloOn } from "../shared/fixture-builders";

/**
 * Gate E register E02 — child candidate `GATE-E-W2-E02-MIXED` (primary multi-match acceptance
 * case). One Event, two participating squads, nine matches in every lifecycle the Event-day
 * contract distinguishes, observed at 11:30 Europe/Oslo:
 *
 * - 09:00 Blå vs Nordbyen FK — LOCKED 3–1 (result, report completed)
 * - 09:00 Rød vs Kvisten IL — LOCKED 2–2 (simultaneous with the match above)
 * - 09:40 Rød vs Sjøvik SK — CANCELLED before kickoff, with its recorded reason
 * - 10:20 Blå vs Bakkely IF — kicked off, no report (report missing)
 * - 10:20 Rød vs Nordbyen FK — DRAFT report with a draft score (never shown as final)
 * - 11:20 Blå vs Kvisten IL — LIVE (canonical ACTIVE session, first half running)
 * - 12:40 Blå vs Sjøvik SK — upcoming, NEXT
 * - 12:40 Rød vs Bakkely IF — upcoming, NEXT (simultaneous)
 * - 14:00 Rød vs Nordbyen FK — upcoming, LATER (same squad AND opponent as 10:20, distinct id)
 *
 * "Nordbyen FK" is the opponent of three matches across both squads; identity is always the
 * match id plus its `eventSquadId`, never the opponent string.
 */
const DAY = "2027-03-13";
export const now = osloOn(DAY, "11:30");

export const event: E02Event = {
  id: "gate-e-w2-e02-mixed-event",
  name: "Fjellsiden Vårcup",
  eventType: "TOURNAMENT",
  gameFormat: "SEVEN_A_SIDE",
  startsAt: osloOn(DAY, "09:00"),
  endsAt: osloOn(DAY, "16:00"),
  status: "DRAFT",
  finalizedAt: null,
};

export const squads: E02EventSquad[] = [
  { id: "gate-e-w2-e02-mixed-squad-bla", eventId: event.id, name: "Fjellsiden Blå" },
  { id: "gate-e-w2-e02-mixed-squad-rod", eventId: event.id, name: "Fjellsiden Rød" },
];
const [BLA, ROD] = squads.map((s) => s.id);

export const liveSessions: E02LiveSessionRecord[] = [
  { eventMatchId: "gate-e-w2-e02-mixed-m06", status: "ACTIVE", clockPeriod: "FIRST_HALF", clockRunning: true },
];

const m = (input: Omit<Parameters<typeof eventMatch>[0], "eventId">) => eventMatch({ ...input, eventId: event.id }, liveSessions);

export const matches = [
  m({ id: "gate-e-w2-e02-mixed-m01", eventSquadId: BLA, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "09:00"), report: { status: "LOCKED", ourScore: 3, opponentScore: 1 } }),
  m({ id: "gate-e-w2-e02-mixed-m02", eventSquadId: ROD, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "09:00"), report: { status: "LOCKED", ourScore: 2, opponentScore: 2 } }),
  m({
    id: "gate-e-w2-e02-mixed-m03",
    eventSquadId: ROD,
    opponentName: "Sjøvik SK",
    startsAt: osloOn(DAY, "09:40"),
    cancelled: { at: osloOn(DAY, "08:15"), reason: "Sjøvik SK withdrew before kickoff" },
  }),
  m({ id: "gate-e-w2-e02-mixed-m04", eventSquadId: BLA, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "10:20") }),
  m({ id: "gate-e-w2-e02-mixed-m05", eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "10:20"), report: { status: "DRAFT", ourScore: 1, opponentScore: 0 } }),
  m({ id: "gate-e-w2-e02-mixed-m06", eventSquadId: BLA, opponentName: "Kvisten IL", startsAt: osloOn(DAY, "11:20") }),
  m({ id: "gate-e-w2-e02-mixed-m07", eventSquadId: BLA, opponentName: "Sjøvik SK", startsAt: osloOn(DAY, "12:40") }),
  m({ id: "gate-e-w2-e02-mixed-m08", eventSquadId: ROD, opponentName: "Bakkely IF", startsAt: osloOn(DAY, "12:40") }),
  m({ id: "gate-e-w2-e02-mixed-m09", eventSquadId: ROD, opponentName: "Nordbyen FK", startsAt: osloOn(DAY, "14:00") }),
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-E-W2-E02-MIXED", now, event, squads, matches, liveSessions };

export const identity: FixtureIdentity = {
  scenarioId: "GATE-E-W2-E02-MIXED",
  fixtureId: "gate-e-w2-e02-mixed-progression",
  fixtureVersion: 1,
  fixtureSha256: "8b9b7bb941a97cf6298d29fb16355b9d6239f9b7d34a38d211a872b7daac3326",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: now.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const fixture: E02EventDayFixture = { identity, now, event, squads, matches, liveSessions };
