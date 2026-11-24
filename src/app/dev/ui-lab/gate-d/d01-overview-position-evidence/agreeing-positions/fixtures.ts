import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { PlayerCurrentStory } from "@/lib/touchline/presentation/player-current-story";
import { playerPositionOptions, optionalPlayerPositionOptions } from "@/lib/player-form-options";

/**
 * Gate D register D01 ("Player Detail / Overview — declared + actual position evidence").
 * State: declared positions and evidence-derived (`effectivePositions`) positions agree, both at
 * the exact tactical level and (via `ProfileRoleSummary`, remediation 2026-11-24) at the
 * ADR-0160 §6 profile level.
 *
 * `positionOptions`/`optionalPositionOptions` are the real production option lists
 * (`CANONICAL_TACTICAL_POSITIONS`, ADR-0154) — not a separate fixture-only vocabulary.
 *
 * History: this fixture originally disclosed a mismatch between the register's "14-role profile
 * vocabulary" acceptance question and the (at-the-time-undecided) production architecture. The
 * owner has since decided (ADR-0160 §6) to adopt the 14-role profile tier — see
 * `docs/ui-lab/gate-d-w1-candidates/SOURCE_RECONCILIATION.md` §4b for that resolution. This page
 * now demonstrates the approved profile experience directly (`ProfileRoleSummary`) in addition
 * to the real 24-code production mount below; see `VISUAL_VS_CURRENT.md`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D01-AGREEING",
  fixtureId: "gate-d-w1-d01-agreeing-positions",
  fixtureVersion: 2,
  fixtureSha256: "e4da0916c9cb0098ccb390b69a29bf67452428989980a10657ddb4068c61fd18",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const player = {
  id: "gate-d-w1-d01-agreeing-player",
  primaryPosition: "CB",
  secondaryPosition: "RCB",
  tertiaryPosition: "CDM",
};

export const positionOptions = playerPositionOptions;
export const optionalPositionOptions = optionalPlayerPositionOptions;

export const effectivePositions: TouchlinePositionMapEntry[] = [
  { positionCode: "CB", positionLabel: "Centre Back", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "RCB", positionLabel: "Right Centre Back", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "CDM", positionLabel: "Centre Defensive Midfield", rank: 3, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
];

export const currentStory: PlayerCurrentStory = {
  text: "Recent opportunities have been consistent: 5 of 5 eligible rounds.",
  source: "OPPORTUNITY",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D01-AGREEING", player, effectivePositions, currentStory };
