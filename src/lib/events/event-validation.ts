import {
  type PlayerAttributeProfile,
  type BroadPosition,
  type GameFormat,
  type EventPoolValidation,
  type FormationSlotRequirement,
  isGoalkeeperCapable,
  getPlayerBroadPositions,
} from './event-types';

export function validateEventPool(
  players: PlayerAttributeProfile[],
  targetSquadCount: number,
  targetSize: number,
  gameFormat: GameFormat,
  formationSlots: FormationSlotRequirement[],
): EventPoolValidation {
  const available = players.filter((p) => p !== null);
  const availableCount = available.length;
  const missingRatingsCount = available.filter(
    (p) => p.ballControl === null || p.passing === null || p.effort === null,
  ).length;

  const goalkeeperCount = available.filter(isGoalkeeperCapable).length;
  const goalkeeperPerSquad = targetSquadCount > 0 ? goalkeeperCount / targetSquadCount : 0;
  const goalkeeperSufficient = goalkeeperCount >= targetSquadCount;

  const positionCounts: Record<BroadPosition, number> = {
    goalkeeper: goalkeeperCount,
    defender: 0,
    midfielder: 0,
    forward: 0,
    flexible: 0,
  };

  for (const player of available) {
    const positions = getPlayerBroadPositions(player);
    if (positions.length === 0) {
      positionCounts.flexible++;
    } else {
      for (const pos of positions) {
        if (pos in positionCounts) {
          positionCounts[pos]++;
        } else {
          positionCounts.flexible++;
        }
      }
    }
  }

  const positionCoverage: Record<BroadPosition, { count: number; perSquad: number; sufficient: boolean }> = {
    goalkeeper: {
      count: positionCounts.goalkeeper,
      perSquad: Math.round(goalkeeperPerSquad * 10) / 10,
      sufficient: goalkeeperSufficient,
    },
    defender: {
      count: positionCounts.defender,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.defender / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.defender >= targetSquadCount,
    },
    midfielder: {
      count: positionCounts.midfielder,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.midfielder / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.midfielder >= targetSquadCount,
    },
    forward: {
      count: positionCounts.forward,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.forward / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.forward >= targetSquadCount,
    },
    flexible: {
      count: positionCounts.flexible,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.flexible / targetSquadCount) * 10) / 10 : 0,
      sufficient: true,
    },
  };

  const warnings: string[] = [];
  const notes: string[] = [];

  if (availableCount < targetSquadCount * targetSize) {
    warnings.push(
      `Not enough available players: ${availableCount} available, ${targetSquadCount * targetSize} needed for ${targetSquadCount} squads of ${targetSize}`,
    );
  }

  if (!goalkeeperSufficient) {
    warnings.push(
      `Insufficient goalkeeper coverage: ${goalkeeperCount} goalkeeper-capable players for ${targetSquadCount} squads`,
    );
  }

  if (missingRatingsCount > availableCount / 2) {
    notes.push(
      `Many players have missing ratings (${missingRatingsCount} of ${availableCount}), which may affect balance quality`,
    );
  }

  const requiredPositions = getRequiredPositionsByFormat(gameFormat, formationSlots);
  for (const pos of requiredPositions) {
    if (positionCoverage[pos] && positionCoverage[pos].count < targetSquadCount) {
      warnings.push(
        `Insufficient ${pos} coverage: ${positionCoverage[pos].count} players for ${targetSquadCount} squads`,
      );
    }
  }

  return {
    availablePlayerCount: availableCount,
    targetSquadCount,
    targetSize,
    missingRatingsCount,
    goalkeeperCoverage: {
      total: goalkeeperCount,
      perSquad: Math.round(goalkeeperPerSquad * 10) / 10,
      sufficient: goalkeeperSufficient,
    },
    positionCoverage,
    warnings,
    notes,
  };
}

function getRequiredPositionsByFormat(
  gameFormat: GameFormat,
  formationSlots: FormationSlotRequirement[],
): BroadPosition[] {
  if (formationSlots.length > 0) {
    const positions = new Set<BroadPosition>();
    for (const slot of formationSlots) {
      for (const pos of slot.acceptedPositions) {
        positions.add(pos);
      }
    }
    return [...positions];
  }

  switch (gameFormat) {
    case 'THREE_A_SIDE':
      return ['defender', 'flexible'];
    case 'FIVE_A_SIDE':
      return ['goalkeeper', 'defender', 'forward'];
    case 'SEVEN_A_SIDE':
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
    case 'NINE_A_SIDE':
    case 'ELEVEN_A_SIDE':
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
    default:
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
  }
}