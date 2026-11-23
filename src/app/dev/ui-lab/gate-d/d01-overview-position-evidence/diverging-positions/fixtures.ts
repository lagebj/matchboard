import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { PlayerCurrentStory } from "@/lib/touchline/presentation/player-current-story";
import { playerPositionOptions, optionalPlayerPositionOptions } from "@/lib/player-form-options";

/**
 * Gate D register D01, divergence state: the coach-declared primary position (Centre Back)
 * disagrees with the evidence-derived strongest position (Right Back). Both still use the real
 * 24-code `CANONICAL_TACTICAL_POSITIONS` vocabulary (ADR-0154) — divergence is expressed through
 * rank/support-band/confidence and the `currentStory` headline, never through a second position
 * code system. See the sibling `agreeing-positions` fixture's header comment and
 * `docs/ui-lab/gate-d-w1-candidates/VISUAL_VS_CURRENT.md` for the disclosed mismatch between the
 * register's "14-role profile vocabulary" assumption and this actual architecture.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D01-DIVERGING",
  fixtureId: "gate-d-w1-d01-diverging-positions",
  fixtureVersion: 1,
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
