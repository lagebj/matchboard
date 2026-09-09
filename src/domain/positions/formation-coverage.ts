// ─────────────────────────────────────────────────────────────────
// Exact formation coverage (ADR-0129 §12).
//
// When an exact formation context exists (real formation slots with
// grid geometry), coverage is tested with SIMULTANEOUS maximum matching
// over exact target roles — so one versatile player is never counted
// as the sole solution for two different required roles, and a "some
// compatible player exists per slot" check can never fabricate coverage
// that is not actually simultaneously achievable.
//
// `FREE` slots derive no exact target role and are excluded from the
// exact-coverage count (they are manual-only for automatic planning).
// A caller with no real slot geometry must NOT call this — broad
// composition stays valid there, and the UI must not claim exact
// coverage.
// ─────────────────────────────────────────────────────────────────

import type { FormationSlotRoleType } from "@/lib/formations/types";
import { deriveExactTargetRole } from "./slot-target";
import { matchSlotsToCandidates } from "./matching";
import type { ExactRole, SideInput } from "./roles";

export interface CoverageSlot {
  /** Stable identifier — a slot id, or an index, unique within the set. */
  slotId: string;
  roleType: FormationSlotRoleType;
  gridX: number;
}

export interface CoveragePlayer {
  id: string;
  primaryPosition: string | null | undefined;
  secondaryPosition?: string | null | undefined;
  tertiaryPosition?: string | null | undefined;
  bestSide?: SideInput;
}

export interface ExactFormationCoverage {
  /** Always true — callers only build this when real slot geometry exists. */
  hasExactContext: true;
  /** Every non-FREE required slot has an automatically eligible player, simultaneously. */
  covered: boolean;
  requiredExactSlots: number;
  filledExactSlots: number;
  /** Exact roles with no automatically eligible player in the given squad. */
  unfilledRoles: ExactRole[];
  /** FREE slots — excluded from the exact-coverage count (manual-only). */
  freeSlotCount: number;
}

export function computeExactFormationCoverage(
  slots: CoverageSlot[],
  players: CoveragePlayer[],
): ExactFormationCoverage {
  const freeSlotCount = slots.filter((s) => s.roleType === "FREE").length;

  const exactSlots: { slotId: string; targetRole: ExactRole }[] = [];
  for (const slot of slots) {
    const role = deriveExactTargetRole(slot.roleType, slot.gridX);
    if (role) exactSlots.push({ slotId: slot.slotId, targetRole: role });
  }

  const result = matchSlotsToCandidates(
    exactSlots,
    players.map((p) => ({
      candidateId: p.id,
      declaredPositions: {
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        tertiaryPosition: p.tertiaryPosition,
        bestSide: p.bestSide,
      },
    })),
    { seed: exactSlots.map((s) => s.slotId).join(",") },
  );

  return {
    hasExactContext: true,
    covered: result.unfilledSlots.length === 0 && exactSlots.length > 0,
    requiredExactSlots: exactSlots.length,
    filledExactSlots: result.assignments.length,
    unfilledRoles: result.unfilledSlots.map((s) => s.role),
    freeSlotCount,
  };
}
