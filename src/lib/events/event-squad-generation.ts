import type {
  PlayerAttributeProfile,
  GameFormat,
  EventSquadIntent,
  EventSquadAssignment,
  BroadPosition,
  GenerationInput,
  GenerationOutput,
  FormationSlotRequirement,
  CompositeRatings,
} from './event-types';
import type { Formation, FormationSlot } from '@/generated/prisma/client';
import { computeCompositeRatings, isGoalkeeperCapable, getPlayerBroadPositions } from './event-types';
import { getPositionFitTier, computePositionScarcity } from '@/lib/players/player-position-resolver';
import type { PositionFitTier } from '@/lib/players/player-position-resolver';
import { computeSquadBalance } from './event-balance';

export type PlayerWithRatings = PlayerAttributeProfile & {
  ratings: CompositeRatings;
  broadPositions: BroadPosition[];
  isGoalkeeper: boolean;
};

function toPlayerWithRatings(player: PlayerAttributeProfile): PlayerWithRatings {
  return {
    ...player,
    ratings: computeCompositeRatings(player),
    broadPositions: getPlayerBroadPositions(player),
    isGoalkeeper: isGoalkeeperCapable(player),
  };
}

type SlotCandidate = {
  player: PlayerWithRatings;
  fitTier: PositionFitTier;
  roleRelevantRating: number;
};

type RoleRelevantRatingWeights = Record<string, (keyof CompositeRatings | null)[]>;

const ROLE_RELEVANT_RATING_WEIGHTS: RoleRelevantRatingWeights = {
  GOALKEEPER: ['goalkeeperAbility', 'gameUnderstanding', 'intensity', null],
  DEFENDER: ['defending', 'gameUnderstanding', 'intensity', 'teamplay', null],
  DEFENSIVE_MIDFIELDER: ['gameUnderstanding', 'defending', 'intensity', 'teamplay', null],
  MIDFIELDER: ['teamplay', 'gameUnderstanding', 'attacking', 'intensity', null],
  ATTACKING_MIDFIELDER: ['attacking', 'gameUnderstanding', 'teamplay', null],
  FORWARD: ['attacking', 'intensity', 'gameUnderstanding', null],
  FREE: [],
};

