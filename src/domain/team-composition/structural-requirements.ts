// ─────────────────────────────────────────────────────────────────
// Structural requirements: resolves formation or fallback structures
// for team composition.
// ─────────────────────────────────────────────────────────────────

import type {
  BroadPosition,
  StructuralRole,
  StructuralSlotRequirement,
  TeamStructuralRequirements,
  CompositionTargetTeam,
} from "./team-composition-types";

import { BROAD_POSITION_TO_STRUCTURAL_ROLE } from "./team-composition-types";

export type GameFormat = "THREE_A_SIDE" | "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "NINE_A_SIDE" | "ELEVEN_A_SIDE";

export const GAME_FORMAT_PLAYER_COUNT: Record<GameFormat, number> = {
  THREE_A_SIDE: 3,
  FIVE_A_SIDE: 5,
  SEVEN_A_SIDE: 7,
  NINE_A_SIDE: 9,
  ELEVEN_A_SIDE: 11,
};

export function getDefaultTargetSize(format: GameFormat): number {
  return GAME_FORMAT_PLAYER_COUNT[format];
}

export function getFallbackStructure(format: GameFormat): TeamStructuralRequirements {
  const slots = FALLBACK_SLOTS[format];
  return {
    slots,
    requireGoalkeeper: format !== "THREE_A_SIDE",
    source: "FALLBACK",
  };
}

export function getStructureForTeam(
  team: CompositionTargetTeam,
  formations: Map<string, FormationStructure>,
  fallbackFormat: GameFormat,
): TeamStructuralRequirements {
  if (team.formationId && formations.has(team.formationId)) {
    const formation = formations.get(team.formationId)!;
    return {
      slots: formation.slots,
      requireGoalkeeper: formation.slots.some((s) => s.role === "GOALKEEPER"),
      source: "FORMATION",
      formationId: team.formationId,
      formationName: formation.name,
    };
  }
  return getFallbackStructure(fallbackFormat);
}

export interface FormationStructure {
  id: string;
  name: string;
  gameFormat: GameFormat;
  slots: StructuralSlotRequirement[];
}

const FALLBACK_SLOTS: Record<GameFormat, StructuralSlotRequirement[]> = {
  THREE_A_SIDE: [
    { role: "DEFENCE", count: 1, acceptedPositions: ["defender"], label: "Defender" },
    { role: "MIDFIELD", count: 1, acceptedPositions: ["midfielder"], label: "Midfielder" },
    { role: "ATTACK", count: 1, acceptedPositions: ["forward"], label: "Forward" },
  ],
  FIVE_A_SIDE: [
    { role: "GOALKEEPER", count: 1, acceptedPositions: ["goalkeeper"], label: "Goalkeeper" },
    { role: "DEFENCE", count: 1, acceptedPositions: ["defender"], label: "Defender" },
    { role: "MIDFIELD", count: 1, acceptedPositions: ["midfielder"], label: "Midfielder" },
    { role: "ATTACK", count: 1, acceptedPositions: ["forward"], label: "Forward" },
    { role: "FLEXIBLE", count: 1, acceptedPositions: ["defender", "midfielder", "forward", "flexible"], label: "Flexible" },
  ],
  SEVEN_A_SIDE: [
    { role: "GOALKEEPER", count: 1, acceptedPositions: ["goalkeeper"], label: "Goalkeeper" },
    { role: "DEFENCE", count: 2, acceptedPositions: ["defender"], label: "Defender" },
    { role: "MIDFIELD", count: 2, acceptedPositions: ["midfielder"], label: "Midfielder" },
    { role: "ATTACK", count: 1, acceptedPositions: ["forward"], label: "Forward" },
    { role: "FLEXIBLE", count: 1, acceptedPositions: ["defender", "midfielder", "forward", "flexible"], label: "Flexible" },
  ],
  NINE_A_SIDE: [
    { role: "GOALKEEPER", count: 1, acceptedPositions: ["goalkeeper"], label: "Goalkeeper" },
    { role: "DEFENCE", count: 3, acceptedPositions: ["defender"], label: "Defender" },
    { role: "MIDFIELD", count: 3, acceptedPositions: ["midfielder"], label: "Midfielder" },
    { role: "ATTACK", count: 2, acceptedPositions: ["forward"], label: "Forward" },
  ],
  ELEVEN_A_SIDE: [
    { role: "GOALKEEPER", count: 1, acceptedPositions: ["goalkeeper"], label: "Goalkeeper" },
    { role: "DEFENCE", count: 4, acceptedPositions: ["defender"], label: "Defender" },
    { role: "MIDFIELD", count: 3, acceptedPositions: ["midfielder", "defender", "forward", "flexible"], label: "Midfielder" },
    { role: "ATTACK", count: 3, acceptedPositions: ["forward"], label: "Forward" },
  ],
};

export function getDefaultSlotRequirements(format: GameFormat): StructuralSlotRequirement[] {
  return FALLBACK_SLOTS[format];
}

export function countRoleRequirements(slots: StructuralSlotRequirement[]): Record<StructuralRole, number> {
  const counts: Record<StructuralRole, number> = {
    GOALKEEPER: 0,
    DEFENCE: 0,
    MIDFIELD: 0,
    ATTACK: 0,
    FLEXIBLE: 0,
  };
  for (const slot of slots) {
    counts[slot.role] = (counts[slot.role] || 0) + slot.count;
  }
  return counts;
}

export function getTotalSlotCount(slots: StructuralSlotRequirement[]): number {
  return slots.reduce((sum, s) => sum + s.count, 0);
}

export function broadenSlotAcceptance(slots: StructuralSlotRequirement[]): StructuralSlotRequirement[] {
  return slots.map((s) => ({
    ...s,
    acceptedPositions: s.role === "FLEXIBLE"
      ? ["defender", "midfielder", "forward", "goalkeeper", "flexible"] as BroadPosition[]
      : s.acceptedPositions,
  }));
}