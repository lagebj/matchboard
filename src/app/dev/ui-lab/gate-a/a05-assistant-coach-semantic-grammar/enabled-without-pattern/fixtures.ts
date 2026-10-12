import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/**
 * A05 "enabled without pattern" — Assistant Coach ran (it is on, connection READY) but found
 * nothing worth reporting for this player right now. Distinct from "disabled": the capability
 * genuinely executed, so an honest quiet line is shown — never a fabricated placeholder
 * hypothesis just to have something to display (`04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s
 * extraction rule 8 generalises here too: "no observations at all is an acceptable, correct
 * result").
 */
export const identity: FixtureIdentity = {
  scenarioId: "A05-enabled-without-pattern",
  fixtureId: "gate-a-w4-a05-enabled-without-pattern",
  fixtureVersion: 1,
  fixtureSha256: "7b1498eed0aec4d16f6b6d9dfb57715ddd58d9a96329e31dd3d6a8242681b7e6",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchInsights = w4MatchInsightsViewModel("CURRENT");

export const rawRecordsForHash = { matchInsights, noPattern: true };
