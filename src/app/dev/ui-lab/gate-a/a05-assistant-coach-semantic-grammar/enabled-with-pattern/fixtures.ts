import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4Hypothesis, w4AiInsightFromHypothesis, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/**
 * A05 "enabled with pattern" — Assistant Coach is on and has a valuable, evidence-based
 * hypothesis to report. Verified real vocabulary (`AssistantCoachHypothesisPanel`'s uncertainty
 * levels, `EvidenceRef` kinds) and the real `MatchInsightsStatus` meaning (`get-match-insights.ts`
 * `CURRENT` + merged AI candidate) — see `CURRENT_STATE_AUDIT.md` items 2-3.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A05-enabled-with-pattern",
  fixtureId: "gate-a-w4-a05-enabled-with-pattern",
  fixtureVersion: 1,
  fixtureSha256: "cfbfbbe69498fddd249e81b83fe6e0d1761a549471df77ea8ff5c3f6c7fbf736",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const hypothesis = w4Hypothesis;
export const matchInsights = w4MatchInsightsViewModel("CURRENT", [w4AiInsightFromHypothesis]);

export const rawRecordsForHash = { hypothesis, matchInsights };
