import type { PlanIntegrityRuleCode, PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { CoachDecisionCandidate, DecisionCandidateProvider, DecisionConsequence } from "../situation-types";

/**
 * Adapts `computeRoundPlanIntegrity()`'s per-signal output (BLOCKED/DECISION_REQUIRED only —
 * Planning notes never become candidates, per AGENTS.md) into normalized candidates, one per
 * signal rather than one aggregated candidate per round. This is deliberately more granular than
 * `assistantWorkItemsToCandidates()`'s `blocked_round`/`decision_required` categories (which
 * collapse every signal in a round into a single item with a concatenated summary) — callers that
 * register this provider should exclude those two categories from the Assistant adapter's output
 * to avoid representing the same underlying problem twice (see
 * `assistantWorkItemsToCandidates()`'s `excludeCategories` option).
 *
 * Takes already-computed `RoundPlanIntegrity` data (from `AssistantCommandCentre.roundPlanIntegrities`)
 * rather than calling `computeRoundPlanIntegrity()` itself — the caller already paid for that
 * computation once; this provider must not recompute it.
 */
export const PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID = "plan-integrity-signals";

const RULE_CONSEQUENCES: Record<PlanIntegrityRuleCode, DecisionConsequence[]> = {
  SQUAD_BELOW_MINIMUM: ["SQUAD_DEGRADED"],
  SELECTED_PLAYER_UNAVAILABLE: ["SQUAD_DEGRADED"],
  DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE: ["PLANNING_BLOCKED"],
  AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY: ["PLAYER_OPPORTUNITY"],
};

export type MatchDeadlineLookup = (matchId: string | undefined) => string | undefined;

/** Inverse of the id format below — lets a caller map a `CoachDecision.candidateId` back to the
 * originating signal's idempotency key without duplicating the id format elsewhere. */
export function idempotencyKeyFromCandidateId(candidateId: string): string | null {
  const prefix = `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|`;
  return candidateId.startsWith(prefix) ? candidateId.slice(prefix.length) : null;
}

export function planIntegritySignalToCandidate(
  signal: PlanIntegritySignal,
  getMatchDeadlineAt: MatchDeadlineLookup,
): CoachDecisionCandidate {
  const deadlineAt = getMatchDeadlineAt(signal.matchId);

  return {
    id: `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|${signal.idempotencyKey}`,
    source: PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID,
    entityType: signal.matchId ? "MATCH" : "ROUND",
    entityId: signal.matchId ?? signal.matchRoundId,
    title: signal.title,
    summary: signal.currentState,
    // No structured DecisionFacts yet — classification/consequence context is already carried in
    // `summary`/`consequences` above. Add facts here if a future situation-policy rule needs a
    // numeric/boolean signal this candidate doesn't already expose.
    facts: [],
    consequences: RULE_CONSEQUENCES[signal.ruleCode] ?? ["PLANNING_BLOCKED"],
    affectedMatchIds: signal.matchId ? [signal.matchId] : [],
    affectedTeamIds: signal.teamId ? [signal.teamId] : [],
    affectedPlayerIds: signal.playerId ? [signal.playerId] : [],
    deadlineAt,
    recommendedAction: { label: signal.primaryActionLabel, href: signal.primaryActionTarget },
    alternativeActions: [],
    defaultDeepLink: signal.primaryActionTarget,
    sourceConfidence: "HIGH",
    isLongTermSignal: false,
    // A repeated missed opportunity is exactly the kind of pattern that benefits from a coach
    // looking at the round as a whole rather than confirming one isolated action.
    affectsNextRoundDecision: false,
    requiresReview: signal.repeatedContext != null,
  };
}

export function createPlanIntegrityCandidateProvider(
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>,
  getMatchDeadlineAt: MatchDeadlineLookup,
): DecisionCandidateProvider {
  return {
    id: PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID,
    getCandidates: () =>
      Object.values(roundPlanIntegrities).flatMap((integrity) =>
        integrity.signals.map((signal) => planIntegritySignalToCandidate(signal, getMatchDeadlineAt)),
      ),
  };
}
