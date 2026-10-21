import type { FixtureIdentity } from "../../../../gate-a/shared/fixture-identity";
import {
  b06EventBeforeIdentity,
  b06EventParticipants,
  B06_EVENT_NAME,
  B06_EVENT_SQUAD_NAME,
  B06_EVENT_OPPONENT_NAME,
  B06_EVENT_NOW,
} from "../../../shared/match-b-fixture";

/**
 * B06 Event · Before — planned, ready (lineup set). Unlike League, Event has no dedicated
 * Match Details route: lineup planning happens inline on Event Detail's Matches tab
 * (`EventMatchLineupPanel`, `src/app/(app)/events/[eventId]/event-match-lineup-panel.tsx`), which
 * self-fetches via server actions and is not fixture-injectable (same documented gap League's own
 * `MatchTacticsPanel` has in B01). This candidate reuses the REAL production projection
 * (`buildPlanningPitchAssignments`) that panel calls, fed by this fixture's own participant list,
 * rather than copying the whole 543-line panel — see CURRENT_STATE_AUDIT.md.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B06-EVENT-BEFORE",
  fixtureId: "gate-b-w3-b06-event-before",
  fixtureVersion: 1,
  fixtureSha256: "efa47661e4074854e8bdd82066e336ccd8565949a01fa14941082fa58a5c63f6",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B06_EVENT_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b06EventBeforeIdentity;
export const participants = b06EventParticipants;
export const eventName = B06_EVENT_NAME;
export const eventSquadName = B06_EVENT_SQUAD_NAME;
export const opponentName = B06_EVENT_OPPONENT_NAME;

export const rawRecordsForHash = { matchIdentity, participants };
