import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, w4MatchInsightsViewModel } from "../../shared/w4-assistant-coach-fixture";

/**
 * A08 (register row 31) "OFF" — activation-parity counterpart to A05-disabled, reusing the SAME
 * deterministic fixture. A08's own acceptance question is specifically about layout parity ("no
 * reserved gap when off"), not a new fact set — so this fixture is deliberately the same shape,
 * not a re-derivation.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A08-off",
  fixtureId: "gate-a-w4-a08-off",
  fixtureVersion: 1,
  fixtureSha256: "a1019e49f267382648e31bf0d4ff564292afd2f65cb1b442ec9a4bc3d9ed1053",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchInsights = w4MatchInsightsViewModel("CURRENT");

export const rawRecordsForHash = { matchInsights, activation: "off" };
