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
  fixtureVersion: 3,
  fixtureSha256: "e98b2cf0295c0268a621273f455b297881975b93f93e8788f0c926bd0680fd10",
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

/**
 * Deliberately NOT a `POSITION_EVOLUTION`-sourced story here (found and fixed during this
 * remediation's own screenshot inspection): the real `selectPlayerCurrentStory()`
 * (`player-current-story.ts`) only emits that source/headline shape when
 * `input.positionEvolution` is populated, which in today's production reality (pre-ADR-0160)
 * means ADR-0139's automatic write has *already happened* — the headline literally narrates a
 * completed mutation. Pairing that headline with a still-`CB` `player.primaryPosition` and this
 * candidate's own "no automatic primary-position mutation occurs" disclosure would be internally
 * contradictory on the same page. An `OPPORTUNITY`-sourced headline (same source the sibling
 * `agreeing-positions` fixture uses) makes no claim about the primary position at all.
 */
export const currentStory: PlayerCurrentStory = {
  text: "Recent opportunities have been consistent: 4 of 5 eligible rounds.",
  source: "OPPORTUNITY",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D01-DIVERGING", player, effectivePositions, currentStory };
