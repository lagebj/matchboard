import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_UNFILLED_SLOT } from "../../shared/match-w3-fixture";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import type { LineupEditorCandidate, LineupAssignmentSuccess } from "../shared/lineup-slot-editor";

/** A07-S3 (`02_SCENARIOS_AND_FIXTURES.md`): server permission denied — retain drafted target, show specific denial, no mutation. */
export const identity: FixtureIdentity = {
  scenarioId: "A07-S3",
  fixtureId: "gate-a-w3-a07-assign-reserve-denied",
  fixtureVersion: 1,
  fixtureSha256: "f5ab280c18337fad5b448e21d83eab8a33281effcd0d2a20056f3b67ea74863c",
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
  kind: "PERMISSION_DENIED",
  reason: "You do not have lineup edit access for this team's planning group.",
};

export const rawRecordsForHash = { slotLabel, candidate, predeclaredOutcome };
