import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";

type PlayerSelectionInvolvementRow = {
  explanation: string | null;
  roleType: SelectionRole;
  selection: {
    createdAt: Date;
    finalizedAt: Date | null;
    match: {
      id: string;
      opponent: string;
      startsAt: Date;
      targetTeam: {
        name: string;
      };
    };
    status: SelectionStatus;
  };
};

export type PlayerSelectionInvolvement = {
  explanation: string | null;
  matchId: string;
  matchStartsAt: Date;
  opponent: string;
  roleType: SelectionRole;
  selectionCreatedAt: Date;
  selectionFinalizedAt: Date | null;
  status: SelectionStatus;
  targetTeamName: string;
};

export function getPlayerSelectionInvolvement(
  rows: PlayerSelectionInvolvementRow[],
): PlayerSelectionInvolvement[] {
  const latestInvolvementByMatchId = new Map<string, PlayerSelectionInvolvement>();

  for (const row of rows) {
    const involvement = {
      explanation: row.explanation,
      matchId: row.selection.match.id,
      matchStartsAt: row.selection.match.startsAt,
      opponent: row.selection.match.opponent,
      roleType: row.roleType,
      selectionCreatedAt: row.selection.createdAt,
      selectionFinalizedAt: row.selection.finalizedAt,
      status: row.selection.status,
      targetTeamName: row.selection.match.targetTeam.name,
    } satisfies PlayerSelectionInvolvement;

    if (!latestInvolvementByMatchId.has(involvement.matchId)) {
      latestInvolvementByMatchId.set(involvement.matchId, involvement);
    }
  }

  return [...latestInvolvementByMatchId.values()];
}
