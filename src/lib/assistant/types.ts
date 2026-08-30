import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

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
  | "review_assigned"
  | "review_changes_requested"
  | "event_report_needed"
  | "post_match_report"
  | "incomplete_report"
  | "unknown_attendance"
  | "event_report_incomplete"
  | "upcoming_round"
  | "live_report_available"
  | "pending_profile_suggestions"
  | "planned_rotation_delayed";

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

export type TodayMatchStatus = "not_generated" | "draft" | "blocked" | "ready" | "finalized";

export type TodayMatch = {
  matchId: string;
  matchRoundId: string;
  matchRoundName: string;
  teamName: string;
  opponent: string;
  homeAway: "HOME" | "AWAY";
  startsAt: string | null;
  squadStatus: TodayMatchStatus;
  hasActiveLiveSession: boolean;
  reportStatus: "none" | "draft" | "reported" | "locked" | null;
  /** The primary, football-action-oriented match status (ADR-0101). Supersedes squadStatus/
   * reportStatus/hasActiveLiveSession as the label shown to the coach; those remain available
   * above since hasActiveLiveSession also gates the separate "Follow live" action. */
  lifecycleStatus: MatchLifecycleStatus;
};

export type AssistantCommandCentre = {
  leagueSeasonId: string | null;
  leagueSeasonName: string | null;
  items: AssistantWorkItem[];
  todayMatches: TodayMatch[];
  /** The already-computed `RoundPlanIntegrity` for every DRAFT round this call inspected, keyed
   * by matchRoundId. Exposed so a situational candidate provider (ADR-0107,
   * docs/domain/situational-decision-support.md) can build per-signal candidates without
   * recomputing plan integrity for the same round a second time. */
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>;
  /** Already-loaded `LiveMatchSession` heartbeat facts for every currently ACTIVE session among
   * today's matches, keyed by matchId. Exposed so a situational candidate provider can detect a
   * stalled live session (missed heartbeats) without a second `liveMatchSession` query. */
  activeLiveSessions: Record<string, { startedAt: string; lastHeartbeatAt: string | null }>;
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
  event_helpers_missing: 11,
  event_report_needed: 12,
  post_match_report: 13,
  incomplete_report: 14,
  unknown_attendance: 15,
  event_report_incomplete: 16,
  upcoming_round: 17,
  live_report_available: 18,
  pending_profile_suggestions: 19,
  planned_rotation_delayed: 20,
};