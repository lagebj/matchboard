import { collapseTacticalToProfile, type ProfilePosition } from "../shared/profile-position-model";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

/**
 * A12 UI Lab candidate only (PR #777 remediation) — the declared-profile "triple" (primary
 * required, secondary/tertiary optional), matching the real player-profile contract's
 * primary/secondary/tertiary shape (`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`) but
 * sourced from the 14-role profile vocabulary instead of the 24-code tactical one. Visual
 * candidate only — writes nothing, no production wiring.
 */
export type ProfilePositionTriple = {
  primary: ProfilePosition;
  secondary: ProfilePosition | null;
  tertiary: ProfilePosition | null;
};

/** No two non-null slots may hold the same profile position. */
export function isValidTriple(triple: ProfilePositionTriple): boolean {
  const used = [triple.primary, triple.secondary, triple.tertiary].filter((v): v is ProfilePosition => v !== null);
  return new Set(used).size === used.length;
}

/**
 * Setting a new primary clears any other slot that already held that value — a slot can never
 * silently end up duplicating another slot's value.
 */
export function setPrimary(triple: ProfilePositionTriple, value: ProfilePosition): ProfilePositionTriple {
  return {
    primary: value,
    secondary: triple.secondary === value ? null : triple.secondary,
    tertiary: triple.tertiary === value ? null : triple.tertiary,
  };
}

export function setSecondary(triple: ProfilePositionTriple, value: ProfilePosition | null): ProfilePositionTriple {
  return {
    ...triple,
    secondary: value,
    tertiary: triple.tertiary === value && value !== null ? null : triple.tertiary,
  };
}

export function setTertiary(triple: ProfilePositionTriple, value: ProfilePosition | null): ProfilePositionTriple {
  return { ...triple, tertiary: value };
}

/** The options a given slot may offer right now — every profile position except whichever the
 * *other* two slots already hold (a slot may always keep showing its own current value). */
export function availableOptionsFor(
  slot: "secondary" | "tertiary",
  triple: ProfilePositionTriple,
  allPositions: readonly ProfilePosition[],
): ProfilePosition[] {
  const otherUsed = new Set(
    [triple.primary, slot === "secondary" ? triple.tertiary : triple.secondary].filter(
      (v): v is ProfilePosition => v !== null,
    ),
  );
  return allPositions.filter((p) => !otherUsed.has(p));
}

export type LegacyConsolidationResult = {
  /** The one profile group to declare as primary when every source code collapses to the same
   * profile position. `null` when the source codes collapse to more than one distinct profile —
   * this candidate never guesses which one should be primary in that case. */
  singleProfile: ProfilePosition | null;
  /** Every distinct profile position the source codes collapse to, for display. */
  distinctProfiles: ProfilePosition[];
  sourceCodes: readonly CanonicalTacticalPosition[];
};

/**
 * Collapses a player's historical exact-position codes to profile positions, for a "legacy
 * migration preview" — proves `LCF`/`CF`/`RCF` consolidate to one declared `F` primary, not three
 * separate declarations, and that this candidate never invents a secondary/tertiary the source
 * data doesn't actually distinguish (`20_UI_LAB_CANDIDATE_WAVES.md` A12).
 */
export function previewLegacyConsolidation(sourceCodes: readonly CanonicalTacticalPosition[]): LegacyConsolidationResult {
  const distinctProfiles = Array.from(new Set(sourceCodes.map(collapseTacticalToProfile)));
  return {
    singleProfile: distinctProfiles.length === 1 ? distinctProfiles[0] : null,
    distinctProfiles,
    sourceCodes,
  };
}
