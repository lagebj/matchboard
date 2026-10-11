import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_UNFILLED_SLOT } from "../../shared/match-w3-fixture";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import type { LineupEditorCandidate, LineupAssignmentSuccess } from "../shared/lineup-slot-editor";

/**
 * A07-S6 (`02_SCENARIOS_AND_FIXTURES.md`): editor dismissed with a dirty draft — a deliberate
 * discard/continue dialog; Escape and browser Back must not silently drop pending edits. This
 * scenario exercises the close guard, not the save flow — the predeclared outcome below exists
 * only so Confirm is a real, functioning control if exercised, never so this page needs to reach it.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A07-S6",
  fixtureId: "gate-a-w3-a07-dirty-draft-close",
  fixtureVersion: 1,
  fixtureSha256: "302d78e2bb0aa7867eb9f3d9e92682b6eb6a40bc43755ccbf25c686625763e0b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
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
  kind: "SUCCESS",
  revision: "lineup-rev-2-assigned",
  result: { assignedPlayerId: MATCH_W3_PENDING_STARTER_PLAYER_ID, slotLabel },
};

export const rawRecordsForHash = { slotLabel, candidate, predeclaredOutcome };
