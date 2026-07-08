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
  slot: { acceptedPositions: BroadPosition[] },
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
      selectionReason: 'Selected for goalkeeper coverage',
      positionFitTier: gk.primaryPosition === 'GK' ? 'PRIMARY' : 'SECONDARY',
    });
  }

  const allSlots = squads.map((squad) => {
    const formation = getFormationForSquad(squad, formations, defaultFormationId);
    const slotRequirements = getSlotRequirements(formation, gameFormat);
    const gkSlotIdx = slotRequirements.findIndex((s) => s.acceptedPositions.includes('goalkeeper'));
    const nonGkSlots = gkSlotIdx >= 0
      ? slotRequirements.filter((_, i) => i !== gkSlotIdx)
      : slotRequirements;
    return { squad, nonGkSlots };
  });

  const positionGroups = groupSlotsByPosition(allSlots);

  const allNonGkSlotRefs: Array<{ squadIdx: number; slotIdx: number; acceptedPositions: BroadPosition[] }> = [];
  for (const group of positionGroups) {
    for (const slotRef of group.slots) {
      allNonGkSlotRefs.push({ ...slotRef, acceptedPositions: group.acceptedPositions });
    }
  }

  const squadCount = squads.length;
  let forward = true;

  const perSquadSlotRefs: Map<number, Array<{ slotIdx: number; acceptedPositions: BroadPosition[] }>> = new Map();
  for (let i = 0; i < squadCount; i++) {
    perSquadSlotRefs.set(i, []);
  }
  for (const ref of allNonGkSlotRefs) {
    perSquadSlotRefs.get(ref.squadIdx)!.push({ slotIdx: ref.slotIdx, acceptedPositions: ref.acceptedPositions });
  }

  const squadSlotQueues: Array<Array<{ slotIdx: number; acceptedPositions: BroadPosition[] }>> = [];
  for (let i = 0; i < squadCount; i++) {
    squadSlotQueues.push(perSquadSlotRefs.get(i)!);
  }

  const slotSnakeOrder: Array<{ squadIdx: number; slotIdx: number; acceptedPositions: BroadPosition[] }> = [];
  const queueIdxs = new Array(squadCount).fill(0);

  let hasSlots = true;
  while (hasSlots) {
    hasSlots = false;
    const indices = forward
      ? Array.from({ length: squadCount }, (_, i) => i)
      : Array.from({ length: squadCount }, (_, i) => squadCount - 1 - i);

    for (const si of indices) {
      if (queueIdxs[si] < squadSlotQueues[si].length) {
        const entry = squadSlotQueues[si][queueIdxs[si]];
        slotSnakeOrder.push({ squadIdx: si, slotIdx: entry.slotIdx, acceptedPositions: entry.acceptedPositions });
        queueIdxs[si]++;
        hasSlots = true;
      }
    }
    forward = !forward;
  }

  for (const slotRef of slotSnakeOrder) {
    const slot = allSlots[slotRef.squadIdx].nonGkSlots[slotRef.slotIdx];
    if (!slot) continue;

    const candidates = players
      .filter((p) => !assignedGlobal.has(p.playerId))
      .filter((p) => slotRef.acceptedPositions.some((pos) =>
        getPlayerBroadPositions(p).includes(pos) || p.isGoalkeeper === false,
      ))
      .sort((a, b) => {
        const aFit = getBestFitTier(a, slotRef.acceptedPositions);
        const bFit = getBestFitTier(b, slotRef.acceptedPositions);
        const tierDiff = FIT_TIER_PRIORITY[aFit] - FIT_TIER_PRIORITY[bFit];
        if (tierDiff !== 0) return tierDiff;
        return (b.ratings.overallLevel ?? 0) - (a.ratings.overallLevel ?? 0);
      });

    if (candidates.length === 0) continue;

    const player = candidates[0];
    assignedGlobal.add(player.playerId);
    const fitTier = getBestFitTier(player, slot.acceptedPositions);
    assignments.push({
      playerId: player.playerId,
      eventSquadId: squads[slotRef.squadIdx].id,
      assignedRoleType: slot.roleType,
      assignedPositionId: slot.label,
      source: 'AUTO',
      locked: false,
      selectionReason: buildBalancedSlotReason(player, slot, fitTier),
      positionFitTier: fitTier,
    });
  }

  const remainingPlayers = players.filter(
    (p) => !assignedGlobal.has(p.playerId),
  );

  if (remainingPlayers.length > 0) {
    distributeRemainingByBalance(remainingPlayers, squads, assignments, assignedGlobal);
  }

  optimizeSwapsForBalance(players, squads, assignments, assignedGlobal);
}

function getBestFitTier(
  player: PlayerWithRatings,
  acceptedPositions: BroadPosition[],
): PositionFitTier {
  return getPositionFitTier(
    player.primaryPosition,
    player.secondaryPosition,
    player.tertiaryPosition,
    acceptedPositions,
  );
}

interface PositionSlotGroup {
  acceptedPositions: BroadPosition[];
  slots: Array<{ squadIdx: number; slotIdx: number }>;
  slotsPerSquad: number[];
}

function groupSlotsByPosition(
  allSlots: Array<{ squad: GenerationInput['squads'][0]; nonGkSlots: FormationSlotRequirement[] }>,
): PositionSlotGroup[] {
  const roleGroups = new Map<string, { acceptedPositions: BroadPosition[]; slots: Array<{ squadIdx: number; slotIdx: number }>; slotsPerSquad: number[] }>();

  for (let squadIdx = 0; squadIdx < allSlots.length; squadIdx++) {
    const { nonGkSlots } = allSlots[squadIdx];
    for (let slotIdx = 0; slotIdx < nonGkSlots.length; slotIdx++) {
      const slot = nonGkSlots[slotIdx];
      const key = slot.roleType;
      if (!roleGroups.has(key)) {
        roleGroups.set(key, { acceptedPositions: slot.acceptedPositions, slots: [], slotsPerSquad: new Array(allSlots.length).fill(0) });
      }
      const group = roleGroups.get(key)!;
      group.slots.push({ squadIdx, slotIdx });
      group.slotsPerSquad[squadIdx]++;
    }
  }

  return Array.from(roleGroups.values());
}

function snakeOrder(totalSlots: number, squadCount: number): Array<{ squadIdx: number; slotIdx: number }> {
  const order: Array<{ squadIdx: number; slotIdx: number }> = [];
  let forward = true;
  let assigned = 0;
  let round = 0;

  while (assigned < totalSlots) {
    const indices = forward
      ? Array.from({ length: squadCount }, (_, i) => i)
      : Array.from({ length: squadCount }, (_, i) => squadCount - 1 - i);

    for (const squadIdx of indices) {
      if (assigned >= totalSlots) break;
      order.push({ squadIdx, slotIdx: round });
      assigned++;
    }
    forward = !forward;
    round++;
  }

  return order;
}

function optimizeSwapsForBalance(
  allPlayers: PlayerWithRatings[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
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
          for (const aJ of squadJAssignments) {
            if (lockedPlayerIds.has(aJ.playerId)) continue;

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
    }

    if (!improved) break;
  }
  void assignedGlobal;
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
      source: 'AUTO',
      locked: false,
      selectionReason: hasUncertainty ? 'Rating uncertainty: player has missing attributes' : 'Selected to balance remaining squads',
      positionFitTier: 'NO_FIT',
    });
    squadCounts.set(targetSquad.id, (squadCounts.get(targetSquad.id) ?? 0) + 1);
    squadRatingSums.set(targetSquad.id, (squadRatingSums.get(targetSquad.id) ?? 0) + playerRating);
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