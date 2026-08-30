import type { AssistantWorkCategory, AssistantWorkItem } from "@/lib/assistant/types";
import type { CoachDecisionCandidate, DecisionConsequence } from "../situation-types";

/**
 * Adapts existing `AssistantWorkItem`s (produced by `getAssistantCommandCentre()`) into
 * normalized `CoachDecisionCandidate`s. This is the "AssistantWorkItem → Assistant candidate
 * provider → CoachDecisionCandidate" migration step (docs/domain/situational-decision-support.md).
 *
 * This adapter does not decide final situational relevance — it only normalizes existing facts.
 * `AssistantWorkItem` is not deleted; it remains a valid source shape during migration.
 */
export const ASSISTANT_CANDIDATE_PROVIDER_ID = "assistant-work-items";

/**
 * Coach-safe consequence mapping per work category. Deliberately approximate where a category
 * spans several underlying rule codes — the situation policy only needs a bounded consequence
 * set to reason about hard-vs-soft treatment, not a perfect 1:1 taxonomy. Extend here, not by
 * special-casing categories in a UI component.
 */
const CATEGORY_CONSEQUENCES: Record<AssistantWorkCategory, DecisionConsequence[]> = {
  setup_missing: ["PLANNING_BLOCKED"],
  availability_missing: ["PLANNING_BLOCKED"],
  event_setup_missing: ["PLANNING_BLOCKED"],
  event_squads_missing: ["PLANNING_BLOCKED"],
  event_squads_draft: ["PLAYER_OPPORTUNITY"],
  event_lineup_missing: ["POSITION_COVERAGE"],
  populate_needed: ["PLANNING_BLOCKED"],
  blocked_round: ["SQUAD_DEGRADED", "PLANNING_BLOCKED"],
  decision_required: ["PLAYER_OPPORTUNITY"],
  event_helpers_missing: ["RESPONSIBILITY_GAP"],
  review_assigned: ["RESPONSIBILITY_GAP"],
  review_changes_requested: ["RESPONSIBILITY_GAP"],
  event_report_needed: ["REPORTING_DEBT"],
  post_match_report: ["REPORTING_DEBT"],
  incomplete_report: ["REPORTING_DEBT"],
  unknown_attendance: ["REPORTING_DEBT"],
  event_report_incomplete: ["REPORTING_DEBT"],
  upcoming_round: ["INFORMATION_ONLY"],
  live_report_available: ["RESPONSIBILITY_GAP"],
  pending_profile_suggestions: ["DEVELOPMENT_SIGNAL"],
  planned_rotation_delayed: ["RESPONSIBILITY_GAP"],
};

/** Categories describing longitudinal/developmental signal rather than an immediate operational fact. */
const LONG_TERM_CATEGORIES = new Set<AssistantWorkCategory>(["pending_profile_suggestions"]);

export type MatchDeadlineLookup = (matchId: string | undefined) => string | undefined;

/** Inverse of the id format `toCandidate()` produces — lets a caller map a `CoachDecision.candidateId`
 * back to the originating `AssistantWorkItem.id` without duplicating the id format elsewhere. */
export function workItemIdFromCandidateId(candidateId: string): string | null {
  const prefix = `${ASSISTANT_CANDIDATE_PROVIDER_ID}|`;
  return candidateId.startsWith(prefix) ? candidateId.slice(prefix.length) : null;
}

/**
 * @param items Existing `AssistantWorkItem`s (already computed by `getAssistantCommandCentre()`)
 * @param getMatchDeadlineAt Resolves an item's `matchId` (if any) to that match's kickoff ISO
 *   timestamp, so the situation policy can reason about deadline proximity. Callers already have
 *   this from `AssistantCommandCentre.todayMatches` — do not re-query the database here.
 * @param excludeCategories Categories to skip because a richer, dedicated provider already covers
 *   them with finer granularity (e.g. `plan-integrity-candidate-provider.ts` covers
 *   `blocked_round`/`decision_required` one signal at a time instead of one aggregated item per
 *   round). Defaults to none — a caller that hasn't registered a richer provider still gets full
 *   coverage from this adapter alone.
 */
export function assistantWorkItemsToCandidates(
  items: AssistantWorkItem[],
  getMatchDeadlineAt: MatchDeadlineLookup,
  excludeCategories: AssistantWorkCategory[] = [],
): CoachDecisionCandidate[] {
  const excluded = new Set<AssistantWorkCategory>(["upcoming_round", ...excludeCategories]);
  return items
    .filter((item) => !excluded.has(item.category))
    .map((item) => toCandidate(item, getMatchDeadlineAt));
}

function toCandidate(item: AssistantWorkItem, getMatchDeadlineAt: MatchDeadlineLookup): CoachDecisionCandidate {
  const deadlineAt = getMatchDeadlineAt(item.matchId);

  return {
    id: `${ASSISTANT_CANDIDATE_PROVIDER_ID}|${item.id}`,
    source: ASSISTANT_CANDIDATE_PROVIDER_ID,
    entityType: item.eventId ? "EVENT" : item.matchId ? "MATCH" : "ROUND",
    entityId: item.eventId ?? item.matchId ?? item.matchRoundId,
    title: item.title,
    summary: item.summary,
    facts: [
      ...(item.blockedCount != null ? [{ code: "BLOCKED_COUNT", numericValue: item.blockedCount }] : []),
      ...(item.decisionRequiredCount != null
        ? [{ code: "DECISION_REQUIRED_COUNT", numericValue: item.decisionRequiredCount }]
        : []),
    ],
    consequences: CATEGORY_CONSEQUENCES[item.category] ?? ["INFORMATION_ONLY"],
    affectedMatchIds: item.matchId ? [item.matchId] : [],
    affectedTeamIds: item.affectedTeamIds,
    affectedPlayerIds: item.affectedPlayerIds,
    deadlineAt,
    // AssistantWorkItem always carries one concrete next action — that is its
    // primaryActionLabel/primaryActionHref, which is exactly "recommendedAction" here.
    recommendedAction: { label: item.primaryActionLabel, href: item.primaryActionHref },
    alternativeActions: [],
    defaultDeepLink: item.primaryActionHref,
    sourceConfidence: "HIGH",
    isLongTermSignal: LONG_TERM_CATEGORIES.has(item.category),
    affectsNextRoundDecision: false,
    requiresReview: false,
  };
}
