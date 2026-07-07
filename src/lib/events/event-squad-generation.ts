import type {
  PlayerAttributeProfile,
  GameFormat,
  EventSquadIntent,
  EventSquadAssignment,
  BroadPosition,
  GenerationInput,
  GenerationOutput,
  FormationSlotRequirement,
} from './event-types';
import { computeCompositeRatings, isGoalkeeperCapable, getPlayerBroadPositions } from './event-types';
import { getPositionFitTier, FIT_TIER_PRIORITY, computePositionScarcity } from '@/lib/players/player-position-resolver';
import type { PositionFitTier } from '@/lib/players/player-position-resolver';
import { computeSquadBalance } from './event-balance';

type SlotAssignment = {
  slotIndex: number;
  roleType: string;
  label: string;
  acceptedPositions: BroadPosition[];
  assignedPlayerId: string | null;
};

type PlayerWithRatings = PlayerAttributeProfile & {
  ratings: ReturnType<typeof computeCompositeRatings>;
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

function getSlotRequirements(
  formation: { slots: FormationSlotRequirement[] } | null,
  gameFormat: GameFormat,
): FormationSlotRequirement[] {
  if (formation && formation.slots.length > 0) {
    return formation.slots;
  }
  return getDefaultSlotRequirements(gameFormat);
}

function getDefaultSlotRequirements(gameFormat: GameFormat): FormationSlotRequirement[] {
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

function getSlotPriority(slot: FormationSlotRequirement): number {
  const priorityOrder: Record<string, number> = {
    GOALKEEPER: 0,
    DEFENDER: 1,
    DEFENSIVE_MIDFIELDER: 2,
    MIDFIELDER: 3,
    ATTACKING_MIDFIELDER: 4,
    FORWARD: 5,
    FREE: 6,
  };
  return priorityOrder[slot.roleType] ?? 3;
}

function sortBySkill(a: PlayerWithRatings, b: PlayerWithRatings): number {
  const aOverall = a.ratings.overallLevel ?? 0;
  const bOverall = b.ratings.overallLevel ?? 0;
  if (bOverall !== aOverall) return bOverall - aOverall;
  const aNulls = [a.ballControl, a.passing, a.effort].filter((v) => v === null).length;
  const bNulls = [b.ballControl, b.passing, b.effort].filter((v) => v === null).length;
  return aNulls - bNulls;
}

function findBestFitPlayer(
  availablePlayers: PlayerWithRatings[],
  acceptedPositions: BroadPosition[],
  _scarcityProtectedPositions: Set<string>,
): { player: PlayerWithRatings; fitTier: PositionFitTier } | null {
  const candidates = availablePlayers
    .map((p) => ({
      player: p,
      fitTier: getPositionFitTier(
        p.primaryPosition,
        p.secondaryPosition,
        p.tertiaryPosition,
        acceptedPositions,
      ),
    }))
    .filter((c) => c.fitTier !== 'NO_FIT');

  candidates.sort((a, b) => {
    const tierDiff = FIT_TIER_PRIORITY[a.fitTier] - FIT_TIER_PRIORITY[b.fitTier];
    if (tierDiff !== 0) return tierDiff;
    return sortBySkill(a.player, b.player);
  });

  if (candidates.length > 0) {
    return { player: candidates[0].player, fitTier: candidates[0].fitTier };
  }

  const flexibleCandidates = availablePlayers.filter((p) =>
    acceptedPositions.includes('flexible') || p.broadPositions.length === 0,
  );
  if (flexibleCandidates.length > 0) {
    flexibleCandidates.sort(sortBySkill);
    return { player: flexibleCandidates[0], fitTier: 'NO_FIT' };
  }

  return null;
}

export function generateEventSquads(input: GenerationInput): GenerationOutput {
  const { selectionPattern, players, squads, lockedAssignments, gameFormat, formations, defaultFormationId } = input;

  const availablePlayers = players.filter((p) => p !== null).map(toPlayerWithRatings);
  const assignments: EventSquadAssignment[] = [];
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
    if (scarcity.note) {
      validationNotes.push(scarcity.note);
    }
  }

  switch (selectionPattern) {
    case 'ALL_BALANCED':
      distributeAllBalanced(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo);
      break;
    case 'ONE_COMPETITIVE_BALANCED_REMAINDER':
      distributeOneCompetitiveBalancedRemainder(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo);
      break;
    case 'MANUAL_SEED_AUTO_BALANCE':
      distributeAllBalanced(remainingPlayers, squads, assignments, gameFormat, validationNotes, formations, defaultFormationId, scarcityInfo);
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

  return {
    assignments,
    balanceSummaries,
    validationNotes,
    warnings,
  };
}

function fillSquadSlots(
  squadId: string,
  slots: FormationSlotRequirement[],
  players: PlayerWithRatings[],
  assignedGlobal: Set<string>,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
  isCompetitive: boolean,
): EventSquadAssignment[] {
  const assignments: EventSquadAssignment[] = [];
  const assignedInSquad = new Set<string>();
  const slotAssignments: SlotAssignment[] = slots.map((slot, i) => ({
    slotIndex: i,
    roleType: slot.roleType,
    label: slot.label,
    acceptedPositions: slot.acceptedPositions,
    assignedPlayerId: null,
  }));

  const sortedSlots = [...slotAssignments].sort(
    (a, b) => getSlotPriority(a) - getSlotPriority(b),
  );

  const scarcePositions = new Set(
    scarcityInfo.filter((s) => s.isScarce).map((s) => s.position),
  );

  for (const slot of sortedSlots) {
    const availableForSlot = players.filter(
      (p) => !assignedGlobal.has(p.playerId) && !assignedInSquad.has(p.playerId),
    );

    const result = findBestFitPlayer(availableForSlot, slot.acceptedPositions, scarcePositions);

    if (result) {
      slot.assignedPlayerId = result.player.playerId;
      assignedInSquad.add(result.player.playerId);
      assignedGlobal.add(result.player.playerId);

      const reason = isCompetitive
        ? buildCompetitiveSlotReason(result.player, slot, result.fitTier)
        : buildBalancedSlotReason(result.player, slot, result.fitTier);

      assignments.push({
        playerId: result.player.playerId,
        eventSquadId: squadId,
        assignedRoleType: slot.roleType,
        assignedPositionId: slot.label,
        source: 'AUTO',
        locked: false,
        selectionReason: reason,
        positionFitTier: result.fitTier,
      });
    }
  }

  return assignments;
}

function buildCompetitiveSlotReason(
  player: PlayerWithRatings,
  slot: SlotAssignment,
  fitTier: PositionFitTier,
): string {
  if (player.isGoalkeeper && slot.acceptedPositions.includes('goalkeeper')) {
    return 'Selected for goalkeeper coverage (primary fit)';
  }

  if (player.ratings.overallLevel === null) {
    return `Rating uncertainty: player has missing attributes${fitTier !== 'NO_FIT' ? ` (${fitTier.toLowerCase()} position fit)` : ''}`;
  }

  if (fitTier === 'PRIMARY') {
    return `Selected as ${slot.acceptedPositions[0]} fit for competitive formation (primary)`;
  }
  if (fitTier === 'SECONDARY') {
    return `Selected as ${slot.acceptedPositions[0]} fit for competitive formation (secondary)`;
  }
  if (fitTier === 'TERTIARY') {
    return `Selected as ${slot.acceptedPositions[0]} fit for competitive formation (tertiary)`;
  }
  return 'Selected as flexible player after core tactical roles were covered';
}

function buildBalancedSlotReason(
  player: PlayerWithRatings,
  slot: SlotAssignment,
  fitTier: PositionFitTier,
): string {
  const hasUncertainty = player.ratings.overallLevel === null;

  if (player.isGoalkeeper && slot.acceptedPositions.includes('goalkeeper')) {
    return 'Selected for goalkeeper coverage';
  }

  if (fitTier === 'NO_FIT') {
    if (hasUncertainty) {
      return 'Rating uncertainty: player has missing attributes';
    }
    return 'Selected to balance remaining squads';
  }

  const tierLabel = fitTier === 'PRIMARY' ? 'primary' : fitTier === 'SECONDARY' ? 'secondary' : 'tertiary';
  const uncertaintySuffix = hasUncertainty ? ' (rating uncertainty)' : '';
  return `Selected as ${slot.acceptedPositions[0]} fit (${tierLabel} position)${uncertaintySuffix}`;
}

function distributeAllBalanced(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  gameFormat: GameFormat,
  notes: string[],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
): void {
  if (squads.length === 0 || players.length === 0) return;

  const assignedGlobal = new Set(assignments.map((a) => a.playerId));

  const gkPlayers = players.filter((p) => !assignedGlobal.has(p.playerId) && p.isGoalkeeper);
  gkPlayers.sort(sortBySkill);

  for (let i = 0; i < gkPlayers.length; i++) {
    const gk = gkPlayers[i];
    const targetSquad = squads[i % squads.length];
    const formation = getFormationForSquad(targetSquad, formations, defaultFormationId);
    const slots = getSlotRequirements(formation, gameFormat);
    const gkSlot = slots.find((s) => s.acceptedPositions.includes('goalkeeper'));

    assignedGlobal.add(gk.playerId);
    assignments.push({
      playerId: gk.playerId,
      eventSquadId: targetSquad.id,
      assignedRoleType: gkSlot?.roleType ?? 'GOALKEEPER',
      assignedPositionId: gkSlot?.label ?? 'Goalkeeper',
      source: 'AUTO',
      locked: false,
      selectionReason: gk.isGoalkeeper ? 'Selected for goalkeeper coverage' : 'Selected for goalkeeper coverage',
      positionFitTier: gk.primaryPosition === 'GK' ? 'PRIMARY' : 'SECONDARY',
    });
  }

  for (const squad of squads) {
    const formation = getFormationForSquad(squad, formations, defaultFormationId);
    const slotRequirements = getSlotRequirements(formation, gameFormat);
    const gkSlotIdx = slotRequirements.findIndex((s) => s.acceptedPositions.includes('goalkeeper'));

    const nonGkSlots = gkSlotIdx >= 0
      ? slotRequirements.filter((_, i) => i !== gkSlotIdx)
      : slotRequirements;

    const squadAssignments = fillSquadSlots(
      squad.id,
      nonGkSlots,
      players,
      assignedGlobal,
      scarcityInfo,
      false,
    );

    for (const assignment of squadAssignments) {
      assignments.push(assignment);
    }
  }

  const remainingPlayers = players.filter(
    (p) => !assignedGlobal.has(p.playerId),
  );

  if (remainingPlayers.length > 0) {
    distributeRemainingByBalance(remainingPlayers, squads, assignments, assignedGlobal);
  }
}

function distributeOneCompetitiveBalancedRemainder(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  gameFormat: GameFormat,
  notes: string[],
  formations: (Formation & { slots: FormationSlot[] })[],
  defaultFormationId: string | null,
  scarcityInfo: ReturnType<typeof computePositionScarcity>,
): void {
  const competitiveSquad = squads.find((s) => s.intent === 'COMPETITIVE');
  const balancedSquads = squads.filter((s) => s.intent !== 'COMPETITIVE');

  if (!competitiveSquad) {
    notes.push('No competitive squad found for ONE_COMPETITIVE_BALANCED_REMAINDER pattern');
    distributeAllBalanced(players, squads, assignments, gameFormat, notes, formations, defaultFormationId, scarcityInfo);
    return;
  }

  const assignedGlobal = new Set(assignments.map((a) => a.playerId));

  const competitiveFormation = getFormationForSquad(competitiveSquad, formations, defaultFormationId);
  const competitiveSlots = getSlotRequirements(competitiveFormation, gameFormat);

  const competitiveAssignments = fillSquadSlots(
    competitiveSquad.id,
    competitiveSlots,
    players,
    assignedGlobal,
    scarcityInfo,
    true,
  );

  for (const assignment of competitiveAssignments) {
    assignments.push(assignment);
  }

  const competitiveTarget = competitiveSquad.targetSize;
  const competitiveAssigned = assignments.filter((a) => a.eventSquadId === competitiveSquad.id).length;

  if (competitiveAssigned < competitiveTarget) {
    const remainingForCompetitive = players.filter(
      (p) => !assignedGlobal.has(p.playerId),
    );
    remainingForCompetitive.sort(sortBySkill);

    for (const player of remainingForCompetitive) {
      if (assignments.filter((a) => a.eventSquadId === competitiveSquad.id).length >= competitiveTarget) break;
      assignedGlobal.add(player.playerId);
      assignments.push({
        playerId: player.playerId,
        eventSquadId: competitiveSquad.id,
        assignedRoleType: null,
        assignedPositionId: null,
        source: 'AUTO',
        locked: false,
        selectionReason: 'Selected for competitive squad based on overall level',
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
    );
  }
}

function distributeRemainingByBalance(
  players: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  assignedGlobal: Set<string>,
): void {
  const sorted = [...players].sort(sortBySkill);

  const squadCounts = new Map<string, number>();
  for (const squad of squads) {
    squadCounts.set(squad.id, assignments.filter((a) => a.eventSquadId === squad.id).length);
  }

  for (const player of sorted) {
    const targetSquads = squads
      .filter((s) => {
        const currentCount = squadCounts.get(s.id) ?? 0;
        return currentCount < (s.maxSize ?? s.targetSize);
      })
      .sort((a, b) => {
        const aCount = squadCounts.get(a.id) ?? 0;
        const bCount = squadCounts.get(b.id) ?? 0;
        return aCount - bCount;
      });

    if (targetSquads.length === 0) {
      continue;
    }

    const targetSquad = targetSquads[0];
    assignedGlobal.add(player.playerId);
    const hasUncertainty = player.ratings.overallLevel === null;
    assignments.push({
      playerId: player.playerId,
      eventSquadId: targetSquad.id,
      assignedRoleType: null,
      assignedPositionId: null,
      source: 'AUTO',
      locked: false,
      selectionReason: hasUncertainty ? 'Rating uncertainty: player has missing attributes' : 'Selected to balance remaining squads',
      positionFitTier: 'NO_FIT',
    });
    squadCounts.set(targetSquad.id, (squadCounts.get(targetSquad.id) ?? 0) + 1);
  }
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

type Formation = import('@/generated/prisma/client').Formation;
type FormationSlot = import('@/generated/prisma/client').FormationSlot;

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