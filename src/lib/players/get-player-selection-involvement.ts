import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";

type PlayerSelectionInvolvementRow = {
  createdAt: Date;
  id: string;
  match: {
    id: string;
    opponent: string;
    startsAt: Date;
    team: {
      name: string;
    };
  };
  matchId: string;
  player: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
  role: SelectionRole;
  status: SelectionStatus;
};

export type PlayerSelectionInvolvement = {
  explanation: string | null;
  matchId: string;
  matchStartsAt: Date;
  opponent: string;
  role: SelectionRole;
  selectionCreatedAt: Date;
  status: SelectionStatus;
  teamName: string;
};

export function getPlayerSelectionInvolvement(
  rows: PlayerSelectionInvolvementRow[],
): PlayerSelectionInvolvement[] {
  return rows.map((row) => ({
    explanation: null,
    matchId: row.match.id,
    matchStartsAt: row.match.startsAt,
    opponent: row.match.opponent,
    role: row.role,
    selectionCreatedAt: row.createdAt,
    status: row.status,
    teamName: row.match.team.name,
  }));
}