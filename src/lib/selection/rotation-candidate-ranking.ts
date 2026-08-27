import type { SelectedPlayer } from "@/lib/selection/types";
import type { RotationCandidate } from "@/lib/selection/selection-types";
import { type LeagueSeasonRoleCounts, getLeagueSeasonFairnessBonus } from "@/lib/selection/selection-fairness";
import { getPositionNeedScore } from "@/lib/selection/selection-fairness";
import {
  getCombinationScoreModifier,
  type CombinationIntentMode,
  type CombinationScoringInput,
} from "@/lib/selection/combination-scoring";

const SUPPORTED_POSITIONS = ["GK", "CB", "CM", "W", "ST"] as const;

export function getPrimaryChosenPosition(primaryPosition: string): string {
  return primaryPosition.trim();
}

export function getPositionMatchLevel(
  playerPrimaryPosition: string,
  playerSecondaryPosition: string | null,
  playerTertiaryPosition: string | null,
  neededPositions: string[],
): RotationCandidate["positionMatchLevel"] {
  if (neededPositions.length === 0) {
    return "none";
  }

  for (const pos of neededPositions) {
    if (playerPrimaryPosition === pos) {
      return "primary";
    }
  }

  for (const pos of neededPositions) {
    if (playerSecondaryPosition && playerSecondaryPosition === pos) {
      return "secondary";
    }
  }

  for (const pos of neededPositions) {
    if (playerTertiaryPosition && playerTertiaryPosition === pos) {
      return "tertiary";
    }
  }

  return "none";
}

export function getNeededPositions(
  selectedPlayers: SelectedPlayer[],
  _squadSize: number,
): string[] {
  if (selectedPlayers.length === 0) {
    return [...SUPPORTED_POSITIONS];
  }

  const positionCounts = new Map<string, number>();
  for (const pos of SUPPORTED_POSITIONS) {
    positionCounts.set(pos, 0);
  }
  for (const player of selectedPlayers) {
    const pos = player.chosenPosition ?? player.playerPosition;
    const normalized = pos.trim().toUpperCase();
    positionCounts.set(normalized, (positionCounts.get(normalized) ?? 0) + 1);
  }

  const maxCount = Math.max(...positionCounts.values());
  const minCount = Math.min(...positionCounts.values());

  if (maxCount === minCount) {
    return [...SUPPORTED_POSITIONS];
  }

  const needed: string[] = [];
  for (const [pos, count] of positionCounts) {
    if (count <= minCount + 1) {
      needed.push(pos);
    }
  }

  return needed.length > 0 ? needed : [...SUPPORTED_POSITIONS];
}

function getPositionMatchScore(level: RotationCandidate["positionMatchLevel"]): number {
  if (level === "primary") return 20;
  if (level === "secondary") return 10;
  if (level === "tertiary") return 5;
  return 0;
}

export function getRotationCandidatePriorityScore(
  candidate: Omit<RotationCandidate, "priorityScore">,
  selectedPlayers: SelectedPlayer[],
  leagueSeasonCounts: Map<string, LeagueSeasonRoleCounts> | null,
  consecutiveSupportRounds: number = 0,
  combinationEvidence: CombinationScoringInput[] = [],
  combinationIntentMode: CombinationIntentMode = "BALANCED",
) {
  const consecutiveSupportPenalty = candidate.candidateCategory === "SUPPORT" && consecutiveSupportRounds > 1
    ? (consecutiveSupportRounds - 1) * 6
    : 0;

  const movementCandidateBonus = candidate.isMovementCandidate ? 12 : 0;

  // Bounded advisory signal (SELECTION_INTEGRATION.md) — added alongside, never in place of,
  // eligibility/fairness/opportunity scoring above. It can only ever add or contribute nothing;
  // see combination-scoring.ts for why unknown combinations never become a penalty.
  const combinationBonus = getCombinationScoreModifier(
    candidate.player.id,
    selectedPlayers.map((p) => p.playerId),
    combinationEvidence,
    combinationIntentMode,
  );

  return (
    50 +
    (candidate.candidateCategory === "SUPPORT" ? 40 : 0) +
    (candidate.candidateCategory === "DEVELOPMENT" ? 25 : 0) +
    (candidate.missedCoreMatchThisWeek ? 30 : 0) +
    getPositionMatchScore(candidate.positionMatchLevel) +
    candidate.suitabilityScore +
    getLeagueSeasonFairnessBonus(candidate.player.id, leagueSeasonCounts, candidate.candidateCategory) +
    movementCandidateBonus +
    combinationBonus -
    candidate.registeredAppearanceCount * 4 -
    candidate.floatingHistory.totalFloatingMatches * 3 -
    candidate.recentLoadScore * 2 -
    getPositionNeedScore(selectedPlayers, candidate.chosenPosition) * 3 -
    consecutiveSupportPenalty
  );
}

export function getRankedRotationCandidates(
  candidates: Array<Omit<RotationCandidate, "priorityScore">>,
  selectedPlayers: SelectedPlayer[],
  leagueSeasonCounts: Map<string, LeagueSeasonRoleCounts> | null,
  consecutiveSupportByPlayer: Map<string, number> = new Map(),
  combinationEvidence: CombinationScoringInput[] = [],
  combinationIntentMode: CombinationIntentMode = "BALANCED",
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priorityScore: getRotationCandidatePriorityScore(
        candidate,
        selectedPlayers,
        leagueSeasonCounts,
        consecutiveSupportByPlayer.get(candidate.player.id) ?? 0,
        combinationEvidence,
        combinationIntentMode,
      ),
    }))
    .sort((left, right) => {
      const leftCategoryPriority =
        left.candidateCategory === "SUPPORT" ? 3 : left.candidateCategory === "DEVELOPMENT" ? 2 : 1;
      const rightCategoryPriority =
        right.candidateCategory === "SUPPORT" ? 3 : right.candidateCategory === "DEVELOPMENT" ? 2 : 1;

      if (leftCategoryPriority !== rightCategoryPriority) {
        return rightCategoryPriority - leftCategoryPriority;
      }

      if (left.priorityScore !== right.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return left.playerName.localeCompare(right.playerName);
    });
}