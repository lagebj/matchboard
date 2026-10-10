import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_NOW_PLANNING_CLOSED, MATCH_W3_UNFILLED_SLOT } from "../../shared/match-w3-fixture";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import type { LineupEditorCandidate, LineupAssignmentSuccess } from "../shared/lineup-slot-editor";

/**
 * A07-S5 (`02_SCENARIOS_AND_FIXTURES.md`): `planning_closed` after opening — predeclared
 * authoritative refusal; no save; preserve proposed draft for inspection/discard; no fake
 * `Force save`. Narrative: the coach had this editor open from before kickoff; the boundary has
 * since closed (`MATCH_W3_NOW_PLANNING_CLOSED` is 5 minutes after the fixed kickoff).
 */
export const identity: FixtureIdentity = {
  scenarioId: "A07-S5",
  fixtureId: "gate-a-w3-a07-planning-closed-after-opening",
  fixtureVersion: 1,
  fixtureSha256: "8607887857860874e232bd70fd552bf9aa86db493591cf21bcdd736f0e1f6f1d",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_CLOSED.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;

export const candidate: LineupEditorCandidate = {
  playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  displayName: "Tobias",
  shirtNumber: 12,
  reasons: ["Already in the matchday squad", "Eligible for RCM — central midfield"],
};

export const predeclaredOutcome: FixtureOperationOutcome<LineupAssignmentSuccess> = {
  kind: "PLANNING_CLOSED",
  reason: "Planning closed when the match kicked off. Only a genuine reschedule before the actual start can reopen it.",
};

export const rawRecordsForHash = { slotLabel, candidate, predeclaredOutcome };
