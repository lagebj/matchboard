import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { PlayerCurrentStory } from "@/lib/touchline/presentation/player-current-story";
import { playerPositionOptions, optionalPlayerPositionOptions } from "@/lib/player-form-options";

/**
 * Gate D register D01, divergence state: the coach-declared primary position (Centre Back)
 * disagrees with the evidence-derived strongest position (Right Back). The real production mount
 * expresses this through rank/support-band/confidence over the shared 24-code vocabulary
 * (ADR-0154); `ProfileRoleSummary` (remediation, 2026-11-24) additionally shows this divergence
 * at the ADR-0160 §6 profile level — declared profile `CB` vs. evidence-derived profile `RB`,
 * genuinely different profile roles, not merely different sided codes within the same profile
 * group — and states explicitly that no automatic primary-position mutation occurs. See the
 * sibling `agreeing-positions` fixture's header comment and
 * `docs/ui-lab/gate-d-w1-candidates/SOURCE_RECONCILIATION.md` §4b for the owner's decision history.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D01-DIVERGING",
  fixtureId: "gate-d-w1-d01-diverging-positions",
  fixtureVersion: 2,
  fixtureSha256: "fd0b4d60cbc11b77c5f98f26ababef555fa5531644f8938ac22b52d9f2e6a0f2",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const player = {
  id: "gate-d-w1-d01-diverging-player",
  primaryPosition: "CB",
  secondaryPosition: "RB",
  tertiaryPosition: "CDM",
};

export const positionOptions = playerPositionOptions;
export const optionalPositionOptions = optionalPlayerPositionOptions;

export const effectivePositions: TouchlinePositionMapEntry[] = [
  { positionCode: "RB", positionLabel: "Right Back", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "CB", positionLabel: "Centre Back", rank: 2, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "RWB", positionLabel: "Right Wing Back", rank: 3, supportBand: "LIMITED", confidence: "LOW" },
];

export const currentStory: PlayerCurrentStory = {
  text: "Recorded primary position updated to Right Back based on recent match evidence (previously Centre Back).",
  source: "POSITION_EVOLUTION",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D01-DIVERGING", player, effectivePositions, currentStory };
