import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3TodayCandidates, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_ROSTER_REVISION, MATCH_W3_ROSTER_REVISION_CONCURRENT } from "../../shared/match-w3-fixture";

/**
 * A09-S5 (`02_SCENARIOS_AND_FIXTURES.md`): stale revision — another coach already added this
 * candidate. A predeclared `CONFLICT` with explicit expected/current revisions, never an inferred
 * diff; no duplicate add, no auto-merge.
 */
export const felix = matchW3TodayCandidates.felix;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S5",
  fixtureId: "gate-a-w3-a09-add-player-conflict",
  fixtureVersion: 1,
  fixtureSha256: "8ffd97312e46b9123f25467d5153aab2ea2e487310f8279e53c2ad9f080109a6",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { felix, expectedRevision: MATCH_W3_ROSTER_REVISION, currentRevision: MATCH_W3_ROSTER_REVISION_CONCURRENT };
