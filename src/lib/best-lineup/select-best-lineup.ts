// ─────────────────────────────────────────────────────────────────
// Pure selection logic for the Recommended lineup (ADR-0129).
//
// Automatic Recommended-lineup generation resolves each formation slot
// to an exact target role and fills the outfield slots by one
// deterministic bounded matching, gated on exact positional
// eligibility. The goalkeeper is handled separately (goalkeeper
// boundary). Overall rating is a WITHIN-TIER preference only — it can
// re-order already-eligible candidates, never make an ineligible
// player eligible or beat a higher fit tier.
// ─────────────────────────────────────────────────────────────────

import type { FormationSlotRoleType } from "@/lib/formations/types";
import type { SideInput } from "@/domain/positions/roles";
import { classifyExactSuitability } from "@/domain/positions/suitability";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";
import { matchSlotsToCandidates, type SafeMatchCandidate, type SafeMatchSlot } from "@/domain/positions/matching";

export interface BestLineupCandidate {
  id: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  bestSide?: SideInput;
  /** Overall rating value (1–10) or the neutral fallback for unrated players. */
  rating: number;
}

export interface BestLineupSlotInput {
  slotId: string;
  roleType: FormationSlotRoleType;
  gridX: number;
}

/**
 * Returns a `slotId → playerId` map. Locked assignments are honoured as-is (an explicit coach
 * decision bypasses the automatic eligibility gate). GK slots are filled from declared
 * goalkeepers only; outfield slots by exact bounded matching. `FREE` slots are never auto-filled.
 */
export function selectBestLineupAssignments(
  slots: BestLineupSlotInput[],
  candidates: BestLineupCandidate[],
  lockedSlotAssignments: Map<string, string>,
  seed: string,
): Map<string, string> {
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const slotAssignments = new Map<string, string>();
  const assigned = new Set<string>();

  for (const [slotId, playerId] of lockedSlotAssignments) {
    if (candidateById.has(playerId) && !assigned.has(playerId)) {
      slotAssignments.set(slotId, playerId);
      assigned.add(playerId);
    }
  }

  const declaredPositionsOf = (c: BestLineupCandidate) => ({
    primaryPosition: c.primaryPosition,
    secondaryPosition: c.secondaryPosition,
    tertiaryPosition: c.tertiaryPosition,
    bestSide: c.bestSide,
  });

  // Goalkeeper: dedicated pass over declared goalkeepers, best rating first.
  const gkSlots = slots.filter((s) => s.roleType === "GOALKEEPER" && !slotAssignments.has(s.slotId));
  if (gkSlots.length > 0) {
    const gkCandidates = candidates
      .filter((c) => !assigned.has(c.id) && classifyExactSuitability(declaredPositionsOf(c), "GK").automaticallyEligible)
      .sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1));
    let gi = 0;
    for (const slot of gkSlots) {
      const gk = gkCandidates[gi++];
      if (!gk) break;
      slotAssignments.set(slot.slotId, gk.id);
      assigned.add(gk.id);
    }
  }

  // Outfield: one deterministic bounded matching over exact target roles.
  const matchableSlots: SafeMatchSlot[] = [];
  for (const slot of slots) {
    if (slot.roleType === "GOALKEEPER" || slot.roleType === "FREE" || slotAssignments.has(slot.slotId)) continue;
    const targetRole = deriveExactTargetRole(slot.roleType, slot.gridX);
    if (targetRole) matchableSlots.push({ slotId: slot.slotId, targetRole });
  }

  const matchCandidates: SafeMatchCandidate[] = candidates
    .filter((c) => !assigned.has(c.id))
    .map((c) => ({ candidateId: c.id, declaredPositions: declaredPositionsOf(c) }));

  const result = matchSlotsToCandidates(matchableSlots, matchCandidates, {
    seed,
    preference: (candidateId) => (candidateById.get(candidateId)?.rating ?? 0) * 40,
  });

  for (const a of result.assignments) {
    slotAssignments.set(a.slotId, a.candidateId);
    assigned.add(a.candidateId);
  }

  return slotAssignments;
}
