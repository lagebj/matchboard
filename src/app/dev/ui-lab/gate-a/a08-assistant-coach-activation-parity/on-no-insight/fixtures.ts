import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/** A08 "ON, no insight" — activation-parity counterpart to A05-enabled-without-pattern: the
 * capability ran, found nothing, and says so honestly rather than rendering filler. */
export const identity: FixtureIdentity = {
  scenarioId: "A08-on-no-insight",
  fixtureId: "gate-a-w4-a08-on-no-insight",
  fixtureVersion: 1,
  fixtureSha256: "af77896dde2e00055d790d39f4ca25ef6af32cb7c01530d1d79956a4b826d4c5",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchInsights = w4MatchInsightsViewModel("CURRENT");

export const rawRecordsForHash = { matchInsights, activation: "on-no-insight" };
