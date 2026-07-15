import type { SelectionRole } from "@/generated/prisma/client";

export type ReportStatus = "NONE" | "DRAFT" | "REPORTED" | "LOCKED";

export type PlannedSelectionSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  role: SelectionRole;
  teamId: string;
  teamName: string;
  wasPlannedAsStarter: boolean;
  matchdayResponsibility: string | null;
  overrideReason: string | null;
};

export type ActualParticipationSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  attendanceStatus: string;
  source: string;
  unplannedAppearanceReason: string | null;
  goals: number;
  assists: number;
};

export type PlannedAbsentSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  plannedRole: SelectionRole;
  plannedTeamId: string;
  plannedTeamName: string;
  absenceReason: string | null;
  wasMarkedUnavailable: boolean;
};

export type UnplannedParticipationSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  unplannedAppearanceReason: string | null;
  goals: number;
  assists: number;
};

export type ParticipationDelta =
  | "planned_and_present"
  | "planned_but_absent"
  | "planned_but_no_show"
  | "not_planned_but_present"
  | "planned_starter_started"
  | "planned_substitute_started";

export type PlannedVsActualMatch = {
  matchId: string;
  matchRoundId: string;
  matchDate: Date | null;
  opponent: string;
  homeAway: string;
  isCancelled: boolean;
  reportStatus: ReportStatus;
  plannedPlayers: PlannedSelectionSummary[];
  actualParticipants: ActualParticipationSummary[];
  plannedButAbsent: PlannedAbsentSummary[];
  unplannedParticipants: UnplannedParticipationSummary[];
  deltaSummary: string;
  homeGoals: number | null;
  awayGoals: number | null;
  result: "won" | "drawn" | "lost" | null;
};

export type AuditWorkItemType =
  | "missing_report"
  | "incomplete_report"
  | "unknown_attendance"
  | "missing_actuals";

export type AuditWorkItem = {
  type: AuditWorkItemType;
  matchId: string;
  matchDate: Date | null;
  matchRoundId: string;
  roundName: string;
  description: string;
};

export type PeriodReviewScope =
  | { type: "round"; matchRoundId: string }
  | { type: "period"; leagueSeasonId: string }
  | { type: "full_year"; seasonYear: number };

export type ParticipationSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  plannedOpportunities: number;
  actualAppearances: number;
  coreAppearances: number;
  supportAppearances: number;
  developmentAppearances: number;
  squadRepairAppearances: number;
  goals: number;
  assists: number;
  plannedButAbsent: number;
  unplannedAppearances: number;
  missingReports: number;
};

export type SeasonReviewData = {
  leagueSeasonId: string;
  leagueSeasonName: string;
  period: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalRounds: number;
  finalizedRounds: number;
  draftRounds: number;
  completedMatches: number;
  matchesWithReports: number;
  matchesMissingReports: number;
  participationSummaries: ParticipationSummary[];
  auditWorkItems: AuditWorkItem[];
};