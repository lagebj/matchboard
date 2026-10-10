import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3TodayCandidates, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";

/**
 * A09-S2 (`02_SCENARIOS_AND_FIXTURES.md`): actor/group denied. Erik is otherwise available, but
 * the fixture's `actorPermission` fact is `DENIED` — a fact read directly from the fixture, never
 * computed by a local permission algorithm.
 */
export const erik = matchW3TodayCandidates.erik;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S2",
  fixtureId: "gate-a-w3-a09-add-player-denied",
  fixtureVersion: 1,
  fixtureSha256: "7c03469d5cc82edf950aad8016eaab218229419aa1724bb6cc6e20614ceb3924",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { erik };
