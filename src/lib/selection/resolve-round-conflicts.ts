import { ROLE_PRIORITY_ORDER, type GeneratedSelection, type SelectedPlayer, type SelectionWarning } from "@/lib/selection/types";

type PlayerAssignment = {
  matchId: string;
  matchIndex: number;
  player: SelectedPlayer;
};

function getRolePriority(selectionCategory: string): number {
  const idx = ROLE_PRIORITY_ORDER.indexOf(selectionCategory as typeof ROLE_PRIORITY_ORDER[number]);
  return idx >= 0 ? idx : ROLE_PRIORITY_ORDER.length;
}

export type ConflictResolution = {
  resolvedMatchResults: GeneratedSelection[];
  removedAssignments: Array<{
    matchId: string;
    playerId: string;
  }>;
  conflictWarnings: SelectionWarning[];
};

export function resolveRoundConflicts(
  matchResults: GeneratedSelection[],
): ConflictResolution {
  const playerAssignments = new Map<string, PlayerAssignment[]>();

  for (let matchIndex = 0; matchIndex < matchResults.length; matchIndex++) {
    const result = matchResults[matchIndex]!;
    for (const player of result.selectedPlayers) {
      const existing = playerAssignments.get(player.playerId) ?? [];
      existing.push({
        matchId: result.matchId,
        matchIndex,
        player,
      });
      playerAssignments.set(player.playerId, existing);
    }
  }

  const removedAssignments: Array<{ matchId: string; playerId: string }> = [];
  const conflictWarnings: SelectionWarning[] = [];

  const removalsByMatch = new Map<string, Set<string>>();

  for (const [playerId, assignments] of playerAssignments) {
    if (assignments.length <= 1) continue;

    const sorted = [...assignments].sort((left, right) => {
      const leftPriority = getRolePriority(left.player.selectionCategory);
      const rightPriority = getRolePriority(right.player.selectionCategory);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.matchIndex - right.matchIndex;
    });

    const winningAssignment = sorted[0]!;
    const losingAssignments = sorted.slice(1);

    for (const loser of losingAssignments) {
      removedAssignments.push({
        matchId: loser.matchId,
        playerId,
      });

      const matchRemovals = removalsByMatch.get(loser.matchId) ?? new Set();
      matchRemovals.add(playerId);
      removalsByMatch.set(loser.matchId, matchRemovals);

      conflictWarnings.push({
        code: "round_player_conflict",
        message: `${loser.player.playerName} was removed from ${matchResults[loser.matchIndex]!.teamName} because the player was also assigned to ${matchResults[winningAssignment.matchIndex]!.teamName} with a higher-priority role (${winningAssignment.player.selectionCategory} over ${loser.player.selectionCategory}).`,
        playerId,
      });
    }
  }

  const resolvedMatchResults: GeneratedSelection[] = matchResults.map((result, _index) => {
    const matchRemovals = removalsByMatch.get(result.matchId);

    if (!matchRemovals || matchRemovals.size === 0) {
      return result;
    }

    const survivingPlayers = result.selectedPlayers.filter(
      (p) => !matchRemovals.has(p.playerId),
    );

    const removedPlayers = result.selectedPlayers.filter(
      (p) => matchRemovals.has(p.playerId),
    );

    const demotedExcluded = removedPlayers.map((p) => ({
      autoSelected: p.autoSelected,
      coreTeamId: p.coreTeamId,
      coreTeamName: p.coreTeamName,
      eligibility: p.eligibility,
      explanations: [
        ...p.explanations,
        { code: "round_conflict_demoted", summary: `Removed from this match because a higher-priority role was assigned on another team in the same match round.`, hardRule: true },
      ],
      finalSelected: false,
      manualOverride: false,
      playerId: p.playerId,
      playerName: p.playerName,
      playerPosition: p.playerPosition,
      priorityScore: null,
      automaticSelectionCategory: (p.selectionCategory === "MANUAL" ? "CORE" : p.selectionCategory) as "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD",
      selectionCategory: "EXCLUDED" as const,
      exclusionReason: `Removed from this match due to round-level conflict: player has a higher-priority assignment on another team in the same match round.`,
    }));

    return {
      ...result,
      selectedPlayers: survivingPlayers,
      excludedPlayers: [...result.excludedPlayers, ...demotedExcluded],
      warnings: [
        ...result.warnings,
        ...removedPlayers.map((p) => ({
          code: "round_player_conflict_removed",
          message: `${p.playerName} was removed from this match due to a round-level conflict with a higher-priority assignment on another team.`,
          playerId: p.playerId,
        })),
      ],
    };
  });

  return {
    resolvedMatchResults,
    removedAssignments,
    conflictWarnings,
  };
}