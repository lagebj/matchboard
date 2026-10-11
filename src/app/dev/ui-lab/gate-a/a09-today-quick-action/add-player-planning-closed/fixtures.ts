import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3TodayCandidates, MATCH_W3_NOW_PLANNING_CLOSED } from "../../shared/match-w3-fixture";

/**
 * A09-S4 (`02_SCENARIOS_AND_FIXTURES.md`): planning closed AFTER preview. Felix is still
 * genuinely eligible and selectable — the rejection must arise from the Confirm step, not a
 * disabled entry control, proving denial-after-preview rather than denial-at-entry (contrast
 * with A09-S2/S3).
 */
export const felix = matchW3TodayCandidates.felix;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S4",
  fixtureId: "gate-a-w3-a09-add-player-planning-closed",
  fixtureVersion: 1,
  fixtureSha256: "8e5cc46384dc245e9c276000efb601a1664aaad5775df0a57432eb709096e27e",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_CLOSED.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { felix };
