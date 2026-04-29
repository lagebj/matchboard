import type { SelectedPlayer } from "@/lib/selection/types";
import type { RotationCandidateCategory } from "@/lib/selection/selection-types";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";

export type PlanningPeriodRoleCounts = {
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

export function getPlanningPeriodFairnessBonus(
  playerId: string,
  planningPeriodCounts: Map<string, PlanningPeriodRoleCounts> | null,
  candidateCategory: RotationCandidateCategory,
): number {
  if (!planningPeriodCounts) return 0;

  const counts = planningPeriodCounts.get(playerId);
  if (!counts) return 0;

  if (counts.coreCount === 0) {
    if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
      return -8;
    }
    if (candidateCategory === "DEVELOPMENT") {
      return -5;
    }
  }

  if (counts.supportCount > counts.coreCount) {
    if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
      return -6;
    }
  }

  if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
    return counts.supportCount * -2;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return counts.developmentCount * -2;
  }

  return counts.coreCount * -1;
}