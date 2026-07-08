import type { FormationSlotData } from '@/lib/formations/types';
import type { BroadPosition, GameFormat, FormationSlotRequirement } from './event-types';
import { getDefaultSlotRequirements } from './event-squad-generation';

export type LineupSlot = {
  slotIndex: number;
  roleType: string;
  label: string;
  acceptedPositions: BroadPosition[];
  gridX?: number;
  gridY?: number;
  player: {
    playerId: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    overallLevel: number | null;
    isGK: boolean;
    positionFitTier: string | null;
    selectionReason: string;
    locked: boolean;
  } | null;
};

export type LineupAssignment = {
  squadId: string;
  squadName: string;
  formationId: string | null;
  formationName: string | null;
  slots: LineupSlot[];
  unassignedPlayers: {
    playerId: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    overallLevel: number | null;
    isGK: boolean;
    positionFitTier: string | null;
  }[];
};

type SlotWithGrid = FormationSlotRequirement & {
  gridX?: number;
  gridY?: number;
  slotIndex: number;
};

function resolveSlots(
  formationSlots: FormationSlotData[] | null,
  gameFormat: GameFormat,
): SlotWithGrid[] {
  if (formationSlots && formationSlots.length > 0) {
    return formationSlots.map((s, idx) => ({
      roleType: s.roleType,
      acceptedPositions: (Array.isArray(s.acceptedPositionIds) ? s.acceptedPositionIds : []) as BroadPosition[],
      label: s.label || s.roleType,
      gridX: s.gridX,
      gridY: s.gridY,
      slotIndex: idx,
    }));
  }
  return getDefaultSlotRequirements(gameFormat).map((s, idx) => ({
    ...s,
    gridX: undefined as number | undefined,
    gridY: undefined as number | undefined,
    slotIndex: idx,
  }));
}

export function computeLineupAssignment(input: {
  squadId: string;
  squadName: string;
  formationId: string | null;
  formationName: string | null;
  players: {
    playerId: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    overallLevel: number | null;
    isGK: boolean;
    positionFitTier: string | null;
    assignedSlotIndex: number | null;
    assignedSlotLabel: string | null;
    assignedRoleType: string | null;
    assignedPositionId: string | null;
    lineupOrder: number | null;
    selectionReason: string;
    locked: boolean;
  }[];
  formationSlots: FormationSlotData[] | null;
  gameFormat: GameFormat;
}): LineupAssignment {
  const { squadId, squadName, formationId, formationName, players, formationSlots, gameFormat } = input;

  const slotRequirements = resolveSlots(formationSlots, gameFormat);

  const assignedPlayerIds = new Set<string>();
  const slots: LineupSlot[] = slotRequirements.map((slot) => {
    const assignedPlayer = players.find((p) => p.assignedSlotIndex === slot.slotIndex);

    if (assignedPlayer) {
      assignedPlayerIds.add(assignedPlayer.playerId);
      return {
        slotIndex: slot.slotIndex,
        roleType: slot.roleType,
        label: slot.label,
        acceptedPositions: slot.acceptedPositions,
        gridX: slot.gridX,
        gridY: slot.gridY,
        player: {
          playerId: assignedPlayer.playerId,
          firstName: assignedPlayer.firstName,
          lastName: assignedPlayer.lastName,
          primaryPosition: assignedPlayer.primaryPosition,
          overallLevel: assignedPlayer.overallLevel,
          isGK: assignedPlayer.isGK,
          positionFitTier: assignedPlayer.positionFitTier,
          selectionReason: assignedPlayer.selectionReason,
          locked: assignedPlayer.locked,
        },
      };
    }

    const roleMatchPlayer = players.find(
      (p) =>
        !assignedPlayerIds.has(p.playerId) &&
        p.assignedRoleType === slot.roleType &&
        p.assignedSlotIndex === null,
    );

    if (roleMatchPlayer) {
      assignedPlayerIds.add(roleMatchPlayer.playerId);
      return {
        slotIndex: slot.slotIndex,
        roleType: slot.roleType,
        label: slot.label,
        acceptedPositions: slot.acceptedPositions,
        gridX: slot.gridX,
        gridY: slot.gridY,
        player: {
          playerId: roleMatchPlayer.playerId,
          firstName: roleMatchPlayer.firstName,
          lastName: roleMatchPlayer.lastName,
          primaryPosition: roleMatchPlayer.primaryPosition,
          overallLevel: roleMatchPlayer.overallLevel,
          isGK: roleMatchPlayer.isGK,
          positionFitTier: roleMatchPlayer.positionFitTier,
          selectionReason: roleMatchPlayer.selectionReason,
          locked: roleMatchPlayer.locked,
        },
      };
    }

    return {
      slotIndex: slot.slotIndex,
      roleType: slot.roleType,
      label: slot.label,
      acceptedPositions: slot.acceptedPositions,
      gridX: slot.gridX,
      gridY: slot.gridY,
      player: null,
    };
  });

  const unassignedPlayers = players
    .filter((p) => !assignedPlayerIds.has(p.playerId))
    .sort((a, b) => (a.lineupOrder ?? 999) - (b.lineupOrder ?? 999))
    .map((p) => ({
      playerId: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      primaryPosition: p.primaryPosition,
      overallLevel: p.overallLevel,
      isGK: p.isGK,
      positionFitTier: p.positionFitTier,
    }));

  return {
    squadId,
    squadName,
    formationId,
    formationName,
    slots,
    unassignedPlayers,
  };
}