export type AssistantWorkCategory =
  | "setup_missing"
  | "availability_missing"
  | "populate_needed"
  | "blocked_round"
  | "decision_required"
  | "ready_to_finalize"
  | "post_match_report"
  | "upcoming_round";

export type AssistantWorkItem = {
  id: string;
  category: AssistantWorkCategory;
  priority: number;
  title: string;
  summary: string;
  matchRoundId: string;
  matchId?: string;
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
  populate_needed: 2,
  blocked_round: 3,
  decision_required: 4,
  ready_to_finalize: 5,
  post_match_report: 6,
  upcoming_round: 7,
};