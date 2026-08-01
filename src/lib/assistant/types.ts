export type AssistantWorkCategory =
  | "setup_missing"
  | "availability_missing"
  | "event_setup_missing"
  | "event_squads_missing"
  | "event_squads_draft_review"
  | "event_lineup_missing"
  | "populate_needed"
  | "blocked_round"
  | "decision_required"
  | "event_helpers_missing"
  | "ready_to_finalize"
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
  event_squads_draft_review: 5,
  event_lineup_missing: 6,
  populate_needed: 7,
  decision_required: 8,
  ready_to_finalize: 9,
  event_helpers_missing: 10,
  event_report_needed: 11,
  post_match_report: 12,
  incomplete_report: 13,
  unknown_attendance: 14,
  event_report_incomplete: 15,
  upcoming_round: 16,
  live_report_available: 17,
  pending_profile_suggestions: 18,
};