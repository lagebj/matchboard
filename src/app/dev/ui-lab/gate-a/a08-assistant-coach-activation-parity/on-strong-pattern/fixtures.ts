import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4Hypothesis, w4AiInsightFromHypothesis, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/** A08 "ON, strong pattern" — activation-parity counterpart to A05-enabled-with-pattern. */
export const identity: FixtureIdentity = {
  scenarioId: "A08-on-strong-pattern",
  fixtureId: "gate-a-w4-a08-on-strong-pattern",
  fixtureVersion: 1,
  fixtureSha256: "8a8d37f562f24c1078298e6494037263b599a0435236a66cc5a9c2fd6a0168d2",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const hypothesis = w4Hypothesis;
export const matchInsights = w4MatchInsightsViewModel("CURRENT", [w4AiInsightFromHypothesis]);

export const rawRecordsForHash = { hypothesis, matchInsights, activation: "on-strong-pattern" };
