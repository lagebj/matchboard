import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3TodayCandidates, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";

/**
 * A09-S1 (`02_SCENARIOS_AND_FIXTURES.md`): a permitted candidate under an explicit synthetic
 * canonical-response fixture. Felix has accepted availability and is not yet in the planned
 * squad — the predeclared outcome is `SUCCESS`, never computed from a local eligibility check.
 */
export const felix = matchW3TodayCandidates.felix;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S1",
  fixtureId: "gate-a-w3-a09-add-eligible-player-success",
  fixtureVersion: 1,
  fixtureSha256: "8e5cc46384dc245e9c276000efb601a1664aaad5775df0a57432eb709096e27e",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { felix };
