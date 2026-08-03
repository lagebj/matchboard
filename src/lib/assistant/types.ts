export type AssistantWorkCategory =
  | "setup_missing"
  | "availability_missing"
  | "event_setup_missing"
  | "event_squads_missing"
  | "event_squads_draft"
  | "event_lineup_missing"
  | "populate_needed"
  | "blocked_round"
  | "decision_required"
  | "event_helpers_missing"
  | "ready_to_finalize"
  | "review_assigned"
  | "review_changes_requested"
  | "event_report_needed"
  | "post_match_report"
  | "incomplete_report"
  | "unknown_attendance"
  | "event_report_incomplete"
  | "upcoming_round"
  | "live_report_available"
  | "pending_profile_suggestions";

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
  event_squads_draft: 5,
  event_lineup_missing: 6,
  populate_needed: 7,
  decision_required: 8,
  review_assigned: 9,
  review_changes_requested: 10,
  ready_to_finalize: 11,
  event_helpers_missing: 12,
  event_report_needed: 13,
  post_match_report: 14,
  incomplete_report: 15,
  unknown_attendance: 16,
  event_report_incomplete: 17,
  upcoming_round: 18,
  live_report_available: 19,
  pending_profile_suggestions: 20,
};