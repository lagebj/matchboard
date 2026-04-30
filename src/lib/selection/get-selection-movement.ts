import { type Prisma, SelectionRole } from "@/generated/prisma/client";
import { isFloatingSelectionRole } from "@/lib/match-utils";

type SelectionMovementInput = {
  explanation: Prisma.JsonValue;
  playerId: string;
  role: SelectionRole;
};

export type SelectionMovementPlayer = {
  playerId: string;
  playerName: string;
  role: SelectionRole;
  sourceTeamName: string;
  targetTeamName: string;
};

function isMovementRow(
  role: SelectionRole,
  sourceTeamName: string,
  targetTeamName: string,
): boolean {
  return (
    sourceTeamName !== targetTeamName ||
    isFloatingSelectionRole(role)
  );
}

export function isSelectionMovementRow(input: {
  role: SelectionRole;
  sourceTeamName: string;
  targetTeamName: string;
}): boolean {
  return isMovementRow(input.role, input.sourceTeamName, input.targetTeamName);
}

export function getSelectionMovementPlayers(
  rows: SelectionMovementInput[],
): SelectionMovementPlayer[] {
  const movementByPlayerId = new Map<string, SelectionMovementPlayer>();

  for (const row of rows) {
    const explanation = (row.explanation ?? {}) as Record<string, unknown>;
    const sourceTeamName = (explanation.sourceTeamName as string) ?? "";
    const targetTeamName = (explanation.targetTeamName as string) ?? "";

    if (!isMovementRow(row.role, sourceTeamName, targetTeamName) || movementByPlayerId.has(row.playerId)) {
      continue;
    }

    movementByPlayerId.set(row.playerId, {
      playerId: row.playerId,
      playerName: "",
      role: row.role,
      sourceTeamName,
      targetTeamName,
    });
  }

  return [...movementByPlayerId.values()].sort((left, right) =>
    left.playerName.localeCompare(right.playerName),
  );
}
