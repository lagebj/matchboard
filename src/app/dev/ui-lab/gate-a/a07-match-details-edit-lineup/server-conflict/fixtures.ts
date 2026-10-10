import type { FixtureIdentity } from "../../shared/fixture-identity";
import {
  MATCH_W3_PENDING_STARTER_PLAYER_ID,
  MATCH_W3_NOW_PLANNING_OPEN,
  MATCH_W3_UNFILLED_SLOT,
  MATCH_W3_LINEUP_REVISION,
  MATCH_W3_LINEUP_REVISION_CONCURRENT,
} from "../../shared/match-w3-fixture";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import type { LineupEditorCandidate, LineupAssignmentSuccess } from "../shared/lineup-slot-editor";

/** A07-S4 (`02_SCENARIOS_AND_FIXTURES.md`): server stale/conflict — predeclared response with expected/current revision, never overwrite the latest server snapshot, preserve draft. */
export const identity: FixtureIdentity = {
  scenarioId: "A07-S4",
  fixtureId: "gate-a-w3-a07-server-conflict",
  fixtureVersion: 1,
  fixtureSha256: "3d0a8fc7cfc039dca53fc013be572eec08b5160d3b64b940a458a5c706427003",
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
  kind: "CONFLICT",
  expectedRevision: MATCH_W3_LINEUP_REVISION,
  currentRevision: MATCH_W3_LINEUP_REVISION_CONCURRENT,
  currentSummary: "Another coach already assigned Markus to RCM.",
};

export const rawRecordsForHash = { slotLabel, candidate, predeclaredOutcome };
