/**
 * Teams overview & Team detail presentation view models (Touchline Design Atlas,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §C-D`).
 *
 * Matchboard owns its own teams, never a complete external table (see
 * `docs/domain/touchline-atlas-provenance.md §0.5`) — `TeamOverviewRow` intentionally has no
 * "league position" field.
 *
 * Sources:
 * - rows (overview)     -> EXISTING_DIRECT (getTeamsResultsOverview(), src/lib/teams/get-teams-results-overview.ts)
 * - roster/movement/rotationPaths/focuses (detail) -> EXISTING_DIRECT (inline queries in teams/[teamId]/page.tsx: Player, MovementLedger, RotationPath, TeamFocus)
 * Derived:
 * - unresolvedPlanningAttention (overview) -> DERIVED_PRESENTATION (count of active TeamFocus + open plan-integrity signals for the team's most recent round, supplied by the route)
 */

export interface TeamOverviewRowInput {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  corePlayerCount: number;
  unresolvedPlanningAttentionCount: number;
}

export interface TeamOverviewViewModel {
  rows: (TeamOverviewRowInput & { goalDifference: number })[];
}

export function buildTeamsOverviewViewModel(rows: TeamOverviewRowInput[]): TeamOverviewViewModel {
  return {
    rows: rows.map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst })),
  };
}

export interface TeamFocusInput {
  id: string;
  statement: string;
  context: string | null;
  status: "ACTIVE" | "COMPLETED" | "CLOSED";
}

export interface TeamRotationPathInput {
  id: string;
  direction: "outgoing" | "incoming";
  counterpartTeamName: string;
  role: string;
}

export interface TeamMovementEntryInput {
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  role: string;
  roundLabel: string;
}

export interface TeamDetailViewModelInput {
  teamId: string;
  teamName: string;
  gameFormat: string;
  corePlayerCount: number;
  targetSquadSize: number;
  record: { matchesPlayed: number; wins: number; draws: number; losses: number };
  supportPriorityRank: number;
  activeFocuses: TeamFocusInput[]; // real TeamFocus rows only — see provenance §0.17
  rotationPaths: TeamRotationPathInput[];
  recentMovements: TeamMovementEntryInput[];
}

export interface TeamDetailViewModel extends TeamDetailViewModelInput {
  coreFillRatio: number; // corePlayerCount / targetSquadSize, clamped 0..1
}

export function buildTeamDetailViewModel(input: TeamDetailViewModelInput): TeamDetailViewModel {
  const coreFillRatio =
    input.targetSquadSize > 0 ? Math.max(0, Math.min(1, input.corePlayerCount / input.targetSquadSize)) : 0;
  return { ...input, coreFillRatio };
}
