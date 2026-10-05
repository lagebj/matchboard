import { CANONICAL_TACTICAL_POSITIONS, type CanonicalTacticalPosition } from "./roles";
import { classifyExactSuitability, type DeclaredPositions } from "./suitability";
import type { SuitabilityTier } from "./matrix";

/**
 * Groups a single player's positional suitability (ADR-0129, extended to the canonical 24-code
 * vocabulary by ADR-0154 step A9) by tier, across every outfield canonical position, for display
 * via `PositionFitList` (Touchline Design Atlas, `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §C`'s
 * "selected-player inspector"). Pure -- no query, no domain mutation.
 *
 * Iterates the full 24-code vocabulary (not the old 12-code `EXACT_ROLES`) so a coach sees true
 * sided fit -- e.g. `LCB` and `RCB` as distinct entries, not collapsed into one `CB` -- matching
 * every other surface this programme already converted.
 *
 * "GK" is deliberately excluded, matching the same goalkeeper-boundary precedent already
 * established for `OutfieldRoleSuitabilityTier`/`OutfieldStructuralRole` (Bundle 5, ADR-0116,
 * D-011) -- goalkeeper eligibility is a separate `goalkeeperAbility` concept, not part of the
 * exact outfield suitability matrix's own display grouping here.
 */
export interface PositionFitEntry {
  tier: SuitabilityTier;
  roles: CanonicalTacticalPosition[];
}

const OUTFIELD_CANONICAL_POSITIONS = CANONICAL_TACTICAL_POSITIONS.filter(
  (position): position is CanonicalTacticalPosition => position !== "GK",
);

export function computePlayerPositionFitEntries(player: DeclaredPositions): PositionFitEntry[] {
  const rolesByTier = new Map<SuitabilityTier, CanonicalTacticalPosition[]>();
  for (const role of OUTFIELD_CANONICAL_POSITIONS) {
    const { tier } = classifyExactSuitability(player, role);
    const existing = rolesByTier.get(tier);
    if (existing) existing.push(role);
    else rolesByTier.set(tier, [role]);
  }
  return Array.from(rolesByTier.entries()).map(([tier, roles]) => ({ tier, roles }));
}
