export type AssistantWorkCategory =
  | "setup_missing"
  | "availability_missing"
  | "event_setup_missing"
  | "event_squads_missing"
  | "event_lineup_missing"
  | "populate_needed"
  | "blocked_round"
  | "decision_required"
  | "event_helpers_missing"
  | "ready_to_finalize"
  | "event_report_needed"
  | "post_match_report"
  | "event_report_incomplete"
  | "upcoming_round";

export type AssistantWorkItem = {
  id: string;
  category: AssistantWorkCategory;
  priority: number;
  title: string;
  summary: string;
  matchRoundId: string;
  matchId?: string;
  eventId?: string;
  blockedCount?: number;
  decisionRequiredCount?: number;
  affectedTeamIds: string[];
  affectedPlayerIds: string[];
  primaryActionLabel: string;
  primaryActionHref: string;
};

export type AssistantCommandCentre = {
  leagueSeasonId: string | null;
  leagueSeasonName: string | null;
  items: AssistantWorkItem[];
  computedAt: Date;
};

export const CATEGORY_PRIORITY: Record<AssistantWorkCategory, number> = {
  setup_missing: 0,
  availability_missing: 1,
  event_setup_missing: 2,
  blocked_round: 3,
  event_squads_missing: 4,
  event_lineup_missing: 5,
  populate_needed: 6,
  decision_required: 7,
  ready_to_finalize: 8,
  event_helpers_missing: 9,
  event_report_needed: 10,
  post_match_report: 11,
  event_report_incomplete: 12,
  upcoming_round: 13,
};