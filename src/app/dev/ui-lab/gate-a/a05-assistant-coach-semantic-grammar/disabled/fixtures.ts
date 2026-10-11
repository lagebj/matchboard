import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/**
 * A05 (register row 6, `programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`) — "Disabled" state.
 * AI is off for this organisation: no Assistant Coach hypothesis section renders at all (not a
 * placeholder, not omitted-but-reserved — genuinely absent), and the deterministic Match Insights
 * list is unaffected (`get-match-insights.ts:96-97`: `aiEnabled = false` keeps `status: "CURRENT"`
 * with zero AI candidates).
 */
export const identity: FixtureIdentity = {
  scenarioId: "A05-disabled",
  fixtureId: "gate-a-w4-a05-disabled",
  fixtureVersion: 1,
  fixtureSha256: "22e62b801d7b920ec1956ec82bde6da812145d4c9f4d270aa41197b6accf6fb5",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchInsights = w4MatchInsightsViewModel("CURRENT");

export const rawRecordsForHash = { matchInsights };
