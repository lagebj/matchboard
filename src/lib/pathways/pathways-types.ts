import type { InsightFilters } from "@/lib/insights/insights-types";

export type PathwayContext = "core" | "support" | "development" | "squad_repair" | "core_match_drop" | "unknown";

export type SelectionOutcome =
  | "played"
  | "selected_no_minutes"
  | "unavailable"
  | "declined"
  | "not_selected"
  | "cancelled"
  | "unknown";

export type PathwayCellStatus =
  | "core_home"
  | "support_sent"
  | "development_moved"
  | "squad_repair_received"
  | "core_match_drop"
  | "not_selected"
  | "unavailable"
  | "cancelled"
  | "draft_core"
  | "draft_support"
  | "draft_development"
  | "draft_squad_repair"
  | "draft_core_match_drop"
  | "no_data";

export interface PathwayCell {
  matchRoundId: string;
  matchRoundName: string;
  matchId: string;
  status: PathwayCellStatus;
  context: PathwayContext;
  teamId: string;
  teamName: string;
  role: string;
  isDraft: boolean;
  opponent?: string;
}

export interface PathwaySummaryMetrics {
  playersShown: number;
  temporarySupportAppearances: number;
  playersWithNoCompletedOpportunity: number;
  playersInMultipleContexts: number;
  mostFrequentHelpers: Array<{ playerId: string; playerName: string; supportCount: number }>;
}

export interface PlayerPathwayRow {
  playerId: string;
  playerName: string;
  coreTeamId: string;
  coreTeamName: string;
  roundsPlayed: number;
  totalSelections: number;
  coreAppearances: number;
  supportAppearances: number;
  developmentAppearances: number;
  squadRepairAppearances: number;
  droppedRounds: number;
  unavailableRounds: number;
  contextTransitions: number;
  cells: PathwayCell[];
}

export interface PlayerPathwayData {
  leagueSeasonId: string;
  leagueSeasonName: string;
  roundCount: number;
  finalizedRoundCount: number;
  draftRoundCount: number;
  summary: PathwaySummaryMetrics;
  players: PlayerPathwayRow[];
  rounds: Array<{
    matchRoundId: string;
    matchRoundName: string;
    isFinalized: boolean;
  }>;
}

export type PathwayFilters = InsightFilters;

export interface PlayerContextPeriod {
  id: string;
  playerId: string;
  context: PathwayContext;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface MatchAppearance {
  id: string;
  playerId: string;
  matchId: string;
  teamId: string;
  contextAtMatch: PathwayContext | null;
  assignmentType: "home" | "helper" | "temporary_support" | "other";
  participation: "starter" | "substitute" | "selected_no_minutes" | "unknown";
}

export type PathwayFilterMode = "all" | "by_core_team" | "high_load" | "low_load" | "high_support" | "low_development" | "dropped_recently" | "unavailable_heavy";

export type PathwayViewMode = "finalized_only" | "include_drafts";