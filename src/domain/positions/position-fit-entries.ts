import { EXACT_ROLES, type ExactRole } from "./roles";
import { classifyExactSuitability, type DeclaredPositions } from "./suitability";
import type { SuitabilityTier } from "./matrix";

/**
 * Groups a single player's exact-role suitability (ADR-0129) by tier, across every outfield
 * exact role, for display via `PositionFitList` (Touchline Design Atlas, `08_ROUTE_COMPOSITION_
 * PLANNING_TACTICS.md §C`'s "selected-player inspector"). Pure -- no query, no domain mutation.
 *
 * "GK" is deliberately excluded, matching the same goalkeeper-boundary precedent already
 * established for `OutfieldRoleSuitabilityTier`/`OutfieldStructuralRole` (Bundle 5, ADR-0116,
 * D-011) -- goalkeeper eligibility is a separate `goalkeeperAbility` concept, not part of the
 * exact outfield suitability matrix's own display grouping here.
 */
export interface PositionFitEntry {
  tier: SuitabilityTier;
  roles: ExactRole[];
}

const OUTFIELD_EXACT_ROLES = EXACT_ROLES.filter((role): role is ExactRole => role !== "GK");

export function computePlayerPositionFitEntries(player: DeclaredPositions): PositionFitEntry[] {
  const rolesByTier = new Map<SuitabilityTier, ExactRole[]>();
  for (const role of OUTFIELD_EXACT_ROLES) {
    const { tier } = classifyExactSuitability(player, role);
    const existing = rolesByTier.get(tier);
    if (existing) existing.push(role);
    else rolesByTier.set(tier, [role]);
  }
  return Array.from(rolesByTier.entries()).map(([tier, roles]) => ({ tier, roles }));
}
