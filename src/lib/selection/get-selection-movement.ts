import { SelectionRole } from "@/generated/prisma/client";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";

type SelectionMovementRow = {
  player: {
    firstName: string;
    lastName: string | null;
  };
  playerId: string;
  roleType: SelectionRole;
  sourceTeamNameSnapshot: string;
  targetTeamNameSnapshot: string;
};

export type SelectionMovementPlayer = {
  playerId: string;
  playerName: string;
  roleType: SelectionRole;
  sourceTeamName: string;
  targetTeamName: string;
};

export function isSelectionMovementRow(row: {
  roleType: SelectionRole;
  sourceTeamNameSnapshot: string;
  targetTeamNameSnapshot: string;
}): boolean {
  return (
    row.sourceTeamNameSnapshot !== row.targetTeamNameSnapshot ||
    isFloatingSelectionRole(row.roleType)
  );
}

export function getSelectionMovementPlayers(
  rows: SelectionMovementRow[],
): SelectionMovementPlayer[] {
  const movementByPlayerId = new Map<string, SelectionMovementPlayer>();

  for (const row of rows) {
    if (!isSelectionMovementRow(row) || movementByPlayerId.has(row.playerId)) {
      continue;
    }

    movementByPlayerId.set(row.playerId, {
      playerId: row.playerId,
      playerName: formatPlayerName(row.player),
      roleType: row.roleType,
      sourceTeamName: row.sourceTeamNameSnapshot,
      targetTeamName: row.targetTeamNameSnapshot,
    });
  }

  return [...movementByPlayerId.values()].sort((left, right) =>
    left.playerName.localeCompare(right.playerName),
  );
}
