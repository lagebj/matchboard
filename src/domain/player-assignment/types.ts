export interface PlayerAssignmentBoard {
  teams: PlayerAssignmentTeam[];
  unassigned: PlayerAssignmentBoardPlayer[];
}

export interface PlayerAssignmentTeam {
  teamId: string;
  name: string;
  players: PlayerAssignmentBoardPlayer[];
}

export interface PlayerAssignmentBoardPlayer {
  playerId: string;
  displayName?: string;
  primaryPosition?: string;
  rotatable?: boolean;
  teamId?: string | null;
  coreGroup?: string | null;
  openIssueCount?: number;
}

export interface MovePlayerToTeamInput {
  playerId: string;
  targetTeamId: string | null;
  previousTeamId?: string | null;
  reason?: string;
}