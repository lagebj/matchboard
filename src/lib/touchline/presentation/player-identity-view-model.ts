/**
 * Player Detail's persistent identity header (Atlas Follow-up,
 * `04_PLAYER_DETAIL_CONTRACT.md §2`). Stays stable across all four tabs — the tab shell owns
 * this, tab content is separate (see `player-overview-view-model.ts` and siblings).
 *
 * `currentPrimaryPosition`/`secondaryPositions` come from the effective position model
 * (ADR-0139), not the raw declared scalar directly — a caller passes
 * `computeEffectivePlayerPositionProfile(...).primary`/`.secondary`/`.tertiary`, never a second
 * position-resolution here.
 */
export type PlayerIdentityViewModelInput = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  /** Resolved kit-colour hex (`resolveKitColorSwatch()`), or `null` for the neutral shirt. */
  kitColor: string | null;
  groupLabel: string | null;
  coreTeamName: string | null;
  currentPrimaryPosition: string | null;
  secondaryPositions: string[];
  availabilityLabel: string;
  availabilityTone: "positive" | "neutral" | "attention";
};

export type PlayerIdentityViewModel = PlayerIdentityViewModelInput & {
  displayName: string;
};

export function buildPlayerIdentityViewModel(input: PlayerIdentityViewModelInput): PlayerIdentityViewModel {
  return {
    ...input,
    displayName: input.lastName ? `${input.firstName} ${input.lastName}` : input.firstName,
  };
}
