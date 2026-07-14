import type {
  PlayerAttributeProfile,
  SquadBalanceSummary,
  EventSquadIntent,
  BroadPosition,
} from './event-types';
import {
  computeCompositeRatings,
  getGoalkeeperCoverageTier,
  getPlayerBroadPositions,
} from './event-types';

export interface SquadPlayerAssignment {
  playerId: string;
  squadId: string;
  ratings: ReturnType<typeof computeCompositeRatings>;
  broadPositions: BroadPosition[];
  isGoalkeeper: boolean;
  hasMissingRatings: boolean;
}

export function computeSquadBalance(
  squadId: string,
  squadName: string,
  intent: EventSquadIntent,
  players: PlayerAttributeProfile[],
): SquadBalanceSummary {
  let totalOverall = 0;
  let overallCount = 0;
  let goalkeeperCount = 0;
  let defenderCount = 0;
  let midfielderCount = 0;
  let forwardCount = 0;
  let flexibleCount = 0;
  let missingRatingsCount = 0;
  let ratedPlayerCount = 0;
  const coverageNotes: string[] = [];

  for (const player of players) {
    const ratings = computeCompositeRatings(player);
    if (ratings.overallLevel !== null) {
      totalOverall += ratings.overallLevel;
      overallCount++;
      ratedPlayerCount++;
    }

    const positions = getPlayerBroadPositions(player);
    const gkTier = getGoalkeeperCoverageTier(player);
    const isGK = gkTier !== 'none';
    if (isGK) {
      goalkeeperCount++;
      if (gkTier === 'emergency') {
        coverageNotes.push('Uses emergency goalkeeper coverage');
      }
    } else if (positions.length === 0) {
      flexibleCount++;
    } else {
      const primary = positions[0];
      switch (primary) {
        case 'defender': defenderCount++; break;
        case 'midfielder': midfielderCount++; break;
        case 'forward': forwardCount++; break;
        default: flexibleCount++; break;
      }
    }

    if (player.ballControl === null || player.passing === null || player.effort === null) {
      missingRatingsCount++;
    }
  }

  if (goalkeeperCount === 0) {
    coverageNotes.push('No goalkeeper-capable player in squad');
  }
  if (defenderCount === 0) {
    coverageNotes.push('No defensive coverage in squad');
  }

  return {
    squadId,
    squadName,
    intent,
    playerCount: players.length,
    averageOverall: overallCount > 0 ? Math.round((totalOverall / overallCount) * 10) / 10 : null,
    ratedPlayerCount,
    goalkeeperCount,
    defenderCount,
    midfielderCount,
    forwardCount,
    flexibleCount,
    missingRatingsCount,
    coverageNotes,
  };
}