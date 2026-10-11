import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_ID, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT } from "../../shared/match-w3-fixture";

/**
 * A03-S1 `open-decision` (bundle `02_SCENARIOS_AND_FIXTURES.md` A03-S1): `planning_open`, an
 * unfilled match squad/position decision, named affected player/match, canonical-looking source
 * reason as a fixture assertion. Reuses the SAME real gap A07 edits (Tobias/RCM), not a second
 * invented one.
 */
export const PENDING_STARTER_NAME = "Tobias";
export const UNFILLED_SLOT_LABEL = MATCH_W3_UNFILLED_SLOT;

export const situationSourceId = "src-a03-s1-situation";
export const reasonSourceId = "src-a03-s1-reason";

export const situationText = `${PENDING_STARTER_NAME} is a confirmed starter without a locked tactical slot. ${UNFILLED_SLOT_LABEL} is this formation's only unfilled position.`;
export const consequenceText = `${PENDING_STARTER_NAME} would be placed at ${UNFILLED_SLOT_LABEL}, completing the starting 7. This is a design illustration — see A07 for the full edit-lineup interaction.`;
export const reasonText = `${PENDING_STARTER_NAME} is the only starter without a locked tactical slot; ${UNFILLED_SLOT_LABEL} is this formation's only unfilled position.`;

/** The exact raw records `identity.fixtureSha256` is a hash of — tests recompute, never copy this back. */
export const rawRecordsForHash = {
  matchId: MATCH_W3_ID,
  pendingStarterPlayerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  unfilledSlot: UNFILLED_SLOT_LABEL,
  situationText,
  consequenceText,
  reasonText,
};

export const identity: FixtureIdentity = {
  scenarioId: "A03-S1",
  fixtureId: "gate-a-w3-a03-open-decision",
  fixtureVersion: 1,
  fixtureSha256: "15db7c4ca2f8cd676e59ab174b3bb8a18929e9c6241677376fa4b4efabf4c671",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};
