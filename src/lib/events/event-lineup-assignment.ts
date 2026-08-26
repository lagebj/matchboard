import type { FormationSlotData } from '@/lib/formations/types';
import type { BroadPosition, GameFormat, FormationSlotRequirement } from './event-types';
import { getDefaultSlotRequirements, getRoleRelevantRating } from './event-squad-generation';
import { getPositionFitTier } from './event-types';
import type { PlayerWithRatings } from './event-squad-generation';
import { mapAnyPositionToBroad } from '@/lib/players/player-position-resolver';

type PlayerForLineup = {
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
};

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

function getPlayerFitTier(
  player: PlayerForLineup,
  acceptedPositions: BroadPosition[],
): 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT' {
  return getPositionFitTier(
    player.primaryPosition ?? '',
    player.secondaryPosition,
    player.tertiaryPosition,
    acceptedPositions,
  );
}


function toPlayerWithRatings(player: PlayerForLineup): PlayerWithRatings & { playerId: string } {
  return {
    playerId: player.playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    coreTeamId: null,
    primaryPosition: player.primaryPosition ?? '',
    secondaryPosition: player.secondaryPosition,
    tertiaryPosition: player.tertiaryPosition,
    goalkeeperAbility: player.isGK ? 'YES' : 'NO',
    ballControl: null,
    passing: null,
    firstTouch: null,
    oneVOneAttacking: null,
    positioning: null,
    oneVOneDefending: null,
    decisionMaking: null,
    effort: null,
    teamplay: null,
    concentration: null,
    speed: null,
    strength: null,
    nonRotatable: false,
    preferredFoot: 'RIGHT',
    bestSide: 'RIGHT',
    ratings: {
      overallLevel: player.overallLevel,
      defending: null,
      attacking: null,
      gameUnderstanding: null,
      intensity: null,
      teamplay: null,
      goalkeeperAbility: player.isGK ? 'YES' : 'NO',
    },
    broadPositions: player.primaryPosition
      ? (player.secondaryPosition
          ? [mapAnyPositionToBroad(player.primaryPosition), mapAnyPositionToBroad(player.secondaryPosition)]
              .filter((v, i, a) => a.indexOf(v) === i)
          : [mapAnyPositionToBroad(player.primaryPosition)])
      : ['flexible' as BroadPosition],
    isGoalkeeper: player.isGK,
  };
}

function findBestCandidate(
  availablePlayers: PlayerForLineup[],
  slot: SlotWithGrid,
  assignedPlayerIds: Set<string>,
): { player: PlayerForLineup; fitTier: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT' } | null {
  const candidates = availablePlayers.filter((p) => {
    if (assignedPlayerIds.has(p.playerId)) return false;
    if (p.assignedRoleType !== null && p.assignedRoleType !== slot.roleType) return false;
    return true;
  });

  const tiers: Array<'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT'> = ['PRIMARY', 'SECONDARY', 'TERTIARY', 'NO_FIT'];

  for (const tier of tiers) {
    const matchingTier = candidates.filter((p) => {
      const fit = getPlayerFitTier(p, slot.acceptedPositions);
      return fit === tier;
    });

    if (matchingTier.length > 0) {
      matchingTier.sort((a, b) => {
        const aRating = getRoleRelevantRating(toPlayerWithRatings(a), slot.roleType);
        const bRating = getRoleRelevantRating(toPlayerWithRatings(b), slot.roleType);
        return bRating - aRating;
      });
      return { player: matchingTier[0], fitTier: tier };
    }
  }

  return null;
}

function formatFitTier(tier: string | null): string {
  switch (tier) {
    case 'PRIMARY': return '1st';
    case 'SECONDARY': return '2nd';
    case 'TERTIARY': return '3rd';
    case 'NO_FIT': return '';
    default: return '';
  }
}

export function computeLineupAssignment(input: {
  squadId: string;
  squadName: string;
  formationId: string | null;
  formationName: string | null;
  players: PlayerForLineup[];
  formationSlots: FormationSlotData[] | null;
  gameFormat: GameFormat;
}): LineupAssignment {
  const { squadId, squadName, formationId, formationName, players, formationSlots, gameFormat } = input;

  const slotRequirements = resolveSlots(formationSlots, gameFormat);
  const assignedPlayerIds = new Set<string>();

  const slots: LineupSlot[] = [];

  for (const slot of slotRequirements) {
    const savedSlotPlayer = players.find(
      (p) => p.assignedSlotIndex === slot.slotIndex && p.assignedSlotIndex !== null,
    );

    if (savedSlotPlayer) {
      assignedPlayerIds.add(savedSlotPlayer.playerId);
      slots.push({
        slotIndex: slot.slotIndex,
        roleType: slot.roleType,
        label: slot.label,
        acceptedPositions: slot.acceptedPositions,
        gridX: slot.gridX,
        gridY: slot.gridY,
        player: {
          playerId: savedSlotPlayer.playerId,
          firstName: savedSlotPlayer.firstName,
          lastName: savedSlotPlayer.lastName,
          primaryPosition: savedSlotPlayer.primaryPosition,
          overallLevel: savedSlotPlayer.overallLevel,
          isGK: savedSlotPlayer.isGK,
          positionFitTier: savedSlotPlayer.positionFitTier,
          selectionReason: savedSlotPlayer.selectionReason,
          locked: savedSlotPlayer.locked,
        },
      });
      continue;
    }

    const roleMatchPlayer = players.find(
      (p) =>
        !assignedPlayerIds.has(p.playerId) &&
        p.assignedRoleType === slot.roleType &&
        p.assignedSlotIndex === null,
    );

    if (roleMatchPlayer) {
      assignedPlayerIds.add(roleMatchPlayer.playerId);
      slots.push({
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
      });
      continue;
    }

    const derived = findBestCandidate(players, slot, assignedPlayerIds);
    if (derived) {
      assignedPlayerIds.add(derived.player.playerId);
      slots.push({
        slotIndex: slot.slotIndex,
        roleType: slot.roleType,
        label: slot.label,
        acceptedPositions: slot.acceptedPositions,
        gridX: slot.gridX,
        gridY: slot.gridY,
        player: {
          playerId: derived.player.playerId,
          firstName: derived.player.firstName,
          lastName: derived.player.lastName,
          primaryPosition: derived.player.primaryPosition,
          overallLevel: derived.player.overallLevel,
          isGK: derived.player.isGK,
          positionFitTier: derived.player.positionFitTier ?? derived.fitTier,
          selectionReason: derived.player.selectionReason || getDerivedReason(derived.player, slot, derived.fitTier),
          locked: derived.player.locked,
        },
      });
      continue;
    }

    slots.push({
      slotIndex: slot.slotIndex,
      roleType: slot.roleType,
      label: slot.label,
      acceptedPositions: slot.acceptedPositions,
      gridX: slot.gridX,
      gridY: slot.gridY,
      player: null,
    });
  }

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

function getDerivedReason(
  player: PlayerForLineup,
  slot: SlotWithGrid,
  fitTier: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT',
): string {
  const positionLabel = slot.label || slot.roleType;
  switch (fitTier) {
    case 'PRIMARY':
      return `Primary ${positionLabel.toLowerCase()} fit`;
    case 'SECONDARY':
      return `Secondary-position ${positionLabel.toLowerCase()} fit`;
    case 'TERTIARY':
      return `Emergency ${positionLabel.toLowerCase()} cover`;
    case 'NO_FIT':
      return player.isGK ? 'Goalkeeper' : 'Flexible placement';
  }
}

export { formatFitTier, getPlayerFitTier, resolveSlots };