export function getRoleRelevantRating(player: PlayerWithRatings, roleType: string): number {
  const weights = ROLE_RELEVANT_RATING_WEIGHTS[roleType] ?? [];
  if (weights.length === 0) {
    return player.ratings.overallLevel ?? 0;
  }

  const values: number[] = [];
  for (const key of weights) {
    if (key === null) {
      values.push(player.ratings.overallLevel ?? 0);
      break;
    }
    if (key === 'goalkeeperAbility') {
      values.push(player.goalkeeperAbility === 'YES' ? 10 : player.goalkeeperAbility === 'EMERGENCY' ? 6 : 2);
      continue;
    }
    const val = player.ratings[key];
    if (val !== null && val !== undefined) {
      values.push(val);
    }
  }

  if (values.length === 0) {
    return player.ratings.overallLevel ?? 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getSlotRequirements(
  formation: { slots: FormationSlotRequirement[] } | null,
  gameFormat: GameFormat,
): FormationSlotRequirement[] {
  if (formation && formation.slots.length > 0) {
    return formation.slots;
  }
  return getDefaultSlotRequirements(gameFormat);
}

export function getDefaultSlotRequirements(gameFormat: GameFormat): FormationSlotRequirement[] {
  switch (gameFormat) {
    case 'THREE_A_SIDE':
      return [
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Forward' },
      ];
    case 'FIVE_A_SIDE':
      return [
        { roleType: 'GOALKEEPER', acceptedPositions: ['goalkeeper'], label: 'Goalkeeper' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Forward' },
        { roleType: 'FREE', acceptedPositions: ['flexible'], label: 'Flexible' },
      ];
    case 'SEVEN_A_SIDE':
      return [
        { roleType: 'GOALKEEPER', acceptedPositions: ['goalkeeper'], label: 'Goalkeeper' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward', 'defender'], label: 'Midfielder' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Forward' },
        { roleType: 'FREE', acceptedPositions: ['flexible'], label: 'Flexible' },
      ];
    case 'NINE_A_SIDE':
      return [
        { roleType: 'GOALKEEPER', acceptedPositions: ['goalkeeper'], label: 'Goalkeeper' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'defender', 'forward'], label: 'Midfielder' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Midfielder' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Forward' },
        { roleType: 'FORWARD', acceptedPositions: ['forward'], label: 'Forward' },
      ];
    case 'ELEVEN_A_SIDE':
      return [
        { roleType: 'GOALKEEPER', acceptedPositions: ['goalkeeper'], label: 'Goalkeeper' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'defender'], label: 'Defensive midfielder' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder'], label: 'Midfielder' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward'], label: 'Attacking midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Winger' },
        { roleType: 'FORWARD', acceptedPositions: ['forward'], label: 'Forward' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Winger' },
      ];
    default:
      return [
        { roleType: 'GOALKEEPER', acceptedPositions: ['goalkeeper'], label: 'Goalkeeper' },
        { roleType: 'DEFENDER', acceptedPositions: ['defender', 'midfielder'], label: 'Defender' },
        { roleType: 'MIDFIELDER', acceptedPositions: ['midfielder', 'forward', 'defender'], label: 'Midfielder' },
        { roleType: 'FORWARD', acceptedPositions: ['forward', 'midfielder'], label: 'Forward' },
      ];
  }
}

type BroadRole = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'flexible';

function slotToBroadRole(slot: FormationSlotRequirement): BroadRole {
  const roleType = slot.roleType.toUpperCase();
  if (roleType === 'GOALKEEPER') return 'goalkeeper';
  if (roleType === 'DEFENDER' || roleType === 'DEFENSIVE_MIDFIELDER') return 'defender';
  if (roleType === 'FORWARD' || roleType === 'ATTACKING_MIDFIELDER') return 'forward';
  if (roleType === 'MIDFIELDER') return 'midfielder';
  if (roleType === 'FREE') return 'flexible';
  if (slot.acceptedPositions.includes('goalkeeper')) return 'goalkeeper';
  if (slot.acceptedPositions.includes('defender')) return 'defender';
  if (slot.acceptedPositions.includes('forward')) return 'forward';
  if (slot.acceptedPositions.includes('midfielder')) return 'midfielder';
  return 'flexible';
}

function playerPrimaryBroadRole(player: PlayerWithRatings): BroadRole {
  if (player.isGoalkeeper && player.primaryPosition === 'GK') return 'goalkeeper';
  const broads = player.broadPositions;
  if (broads.length > 0) return broads[0];
  return 'flexible';
}

function getCandidatesForSlot(
  availablePlayers: PlayerWithRatings[],
  slot: FormationSlotRequirement,
  protectedRoles: Set<string>,
): {
  primary: SlotCandidate[];
  secondary: SlotCandidate[];
  tertiary: SlotCandidate[];
  noFit: SlotCandidate[];
} {
  const primary: SlotCandidate[] = [];
  const secondary: SlotCandidate[] = [];
  const tertiary: SlotCandidate[] = [];
  const noFit: SlotCandidate[] = [];

  for (const player of availablePlayers) {
    const fitTier = getPositionFitTier(
      player.primaryPosition,
      player.secondaryPosition,
      player.tertiaryPosition,
      slot.acceptedPositions,
    );
    const roleRating = getRoleRelevantRating(player, slot.roleType);

    const candidate: SlotCandidate = { player, fitTier, roleRelevantRating: roleRating };

    if (fitTier === 'NO_FIT') {
      if (slot.acceptedPositions.includes('flexible') || player.broadPositions.length === 0) {
        noFit.push(candidate);
      }
      continue;
    }

    const primaryRole = playerPrimaryBroadRole(player);
    if (protectedRoles.has(primaryRole) && primaryRole !== slotToBroadRole(slot)) {
      if (fitTier === 'TERTIARY') continue;
      if (fitTier === 'SECONDARY' && primaryRole !== 'flexible') continue;
    }

    if (fitTier === 'PRIMARY') primary.push(candidate);
    else if (fitTier === 'SECONDARY') secondary.push(candidate);
    else if (fitTier === 'TERTIARY') tertiary.push(candidate);
  }

  const sortByRating = (a: SlotCandidate, b: SlotCandidate) =>
    b.roleRelevantRating - a.roleRelevantRating;

  primary.sort(sortByRating);
  secondary.sort(sortByRating);
  tertiary.sort(sortByRating);
  noFit.sort(sortByRating);

  return { primary, secondary, tertiary, noFit };
}

function pickBestCandidate(
  availablePlayers: PlayerWithRatings[],
  slot: FormationSlotRequirement,
  protectedRoles: Set<string>,
): { player: PlayerWithRatings; fitTier: PositionFitTier } | null {
  const candidates = getCandidatesForSlot(availablePlayers, slot, protectedRoles);

  if (candidates.primary.length > 0) {
    return { player: candidates.primary[0].player, fitTier: 'PRIMARY' };
  }
  if (candidates.secondary.length > 0) {
    return { player: candidates.secondary[0].player, fitTier: 'SECONDARY' };
  }
  if (candidates.tertiary.length > 0) {
    return { player: candidates.tertiary[0].player, fitTier: 'TERTIARY' };
  }
  if (candidates.noFit.length > 0) {
    return { player: candidates.noFit[0].player, fitTier: 'NO_FIT' };
  }
  return null;
}

function buildSlotReason(
  player: PlayerWithRatings,
  slot: FormationSlotRequirement,
  fitTier: PositionFitTier,
  isCompetitive: boolean,
): string {
  const slotLabel = slot.label || slot.roleType;
  const hasUncertainty = player.ratings.overallLevel === null;

  if (player.isGoalkeeper && slot.acceptedPositions.includes('goalkeeper')) {
    return 'Selected for goalkeeper coverage (primary fit)';
  }

  if (fitTier === 'TERTIARY') {
    const broadRole = slot.acceptedPositions[0] ?? 'this position';
    return `Assigned as emergency ${broadRole} cover because no primary or secondary ${broadRole} was available`;
  }

  if (fitTier === 'SECONDARY') {
    return `Selected as secondary-position ${slotLabel.toLowerCase()} after primary ${slot.acceptedPositions[0] ?? 'candidates'} were exhausted`;
  }

  if (fitTier === 'NO_FIT') {
    if (hasUncertainty) {
      return 'Rating uncertainty: player has missing attributes';
    }
    return 'Selected as flexible player after core tactical roles were covered';
  }

  const tierLabel = 'primary';
  const uncertaintySuffix = hasUncertainty ? ' (rating uncertainty)' : '';
  if (isCompetitive) {
    return `Selected as ${slotLabel.toLowerCase()} fit for competitive formation (${tierLabel})${uncertaintySuffix}`;
  }
  return `Selected as primary-position ${slotLabel.toLowerCase()}${uncertaintySuffix}`;
}

function getFormationForSquad(
  squad: GenerationInput['squads'][0],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
): { slots: FormationSlotRequirement[] } | null {
  if (squad.formationId) {
    const formation = formations.find((f) => f.id === squad.formationId);
    if (formation) {
      return {
        slots: formation.slots.map((s) => ({
          roleType: s.roleType,
          acceptedPositions: (s.acceptedPositionIds as string[]) as BroadPosition[],
          label: s.label,
        })),
      };
    }
  }
  if (defaultFormationId) {
    const formation = formations.find((f) => f.id === defaultFormationId);
    if (formation) {
      return {
        slots: formation.slots.map((s) => ({
          roleType: s.roleType,
          acceptedPositions: (s.acceptedPositionIds as string[]) as BroadPosition[],
          label: s.label,
        })),
      };
    }
  }
  return null;
}

function distributeGoalkeepers(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  assignedGlobal: Set<string>,
  gameFormat: GameFormat,
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  _eventId: string,
): void {
  const gkPlayers = players.filter((p) => !assignedGlobal.has(p.playerId) && p.isGoalkeeper);
  gkPlayers.sort((a, b) => {
    if (a.primaryPosition === 'GK' && b.primaryPosition !== 'GK') return -1;
    if (b.primaryPosition === 'GK' && a.primaryPosition !== 'GK') return 1;
    return (b.ratings.overallLevel ?? 0) - (a.ratings.overallLevel ?? 0);
  });

  const slotsPerSquad = squads.map((squad) => {
    const formation = getFormationForSquad(squad, formations, defaultFormationId);
    return getSlotRequirements(formation, gameFormat);
  });

  for (let i = 0; i < gkPlayers.length && i < squads.length; i++) {
    const gk = gkPlayers[i];
    const squadIdx = i % squads.length;
    const squad = squads[squadIdx];
    const slots = slotsPerSquad[squadIdx];
    const gkSlot = slots.find((s) => s.acceptedPositions.includes('goalkeeper'));

    assignedGlobal.add(gk.playerId);
    assignments.push({
      playerId: gk.playerId,
      eventSquadId: squad.id,
      assignedRoleType: gkSlot?.roleType ?? 'GOALKEEPER',
      assignedPositionId: gkSlot?.label ?? 'Goalkeeper',
      assignedSlotIndex: gkSlot ? slots.indexOf(gkSlot) : null,
      assignedSlotLabel: gkSlot?.label ?? 'Goalkeeper',
      lineupOrder: 1,
      source: 'AUTO',
      locked: false,
      selectionReason: gk.primaryPosition === 'GK'
        ? 'Selected for goalkeeper coverage (primary fit)'
        : 'Selected for goalkeeper coverage (emergency goalkeeper)',
      positionFitTier: gk.primaryPosition === 'GK' ? 'PRIMARY' : 'SECONDARY',
    });
  }
}

type SlotWithSquad = {
  squadIdx: number;
  slotIdx: number;
  slot: FormationSlotRequirement;
  broadRole: BroadRole;
};

function distributeByRoleAcrossSquads(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  assignedGlobal: Set<string>,
  gameFormat: GameFormat,
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  _notes: string[],
  eventId: string,
): void {
  const slotsPerSquad = squads.map((squad) => {
    const formation = getFormationForSquad(squad, formations, defaultFormationId);
    const slots = getSlotRequirements(formation, gameFormat);
    const gkSlotIdx = slots.findIndex((s) => s.acceptedPositions.includes('goalkeeper'));
    return { squad, slots, gkSlotIdx, nonGkSlots: gkSlotIdx >= 0 ? slots.filter((_, i) => i !== gkSlotIdx) : slots };
  });

  const allSlots: SlotWithSquad[] = [];
  for (let squadIdx = 0; squadIdx < squads.length; squadIdx++) {
    for (let slotIdx = 0; slotIdx < slotsPerSquad[squadIdx].nonGkSlots.length; slotIdx++) {
      const slot = slotsPerSquad[squadIdx].nonGkSlots[slotIdx];
      allSlots.push({
        squadIdx,
        slotIdx,
        slot,
        broadRole: slotToBroadRole(slot),
      });
    }
  }

  const roleOrder: BroadRole[] = ['defender', 'midfielder', 'forward', 'flexible'];
  const rolesToProcess = new Set(roleOrder);

  const roleSlots = new Map<BroadRole, SlotWithSquad[]>();
  for (const slot of allSlots) {
    if (!roleSlots.has(slot.broadRole)) {
      roleSlots.set(slot.broadRole, []);
    }
    roleSlots.get(slot.broadRole)!.push(slot);
  }

  const scarcityInfo = computePositionScarcity(
    players.filter((p) => !assignedGlobal.has(p.playerId)),
    squads.length,
  );
  const protectedRoles = new Set(
    scarcityInfo.filter((s) => s.isScarce).map((s) => s.position),
  );

  for (const role of rolesToProcess) {
    const slotsForRole = roleSlots.get(role);
    if (!slotsForRole || slotsForRole.length === 0) continue;

    const _availableForRole = players.filter(
      (p) => !assignedGlobal.has(p.playerId),
    );

    let forward = true;
    let slotIdx = 0;

    while (slotIdx < slotsForRole.length) {
      const indices = forward
        ? Array.from({ length: squads.length }, (_, i) => i)
        : Array.from({ length: squads.length }, (_, i) => squads.length - 1 - i);

      let _assignedAny = false;
      for (const squadIdx of indices) {
        const squadSlots = slotsForRole.filter((s) => s.squadIdx === squadIdx);
        const squadSlot = squadSlots[slotIdx];
        if (!squadSlot) continue;

        const availableHere = players.filter((p) => !assignedGlobal.has(p.playerId));
        const result = pickBestCandidate(availableHere, squadSlot.slot, protectedRoles);

        if (result) {
          assignedGlobal.add(result.player.playerId);
          const fitTier = result.fitTier;
          assignments.push({
            playerId: result.player.playerId,
            eventSquadId: squads[squadIdx].id,
            assignedRoleType: squadSlot.slot.roleType,
            assignedPositionId: squadSlot.slot.label,
            assignedSlotIndex: slotsPerSquad[squadIdx].nonGkSlots.indexOf(squadSlot.slot),
            assignedSlotLabel: squadSlot.slot.label,
            lineupOrder: null,
            source: 'AUTO',
            locked: false,
            selectionReason: buildSlotReason(result.player, squadSlot.slot, fitTier, false),
            positionFitTier: fitTier,
          });
          _assignedAny = true;
        }
      }

      slotIdx++;
      forward = !forward;
    }
  }

  const remainingPlayers = players.filter((p) => !assignedGlobal.has(p.playerId));
  if (remainingPlayers.length > 0) {
    distributeRemainingByBalance(remainingPlayers, squads, assignments, assignedGlobal, eventId);
  }

  optimizeSwapsForBalance(players, squads, assignments, assignedGlobal);
}

function distributeRemainingByBalance(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  assignedGlobal: Set<string>,
  _eventId: string,
): void {
  const sorted = [...players].sort((a, b) => (b.ratings.overallLevel ?? 0) - (a.ratings.overallLevel ?? 0));

  const squadCounts = new Map<string, number>();
  const squadRatingSums = new Map<string, number>();
  for (const squad of squads) {
    const count = assignments.filter((a) => a.eventSquadId === squad.id).length;
    squadCounts.set(squad.id, count);
    const squadPlayers = assignments
      .filter((a) => a.eventSquadId === squad.id)
      .map((a) => players.find((p) => p.playerId === a.playerId))
      .filter((p): p is PlayerWithRatings => p !== undefined);
    const ratedSum = squadPlayers.reduce((s, p) => s + (p.ratings.overallLevel ?? 0), 0);
    squadRatingSums.set(squad.id, ratedSum);
  }

  for (const player of sorted) {
    const maxSquadSize = squads[0]?.maxSize ?? squads[0]?.targetSize ?? 7;
    const targetSquads = squads
      .filter((s) => {
        const currentCount = squadCounts.get(s.id) ?? 0;
        return currentCount < maxSquadSize;
      })
      .sort((a, b) => {
        const aCount = squadCounts.get(a.id) ?? 0;
        const bCount = squadCounts.get(b.id) ?? 0;
        if (aCount !== bCount) return aCount - bCount;
        const aRating = squadRatingSums.get(a.id) ?? 0;
        const bRating = squadRatingSums.get(b.id) ?? 0;
        return aRating - bRating;
      });

    if (targetSquads.length === 0) continue;

    const targetSquad = targetSquads[0];
    const playerRating = player.ratings.overallLevel ?? 0;
    assignedGlobal.add(player.playerId);
    const hasUncertainty = player.ratings.overallLevel === null;
    assignments.push({
      playerId: player.playerId,
      eventSquadId: targetSquad.id,
      assignedRoleType: null,
      assignedPositionId: null,
      assignedSlotIndex: null,
      assignedSlotLabel: null,
      lineupOrder: null,
      source: 'AUTO',
      locked: false,
      selectionReason: hasUncertainty
        ? 'Rating uncertainty: player has missing attributes'
        : 'Selected to balance remaining squads',
      positionFitTier: 'NO_FIT',
    });
    squadCounts.set(targetSquad.id, (squadCounts.get(targetSquad.id) ?? 0) + 1);
    squadRatingSums.set(targetSquad.id, (squadRatingSums.get(targetSquad.id) ?? 0) + playerRating);
  }
}

function optimizeSwapsForBalance(
  allPlayers: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  assignedGlobal: Set<string>,
): void {
  const maxIterations = 50;
  const lockedPlayerIds = new Set(
    assignments.filter((a) => a.locked).map((a) => a.playerId),
  );
  const playerMap = new Map(allPlayers.map((p) => [p.playerId, p]));

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    for (let i = 0; i < squads.length; i++) {
      for (let j = i + 1; j < squads.length; j++) {
        const squadIAssignments = assignments.filter((a) => a.eventSquadId === squads[i].id);
        const squadJAssignments = assignments.filter((a) => a.eventSquadId === squads[j].id);

        if (Math.abs(squadIAssignments.length - squadJAssignments.length) > 1) continue;

        const ratedI = squadIAssignments
          .map((a) => playerMap.get(a.playerId))
          .filter((p): p is PlayerWithRatings => p !== undefined && p.ratings.overallLevel !== null);
        const ratedJ = squadJAssignments
          .map((a) => playerMap.get(a.playerId))
          .filter((p): p is PlayerWithRatings => p !== undefined && p.ratings.overallLevel !== null);

        const avgI = ratedI.length > 0 ? ratedI.reduce((s, p) => s + p.ratings.overallLevel!, 0) / ratedI.length : 0;
        const avgJ = ratedJ.length > 0 ? ratedJ.reduce((s, p) => s + p.ratings.overallLevel!, 0) / ratedJ.length : 0;
        const currentSpread = Math.abs(avgI - avgJ);

        for (const aI of squadIAssignments) {
          if (lockedPlayerIds.has(aI.playerId)) continue;
          if (aI.positionFitTier === 'PRIMARY') continue;

          for (const aJ of squadJAssignments) {
            if (lockedPlayerIds.has(aJ.playerId)) continue;
            if (aJ.positionFitTier === 'PRIMARY') continue;

            const playerI = playerMap.get(aI.playerId);
            const playerJ = playerMap.get(aJ.playerId);
            if (!playerI || !playerJ) continue;

            const ratingI = playerI.ratings.overallLevel ?? 0;
            const ratingJ = playerJ.ratings.overallLevel ?? 0;

            if (ratingI === ratingJ) continue;

            const newRatedI = ratedI.filter((p) => p.playerId !== aI.playerId);
            newRatedI.push(...(playerJ.ratings.overallLevel !== null ? [playerJ] : []));
            const newRatedJ = ratedJ.filter((p) => p.playerId !== aJ.playerId);
            newRatedJ.push(...(playerI.ratings.overallLevel !== null ? [playerI] : []));

            const newAvgI = newRatedI.length > 0 ? newRatedI.reduce((s, p) => s + p.ratings.overallLevel!, 0) / newRatedI.length : 0;
            const newAvgJ = newRatedJ.length > 0 ? newRatedJ.reduce((s, p) => s + p.ratings.overallLevel!, 0) / newRatedJ.length : 0;
            const newSpread = Math.abs(newAvgI - newAvgJ);

            if (newSpread < currentSpread - 0.01) {
              aI.eventSquadId = squads[j].id;
              aJ.eventSquadId = squads[i].id;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
      if (!improved) break;
    }
    if (!improved) break;
  }
  void assignedGlobal;
}

type InternalAssignment = Omit<EventSquadAssignment, 'eventId'>;

export function generateEventSquads(input: GenerationInput): GenerationOutput {
  const { selectionPattern, players, squads, lockedAssignments, gameFormat, formations, defaultFormationId } = input;

  const availablePlayers = players.filter((p) => p !== null).map(toPlayerWithRatings);
  const assignments: InternalAssignment[] = [];
  const validationNotes: string[] = [];
  const warnings: string[] = [];

  const lockedPlayerIds = new Set(lockedAssignments.keys());

  const unlockedPlayers = availablePlayers.filter((p) => !lockedPlayerIds.has(p.playerId));

  for (const [playerId, squadId] of lockedAssignments) {
    const player = availablePlayers.find((p) => p.playerId === playerId);
    if (player) {
      const squad = squads.find((s) => s.id === squadId);
      if (squad) {
        assignments.push({
          playerId,
          eventSquadId: squadId,
          assignedRoleType: null,
          assignedPositionId: null,
          assignedSlotIndex: null,
          assignedSlotLabel: null,
          lineupOrder: null,
          source: 'LOCKED',
          locked: true,
          selectionReason: 'Kept because assignment was locked by coach',
          positionFitTier: null,
        });
      }
    }
  }

  const assignedPlayerIds = new Set(assignments.map((a) => a.playerId));
  const remainingPlayers = unlockedPlayers.filter((p) => !assignedPlayerIds.has(p.playerId));

  const scarcityInfo = computePositionScarcity(remainingPlayers, squads.length);
  for (const scarcity of scarcityInfo) {
    if (scarcity.isScarce && scarcity.note) {
      validationNotes.push(scarcity.note);
    }
  }

  switch (selectionPattern) {
    case 'ALL_BALANCED':
      distributeAllBalanced(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo, input.eventId);
      break;
    case 'ONE_COMPETITIVE_BALANCED_REMAINDER':
      distributeOneCompetitiveBalancedRemainder(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo, input.eventId);
      break;
    case 'MANUAL_SEED_AUTO_BALANCE':
      distributeAllBalanced(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo, input.eventId);
      break;
    case 'PRESERVE_AND_FILL':
      distributePreserveAndFill(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo, input.eventId, availablePlayers);
      break;
  }

  const duplicates = assignments.filter(
    (a, i) => assignments.findIndex((b) => b.playerId === a.playerId) !== i,
  );
  if (duplicates.length > 0) {
    warnings.push(
      `Duplicate player assignments detected: ${duplicates.map((d) => d.playerId).join(', ')}`,
    );
  }

  const balanceSummaries = squads.map((squad) => {
    const squadAssignments = assignments.filter((a) => a.eventSquadId === squad.id);
    const squadPlayers = squadAssignments
      .map((a) => availablePlayers.find((p) => p.playerId === a.playerId))
      .filter((p): p is PlayerWithRatings => p !== undefined);
    return computeSquadBalance(squad.id, squad.name, squad.intent as EventSquadIntent, squadPlayers);
  });

  const ratedAvgs = balanceSummaries
    .map((b) => b.averageOverall)
    .filter((v): v is number => v !== null);
  if (ratedAvgs.length >= 2) {
    const maxAvg = Math.max(...ratedAvgs);
    const minAvg = Math.min(...ratedAvgs);
    const spread = maxAvg - minAvg;
    if (spread > 0.8) {
      const squadLabels = balanceSummaries.map(
        (b) => `${b.squadName}: ${b.averageOverall !== null ? b.averageOverall.toFixed(1) : 'N/A'}`,
      );
      if (selectionPattern === 'ALL_BALANCED') {
        warnings.push(
          `Balanced squad rating spread is high: ${squadLabels.join(', ')}`,
        );
      } else {
        validationNotes.push(
          `Squad rating spread: ${squadLabels.join(', ')}`,
        );
      }
    }
  }

  return {
    assignments: assignments.map((a) => ({ ...a, eventId: input.eventId })),
    balanceSummaries,
    validationNotes,
    warnings,
  };
}

function distributeAllBalanced(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  gameFormat: GameFormat,
  notes: string[],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
  eventId: string,
): void {
  if (squads.length === 0 || players.length === 0) return;

  const assignedGlobal = new Set(assignments.map((a) => a.playerId));

  distributeGoalkeepers(players, squads, assignments, assignedGlobal, gameFormat, formations, defaultFormationId, eventId);

  const _protectedRoles = new Set(
    scarcityInfo.filter((s) => s.isScarce).map((s) => s.position),
  );

  distributeByRoleAcrossSquads(players, squads, assignments, assignedGlobal, gameFormat, formations, defaultFormationId, notes, eventId);
}

function distributePreserveAndFill(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  gameFormat: GameFormat,
  notes: string[],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
  eventId: string,
  allAvailablePlayers: PlayerWithRatings[],
): void {
  if (squads.length === 0 || players.length === 0) return;

  const assignedGlobal = new Set(assignments.map((a) => a.playerId));

  const unassigned = players.filter((p) => !assignedGlobal.has(p.playerId));
  if (unassigned.length === 0) return;

  const squadsWithSpace = squads.map((squad) => {
    const currentCount = assignments.filter((a) => a.eventSquadId === squad.id).length;
    const maxSlots = squad.maxSize ?? squad.targetSize;
    const space = Math.max(0, maxSlots - currentCount);
    return { squad, currentCount, space };
  });

  const goalkeepers = unassigned.filter((p) => p.isGoalkeeper);
  const nonGKs = unassigned.filter((p) => !p.isGoalkeeper);

  const allGKPlayerIds = new Set(allAvailablePlayers.filter((p) => p.isGoalkeeper).map((p) => p.playerId));

  const squadsNeedingGK = squadsWithSpace.filter((s) => {
    const hasGK = assignments.some(
      (a) => a.eventSquadId === s.squad.id && allGKPlayerIds.has(a.playerId),
    );
    return !hasGK && s.space > 0;
  });

  const assignedGKs = new Set<string>();
  for (const s of squadsNeedingGK) {
    if (goalkeepers.length === 0) break;
    const availableGKs = goalkeepers.filter((gk) => !assignedGKs.has(gk.playerId));
    if (availableGKs.length === 0) break;
    const gk = availableGKs[0];
    assignedGKs.add(gk.playerId);
    assignments.push({
      playerId: gk.playerId,
      eventSquadId: s.squad.id,
      assignedRoleType: 'GOALKEEPER',
      assignedPositionId: null,
      assignedSlotIndex: null,
      assignedSlotLabel: null,
      lineupOrder: null,
      source: 'AUTO',
      locked: false,
      selectionReason: 'Filled goalkeeper need in preserve-and-fill mode',
      positionFitTier: 'PRIMARY',
    });
    assignedGlobal.add(gk.playerId);
    s.currentCount++;
    s.space--;
  }

  const remainingPlayers = [...nonGKs, ...goalkeepers.filter((gk) => !assignedGKs.has(gk.playerId))];
  remainingPlayers.sort((a, b) => (b.ratings.overallLevel ?? 0) - (a.ratings.overallLevel ?? 0));

  for (const player of remainingPlayers) {
    if (assignedGlobal.has(player.playerId)) continue;

    const candidates = squadsWithSpace
      .filter((s) => s.space > 0)
      .sort((a, b) => a.currentCount - b.currentCount || (a.squad.targetSize - a.currentCount) - (b.squad.targetSize - b.currentCount));

    if (candidates.length === 0) {
      notes.push(`No squad space available for ${player.firstName} ${player.lastName ?? ''}. All squads are at maximum capacity.`);
      continue;
    }

    const target = candidates[0];

    const formation = getFormationForSquad(target.squad, formations, defaultFormationId);
    const slots = getSlotRequirements(formation, gameFormat);
    const bestSlot = findBestSlotForPlayer(player, slots, assignments.filter((a) => a.eventSquadId === target.squad.id));

    assignments.push({
      playerId: player.playerId,
      eventSquadId: target.squad.id,
      assignedRoleType: bestSlot?.roleType ?? null,
      assignedPositionId: null,
      assignedSlotIndex: bestSlot?.slotIndex ?? null,
      assignedSlotLabel: bestSlot?.label ?? null,
      lineupOrder: null,
      source: 'AUTO',
      locked: false,
      selectionReason: 'Filled empty slot in preserve-and-fill mode',
      positionFitTier: bestSlot?.fitTier ?? null,
    });

    assignedGlobal.add(player.playerId);
    target.currentCount++;
    target.space--;
  }

  void scarcityInfo;
  void eventId;
}

function findBestSlotForPlayer(
  player: PlayerWithRatings,
  slots: FormationSlotRequirement[],
  currentAssignments: InternalAssignment[],
): { roleType: string; label: string; slotIndex: number | null; fitTier: PositionFitTier } | null {
  const filledSlotIndices = new Set(currentAssignments.filter((a) => a.assignedSlotIndex !== null).map((a) => a.assignedSlotIndex));
  const emptySlots = slots
    .map((slot, index) => ({ ...slot, index }))
    .filter((s) => !filledSlotIndices.has(s.index));

  if (emptySlots.length === 0) return null;

  let bestSlot = null;
  let bestFitTier: PositionFitTier = 'NO_FIT';

  for (const slot of emptySlots) {
    const fitTier = getPositionFitTier(player.primaryPosition, player.secondaryPosition, player.tertiaryPosition, slot.acceptedPositions);
    if (fitTierPriority(fitTier) < fitTierPriority(bestFitTier)) {
      bestFitTier = fitTier;
      bestSlot = { roleType: slot.roleType, label: slot.label, slotIndex: slot.index, fitTier };
    }
  }

  return bestSlot;
}

function fitTierPriority(tier: PositionFitTier): number {
  switch (tier) {
    case 'PRIMARY': return 0;
    case 'SECONDARY': return 1;
    case 'TERTIARY': return 2;
    case 'NO_FIT': return 3;
    default: return 4;
  }
}

function distributeOneCompetitiveBalancedRemainder(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: InternalAssignment[],
  gameFormat: GameFormat,
  notes: string[],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
  eventId: string,
): void {
  const competitiveSquad = squads.find((s) => s.intent === 'COMPETITIVE');
  const balancedSquads = squads.filter((s) => s.intent !== 'COMPETITIVE');

  if (!competitiveSquad) {
    notes.push('No competitive squad found for ONE_COMPETITIVE_BALANCED_REMAINDER pattern');
    distributeAllBalanced(players, squads, assignments, gameFormat, notes, formations, defaultFormationId, scarcityInfo, eventId);
    return;
  }

  const assignedGlobal = new Set(assignments.map((a) => a.playerId));

  const competitiveFormation = getFormationForSquad(competitiveSquad, formations, defaultFormationId);
  const competitiveSlots = getSlotRequirements(competitiveFormation, gameFormat);

  const sortedSlots = [...competitiveSlots].sort((a, b) => {
    const priority: Record<string, number> = {
      GOALKEEPER: 0,
      DEFENDER: 1,
      DEFENSIVE_MIDFIELDER: 2,
      MIDFIELDER: 3,
      ATTACKING_MIDFIELDER: 4,
      FORWARD: 5,
      FREE: 6,
    };
    return (priority[a.roleType] ?? 3) - (priority[b.roleType] ?? 3);
  });

  for (const slot of sortedSlots) {
    const availableForSlot = players.filter(
      (p) => !assignedGlobal.has(p.playerId),
    );
    const result = pickBestCandidate(availableForSlot, slot, new Set());

    if (result) {
      assignedGlobal.add(result.player.playerId);
      const fitTier = result.fitTier;
      assignments.push({
        playerId: result.player.playerId,
        eventSquadId: competitiveSquad.id,
        assignedRoleType: slot.roleType,
        assignedPositionId: slot.label,
        assignedSlotIndex: competitiveSlots.indexOf(slot),
        assignedSlotLabel: slot.label,
        lineupOrder: null,
        source: 'AUTO',
        locked: false,
        selectionReason: buildSlotReason(result.player, slot, fitTier, true),
        positionFitTier: fitTier,
      });
    }
  }

  const competitiveTarget = competitiveSquad.targetSize;
  const competitiveAssigned = assignments.filter((a) => a.eventSquadId === competitiveSquad.id).length;

  if (competitiveAssigned < competitiveTarget) {
    const remainingForCompetitive = players.filter(
      (p) => !assignedGlobal.has(p.playerId),
    );
    remainingForCompetitive.sort((a, b) => (b.ratings.overallLevel ?? 0) - (a.ratings.overallLevel ?? 0));

    for (const player of remainingForCompetitive) {
      if (assignments.filter((a) => a.eventSquadId === competitiveSquad.id).length >= competitiveTarget) break;
      assignedGlobal.add(player.playerId);
      const hasUncertainty = player.ratings.overallLevel === null;
      assignments.push({
        playerId: player.playerId,
        eventSquadId: competitiveSquad.id,
        assignedRoleType: null,
        assignedPositionId: null,
        assignedSlotIndex: null,
        assignedSlotLabel: null,
        lineupOrder: null,
        source: 'AUTO',
        locked: false,
        selectionReason: hasUncertainty ? 'Rating uncertainty: player has missing attributes' : 'Selected for competitive squad based on overall level',
        positionFitTier: 'NO_FIT',
      });
    }
  }

  if (balancedSquads.length > 0) {
    distributeAllBalanced(
      players.filter((p) => !assignedGlobal.has(p.playerId)),
      balancedSquads,
      assignments,
      gameFormat,
      notes,
      formations,
      defaultFormationId,
      scarcityInfo,
      eventId,
    );
  }
}

export function getDefaultTargetSize(format: GameFormat): number {
  switch (format) {
    case 'THREE_A_SIDE': return 3;
    case 'FIVE_A_SIDE': return 5;
    case 'SEVEN_A_SIDE': return 7;
    case 'NINE_A_SIDE': return 9;
    case 'ELEVEN_A_SIDE': return 11;
    default: return 7;
  }
}

