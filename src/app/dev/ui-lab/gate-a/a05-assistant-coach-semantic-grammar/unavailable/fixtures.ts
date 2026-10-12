import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/**
 * A05 "unavailable" — Assistant Coach is enabled but the most recent attempt failed terminally
 * (provider error, quota, or connection not READY — `organisation-ai-settings.ts:68-78` confirms
 * this is a real, reachable condition). Mirrors the real `MatchInsightsStatus = "AI_UNAVAILABLE"`
 * meaning exactly (`get-match-insights.ts:124-134`): deterministic facts stay current.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A05-unavailable",
  fixtureId: "gate-a-w4-a05-unavailable",
  fixtureVersion: 1,
  fixtureSha256: "39d69f74c951deaccdadde7b4be138296f68dee8f7a991af72e2e924795cb08d",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchInsights = w4MatchInsightsViewModel("AI_UNAVAILABLE");

export const rawRecordsForHash = { matchInsights };
