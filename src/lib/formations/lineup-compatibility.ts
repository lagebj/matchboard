import type { FormationSlotData, BroadPosition } from "./types";

export type PlayerPositionInfo = {
  playerId: string;
  primaryPosition: string;
  secondaryPositions: string[];
};

const FORMATION_POSITION_TO_BROAD: Record<string, BroadPosition> = {
  GK: "goalkeeper",
  CB: "defender",
  LB: "defender",
  RB: "defender",
  CM: "midfielder",
  DM: "midfielder",
  AM: "midfielder",
  LM: "midfielder",
  RM: "midfielder",
  W: "midfielder",
  LW: "forward",
  RW: "forward",
  ST: "forward",
  CF: "forward",
};

export function mapExistingPositionToBroad(position: string): BroadPosition {
  if (FORMATION_POSITION_TO_BROAD[position]) {
    return FORMATION_POSITION_TO_BROAD[position];
  }
  const lower = position.toLowerCase();
  if (lower.includes("gk") || lower.includes("goal")) return "goalkeeper";
  if (lower.includes("def") || lower.includes("back") || lower.includes("cb")) return "defender";
  if (lower.includes("mid") || lower.includes("cm") || lower.includes("dm") || lower.includes("am")) return "midfielder";
  if (lower.includes("for") || lower.includes("st") || lower.includes("wing")) return "forward";
  return "flexible";
}

export type CompatibilityResult = {
  playerId: string;
  isCompatible: boolean;
  compatibilityReason: string | null;
};

export function getPlayerSlotCompatibility(
  player: PlayerPositionInfo,
  slot: FormationSlotData,
): CompatibilityResult {
  const slotPositions = slot.acceptedPositionIds as BroadPosition[];
  const playerPositions = getPlayerBroadPositions(player);

  for (const slotPos of slotPositions) {
    if (playerPositions.includes(slotPos)) {
      if (slotPos === playerPositions[0]) {
        const broadLabel = formatBroadPositionLabel(slotPos);
        return { playerId: player.playerId, isCompatible: true, compatibilityReason: `Registered as ${broadLabel}` };
      }
      return { playerId: player.playerId, isCompatible: true, compatibilityReason: `Can play ${slotPos}` };
    }
  }

  return { playerId: player.playerId, isCompatible: false, compatibilityReason: null };
}

function getPlayerBroadPositions(player: PlayerPositionInfo): BroadPosition[] {
  const positions: BroadPosition[] = [];
  const primary = mapExistingPositionToBroad(player.primaryPosition);
  if (!positions.includes(primary)) positions.push(primary);

  for (const sp of player.secondaryPositions) {
    const broad = mapExistingPositionToBroad(sp);
    if (!positions.includes(broad)) positions.push(broad);
  }

  return positions;
}

export function sortPlayersBySlotCompatibility(
  players: PlayerPositionInfo[],
  slot: FormationSlotData,
): { player: PlayerPositionInfo; compatible: boolean; reason: string | null }[] {
  const results = players.map((player) => {
    const compat = getPlayerSlotCompatibility(player, slot);
    return { player, compatible: compat.isCompatible, reason: compat.compatibilityReason };
  });

  results.sort((a, b) => {
    if (a.compatible && !b.compatible) return -1;
    if (!a.compatible && b.compatible) return 1;
    return 0;
  });

  return results;
}

export function getPlayersForLineup(
  players: PlayerPositionInfo[],
  slots: FormationSlotData[],
  assignedPlayerIds: Set<string>,
): Map<string, { player: PlayerPositionInfo; compatible: boolean; reason: string | null }[]> {
  const availablePlayers = players.filter((p) => !assignedPlayerIds.has(p.playerId));
  const result = new Map<string, { player: PlayerPositionInfo; compatible: boolean; reason: string | null }[]>();

  for (const slot of slots) {
    const sorted = sortPlayersBySlotCompatibility(availablePlayers, slot);
    result.set(slot.id ?? `${slot.gridX}-${slot.gridY}`, sorted);
  }

  return result;
}

function formatBroadPositionLabel(pos: BroadPosition): string {
  switch (pos) {
    case "goalkeeper": return "goalkeeper";
    case "defender": return "defender";
    case "midfielder": return "midfielder";
    case "forward": return "forward";
    case "flexible": return "flexible";
  }
}