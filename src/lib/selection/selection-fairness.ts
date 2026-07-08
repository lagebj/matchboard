import type { SelectedPlayer } from "@/lib/selection/types";
import type { RotationCandidateCategory } from "@/lib/selection/selection-types";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";

export type LeagueSeasonRoleCounts = {
  coreCount: number;
  developmentCount: number;
  supportCount: number;
};

export function getRecentLoadScore(history: Awaited<ReturnType<typeof getFinalizedPlayerHistory>>) {
  return history.slice(0, 3).length;
}

export function getPositionNeedScore(selectedPlayers: SelectedPlayer[], chosenPosition: string) {
  return selectedPlayers.filter((player) => player.chosenPosition === chosenPosition).length;
}

export function getLeagueSeasonFairnessBonus(
  playerId: string,
  leagueSeasonCounts: Map<string, LeagueSeasonRoleCounts> | null,
  candidateCategory: RotationCandidateCategory,
): number {
  if (!leagueSeasonCounts) return 0;

  const counts = leagueSeasonCounts.get(playerId);
  if (!counts) return 0;

  // Support-role candidates (SUPPORT, including former BACKFILL-equivalent)
  // get fairness penalties to rotate support assignments.
  const isSupportCategory = candidateCategory === "SUPPORT";

  if (counts.coreCount === 0) {
    if (isSupportCategory) {
      return -8;
    }
    if (candidateCategory === "DEVELOPMENT") {
      return -5;
    }
  }

  if (counts.supportCount > counts.coreCount) {
    if (isSupportCategory) {
      return -6;
    }
  }

  if (isSupportCategory) {
    return counts.supportCount * -2;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return counts.developmentCount * -2;
  }

  return counts.coreCount * -1;
}