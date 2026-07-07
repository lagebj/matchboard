import type {
  PlayerAttributeProfile,
  GameFormat,
  EventSelectionPattern,
  EventSquadIntent,
  EventSquadAssignment,
  BroadPosition,
  GenerationInput,
  GenerationOutput,
} from './event-types';
import { computeCompositeRatings, isGoalkeeperCapable, getPlayerBroadPositions } from './event-types';
import { computeSquadBalance } from './event-balance';

export function generateEventSquads(input: GenerationInput): GenerationOutput {
  const { selectionPattern, players, squads, lockedAssignments, gameFormat } = input;

  const availablePlayers = players.filter((p) => p !== null);
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
        });
      }
    }
  }

  const assignedPlayerIds = new Set(assignments.map((a) => a.playerId));
  const remainingPlayers = unlockedPlayers.filter((p) => !assignedPlayerIds.has(p.playerId));

  switch (selectionPattern) {
    case 'ALL_BALANCED':
      distributeAllBalanced(remainingPlayers, squads, assignments, gameFormat, validationNotes);
      break;
    case 'ONE_COMPETITIVE_BALANCED_REMAINDER':
      distributeOneCompetitiveBalancedRemainder(remainingPlayers, squads, assignments, gameFormat, validationNotes);
      break;
    case 'MANUAL_SEED_AUTO_BALANCE':
      distributeManualSeedAutoBalance(remainingPlayers, squads, assignments, gameFormat, validationNotes);
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
      .filter((p): p is PlayerAttributeProfile => p !== undefined);
    return computeSquadBalance(squad.id, squad.name, squad.intent as EventSquadIntent, squadPlayers);
  });

  return {
    assignments,
    balanceSummaries,
    validationNotes,
    warnings,
  };
}

