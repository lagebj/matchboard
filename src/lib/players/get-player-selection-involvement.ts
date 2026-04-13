import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { getLatestSelectionSnapshots } from "@/lib/selection/get-latest-selection-snapshots";

type PlayerSelectionInvolvementRow = {
  createdAt: Date;
  finalizedAt: Date | null;
  id: string;
  match: {
    id: string;
    opponent: string;
    startsAt: Date;
    targetTeam: {
      name: string;
    };
  };
  matchId: string;
  players: Array<{
    explanation: string | null;
    roleType: SelectionRole;
  }>;
  status: SelectionStatus;
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
  const latestSnapshots = getLatestSelectionSnapshots(rows);
  const involvement: PlayerSelectionInvolvement[] = [];

  for (const row of latestSnapshots) {
    for (const player of row.players) {
      involvement.push({
        explanation: player.explanation,
        matchId: row.match.id,
        matchStartsAt: row.match.startsAt,
        opponent: row.match.opponent,
        roleType: player.roleType,
        selectionCreatedAt: row.createdAt,
        selectionFinalizedAt: row.finalizedAt,
        status: row.status,
        targetTeamName: row.match.targetTeam.name,
      });
    }
  }

  return involvement;
}
