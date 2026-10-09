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

/**
 * PR #777 remediation (finding A12-1): the original legacy-migration preview conflated two
 * different signals that the approved contract (`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_
 * CONTRACT.md`) keeps strictly separate and differently authoritative:
 *
 * - **Case A — "Legacy declared positions":** the player already had a *declared*
 *   primary/secondary/tertiary, expressed in the old 24-code vocabulary. Projecting an existing
 *   declaration onto the 14-role vocabulary is a like-for-like consolidation — the original
 *   primary declaration keeps its ordering authority, it just becomes the primary's profile
 *   group. This is legitimate: a coach already decided this player's primary position; only the
 *   vocabulary changed.
 * - **Case B — "Recorded match exposure":** the player has no declared profile fields at all,
 *   only historical match minutes at certain exact tactical positions. That exposure can be
 *   *shown*, collapsed through the same 24→14 mapping — but it must never, by itself, create a
 *   primary/secondary/tertiary declaration. Evidence alone is not a coach decision; promoting it
 *   to one requires the production confidence-threshold/approval mechanism (ADR-0139), which this
 *   dev-only candidate does not implement or simulate.
 */
export type LegacyDeclaredPositions = {
  primary: CanonicalTacticalPosition;
  secondary?: CanonicalTacticalPosition | null;
  tertiary?: CanonicalTacticalPosition | null;
};

export type LegacyDeclaredConsolidationResult = {
  sourceDeclared: LegacyDeclaredPositions;
  /** The projected primary's profile group — always set; the original primary declaration is the
   * ordering authority, so it always maps straight through. */
  primary: ProfilePosition;
  /** `null` when the projected value would duplicate primary (or secondary, for tertiary) —
   * never invented, never silently promoted. */
  secondary: ProfilePosition | null;
  tertiary: ProfilePosition | null;
};

/**
 * Case A — projects an existing 24-code *declared* primary/secondary/tertiary onto the 14-role
 * profile vocabulary. E.g. declared primary `LCF`, secondary `CF`, tertiary `RCF` all collapse to
 * `F` — the result is primary `F`, secondary `null`, tertiary `null` (not three declarations of
 * the same thing, and nothing invented for the now-empty slots).
 */
export function previewLegacyDeclaredConsolidation(declared: LegacyDeclaredPositions): LegacyDeclaredConsolidationResult {
  const primary = collapseTacticalToProfile(declared.primary);
  const secondaryProjected = declared.secondary ? collapseTacticalToProfile(declared.secondary) : null;
  const tertiaryProjected = declared.tertiary ? collapseTacticalToProfile(declared.tertiary) : null;
  const secondary = secondaryProjected && secondaryProjected !== primary ? secondaryProjected : null;
  const tertiary = tertiaryProjected && tertiaryProjected !== primary && tertiaryProjected !== secondary ? tertiaryProjected : null;
  return { sourceDeclared: declared, primary, secondary, tertiary };
}