function distributeAllBalanced(
  players: PlayerAttributeProfile[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  gameFormat: GameFormat,
  notes: string[],
): void {
  if (squads.length === 0 || players.length === 0) return;

  const sorted = [...players].sort((a, b) => {
    const aRatings = computeCompositeRatings(a);
    const bRatings = computeCompositeRatings(b);
    const aOverall = aRatings.overallLevel ?? 0;
    const bOverall = bRatings.overallLevel ?? 0;
    if (bOverall !== aOverall) return bOverall - aOverall;
    const aNulls = [a.ballControl, a.passing, a.effort].filter((v) => v === null).length;
    const bNulls = [b.ballControl, b.passing, b.effort].filter((v) => v === null).length;
    return aNulls - bNulls;
  });

  const squadPlayerCounts = new Map<string, number>();
  const squadGKCounts = new Map<string, number>();
  for (const squad of squads) {
    squadPlayerCounts.set(squad.id, 0);
    squadGKCounts.set(squad.id, 0);
  }

  for (const player of sorted) {
    const gkCapable = isGoalkeeperCapable(player);
    const positions = getPlayerBroadPositions(player);
    const isGK = gkCapable && (positions.length === 0 || positions[0] === 'goalkeeper');

    const targetSquads = squads
      .filter((s) => {
        const currentCount = squadPlayerCounts.get(s.id) ?? 0;
        return currentCount < (s.maxSize ?? s.targetSize);
      })
      .sort((a, b) => {
        const aCount = squadPlayerCounts.get(a.id) ?? 0;
        const bCount = squadPlayerCounts.get(b.id) ?? 0;
        if (aCount !== bCount) return aCount - bCount;

        if (isGK) {
          const aGKs = squadGKCounts.get(a.id) ?? 0;
          const bGKs = squadGKCounts.get(b.id) ?? 0;
          return aGKs - bGKs;
        }

        return 0;
      });

    if (targetSquads.length === 0) {
      notes.push(`No available squad slot for player ${player.playerId}`);
      continue;
    }

    const targetSquad = targetSquads[0];
    const reason = buildSelectionReason(player, targetSquad, 'ALL_BALANCED');

    assignments.push({
      playerId: player.playerId,
      eventSquadId: targetSquad.id,
      assignedRoleType: null,
      assignedPositionId: null,
      source: 'AUTO',
      locked: false,
      selectionReason: reason,
    });

    squadPlayerCounts.set(targetSquad.id, (squadPlayerCounts.get(targetSquad.id) ?? 0) + 1);
    if (isGK) {
      squadGKCounts.set(targetSquad.id, (squadGKCounts.get(targetSquad.id) ?? 0) + 1);
    }
  }
}

function distributeOneCompetitiveBalancedRemainder(
  players: PlayerAttributeProfile[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  gameFormat: GameFormat,
  notes: string[],
): void {
  const competitiveSquad = squads.find((s) => s.intent === 'COMPETITIVE');
  const balancedSquads = squads.filter((s) => s.intent !== 'COMPETITIVE');

  if (!competitiveSquad) {
    notes.push('No competitive squad found for ONE_COMPETITIVE_BALANCED_REMAINDER pattern');
    distributeAllBalanced(players, squads, assignments, gameFormat, notes);
    return;
  }

  const sorted = [...players].sort((a, b) => {
    const aRatings = computeCompositeRatings(a);
    const bRatings = computeCompositeRatings(b);
    const aOverall = aRatings.overallLevel ?? 0;
    const bOverall = bRatings.overallLevel ?? 0;
    return bOverall - aOverall;
  });

  const competitiveSlots = competitiveSquad.targetSize;
  const competitiveAssignments: PlayerAttributeProfile[] = [];

  const gkPlayers = sorted.filter((p) => isGoalkeeperCapable(p));
  if (gkPlayers.length > 0) {
    const bestGK = gkPlayers[0];
    competitiveAssignments.push(bestGK);
  }

  const remainingForCompetitive = sorted.filter(
    (p) => !competitiveAssignments.includes(p),
  );

  const positionsNeeded: BroadPosition[] = ['defender', 'midfielder', 'forward'];
  for (const pos of positionsNeeded) {
    const playerForPos = remainingForCompetitive.find((p) => {
      if (competitiveAssignments.includes(p)) return false;
      const positions = getPlayerBroadPositions(p);
      return positions.includes(pos);
    });
    if (playerForPos && competitiveAssignments.length < competitiveSlots) {
      competitiveAssignments.push(playerForPos);
    }
  }

  for (const player of remainingForCompetitive) {
    if (competitiveAssignments.length >= competitiveSlots) break;
    if (competitiveAssignments.includes(player)) continue;
    competitiveAssignments.push(player);
  }

  for (const player of competitiveAssignments) {
    const reason = buildCompetitiveReason(player);
    assignments.push({
      playerId: player.playerId,
      eventSquadId: competitiveSquad.id,
      assignedRoleType: null,
      assignedPositionId: null,
      source: 'AUTO',
      locked: false,
      selectionReason: reason,
    });
  }

  const competitivePlayerIds = new Set(competitiveAssignments.map((p) => p.playerId));
  const remainingPlayers = sorted.filter((p) => !competitivePlayerIds.has(p.playerId));

  if (balancedSquads.length > 0) {
    distributeAllBalanced(remainingPlayers, balancedSquads, assignments, gameFormat, notes);
  }
}

function distributeManualSeedAutoBalance(
  players: PlayerAttributeProfile[],
  squads: GenerationInput['squads'],
  assignments: EventSquadAssignment[],
  gameFormat: GameFormat,
  notes: string[],
): void {
  distributeAllBalanced(players, squads, assignments, gameFormat, notes);
}

function buildSelectionReason(
  player: PlayerAttributeProfile,
  squad: GenerationInput['squads'][0],
  pattern: EventSelectionPattern,
): string {
  const ratings = computeCompositeRatings(player);
  const positions = getPlayerBroadPositions(player);
  const isGK = isGoalkeeperCapable(player) && (positions.length === 0 || positions[0] === 'goalkeeper');

  if (isGK) return 'Selected for goalkeeper coverage';

  if (ratings.overallLevel === null) {
    return 'Rating uncertainty: player has missing attributes';
  }

  if (pattern === 'ALL_BALANCED') {
    return 'Selected to balance remaining squads';
  }

  if (positions.length > 0) {
    const primaryPos = positions[0];
    return `Selected as ${primaryPos} fit for selected formation`;
  }

  return 'Selected as flexible player after core tactical roles were covered';
}

function buildCompetitiveReason(player: PlayerAttributeProfile): string {
  const ratings = computeCompositeRatings(player);
  const positions = getPlayerBroadPositions(player);
  const isGK = isGoalkeeperCapable(player) && (positions.length === 0 || positions[0] === 'goalkeeper');

  if (isGK) return 'Selected for goalkeeper coverage';

  if (ratings.overallLevel === null) {
    return 'Selected with rating uncertainty for competitive squad';
  }

  if (positions.length > 0) {
    const primaryPos = positions[0];
    return `Selected as ${primaryPos} fit for competitive formation`;
  }

  return 'Selected for competitive squad based on overall level';
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