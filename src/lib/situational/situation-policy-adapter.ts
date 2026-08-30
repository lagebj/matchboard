import {
  evaluatePolicyEntrypoint,
  PolicyRuntimeDegradedError,
  PolicyRuntimeError,
} from "@/lib/policies/policy-runtime";
import { logger } from "@/lib/logger";
import { MATCHDAY_IMMINENT_MINUTES } from "./resolve-situation-context";
import type {
  CoachDecisionCandidate,
  DecisionConsequence,
  DecisionHorizon,
  DecisionInteraction,
  DecisionUrgency,
  DecisionVisibility,
  SituationContext,
  SituationPolicyResult,
} from "./situation-types";

const HARD_CONSEQUENCES: ReadonlySet<DecisionConsequence> = new Set([
  "MATCH_NOT_PLAYABLE",
  "SQUAD_DEGRADED",
  "POSITION_COVERAGE",
  "PLANNING_BLOCKED",
]);

const VALID_VISIBILITY: ReadonlySet<string> = new Set(["PROMOTE", "NORMAL", "DEFER", "SUPPRESS"]);
const VALID_HORIZON: ReadonlySet<string> = new Set(["NOW", "BEFORE_NEXT_MATCH", "NEXT", "LONG_TERM"]);
const VALID_URGENCY: ReadonlySet<string> = new Set(["IMMEDIATE", "SOON", "NORMAL", "LOW"]);
const VALID_INTERACTION: ReadonlySet<string> = new Set(["INFORM", "CONFIRM", "CHOOSE", "REVIEW", "AUTO"]);

function deadlineMinutesFromDeadlineAt(deadlineAt: string | undefined, nowIso: string): number | null {
  if (!deadlineAt) return null;
  const minutes = (new Date(deadlineAt).getTime() - new Date(nowIso).getTime()) / 60_000;
  return Number.isFinite(minutes) ? minutes : null;
}

function buildRegoInput(context: SituationContext, candidate: CoachDecisionCandidate): Record<string, unknown> {
  return {
    situation: {
      primary: context.primarySituation,
      active_match: candidate.affectedMatchIds.some((id) => id === context.activeMatchId),
    },
    candidate: {
      source: candidate.source,
      consequences: candidate.consequences,
      deadline_minutes: deadlineMinutesFromDeadlineAt(candidate.deadlineAt, context.nowIso),
      has_recommendation: candidate.recommendedAction != null,
      alternative_count: candidate.alternativeActions.length,
      reversible: candidate.reversibleUntil != null,
      is_long_term_signal: candidate.isLongTermSignal ?? false,
      affects_next_round_decision: candidate.affectsNextRoundDecision ?? false,
      requires_review: candidate.requiresReview ?? false,
    },
  };
}

/**
 * Deterministic, safe fallback used when the situation policy is unavailable (runtime degraded)
 * or returns a malformed result. Never invents suppression, never uses AUTO, orders only by hard
 * consequence/deadline facts, and always preserves the candidate rather than hiding it.
 *
 * This is a bounded fallback, not a second full situation-policy implementation (ADR-0107).
 */
export function computeDegradedSituationResult(
  context: SituationContext,
  candidate: CoachDecisionCandidate,
): SituationPolicyResult {
  const hasHardConsequence = candidate.consequences.some((c) => HARD_CONSEQUENCES.has(c));
  const deadlineMinutes = deadlineMinutesFromDeadlineAt(candidate.deadlineAt, context.nowIso);
  const isActive = candidate.affectedMatchIds.some((id) => id === context.activeMatchId);
  const isImminent = deadlineMinutes != null && deadlineMinutes >= 0 && deadlineMinutes <= MATCHDAY_IMMINENT_MINUTES;

  let visibility: DecisionVisibility = "NORMAL";
  let horizon: DecisionHorizon = context.primarySituation === "NEXT" ? "NEXT" : "BEFORE_NEXT_MATCH";
  let urgency: DecisionUrgency = "NORMAL";

  if (hasHardConsequence && (isActive || isImminent)) {
    visibility = "PROMOTE";
    horizon = "NOW";
    urgency = "IMMEDIATE";
  } else if (hasHardConsequence) {
    visibility = "PROMOTE";
  }

  const interaction: DecisionInteraction = candidate.recommendedAction ? "CONFIRM" : "INFORM";

  return {
    visibility,
    horizon,
    urgency,
    interaction,
    reasonCodes: ["POLICY_RUNTIME_DEGRADED"],
    suppressNonessentialContext: false,
  };
}

function normalizeRawResult(raw: unknown): SituationPolicyResult | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const visibility = r.visibility;
  const horizon = r.horizon;
  const urgency = r.urgency;
  const interaction = r.interaction;

  if (
    typeof visibility !== "string" || !VALID_VISIBILITY.has(visibility) ||
    typeof horizon !== "string" || !VALID_HORIZON.has(horizon) ||
    typeof urgency !== "string" || !VALID_URGENCY.has(urgency) ||
    typeof interaction !== "string" || !VALID_INTERACTION.has(interaction)
  ) {
    return null;
  }

  return {
    visibility: visibility as DecisionVisibility,
    horizon: horizon as DecisionHorizon,
    urgency: urgency as DecisionUrgency,
    interaction: interaction as DecisionInteraction,
    reasonCodes: Array.isArray(r.reason_codes) ? r.reason_codes.map(String) : [],
    suppressNonessentialContext: r.suppress_nonessential_context === true,
  };
}

export type SituationEvaluationOutcome = {
  result: SituationPolicyResult;
  policyRuntimeStatus: "HEALTHY" | "DEGRADED";
};

/**
 * Evaluate the `situation` Rego entrypoint for one candidate in one situation context.
 *
 * Unlike the selection entrypoint (which must fail closed on a malformed result — a broken
 * custom selection policy must never be silently masked), a malformed or unavailable situation
 * result degrades safely: situation policy only affects contextual ordering/visibility, never
 * player eligibility or safety, so a broken situation policy must never prevent Today (or any
 * other situational surface) from rendering.
 */
export async function evaluateSituationPolicy(
  context: SituationContext,
  candidate: CoachDecisionCandidate,
): Promise<SituationEvaluationOutcome> {
  try {
    const regoInput = buildRegoInput(context, candidate);
    const raw = await evaluatePolicyEntrypoint<Record<string, unknown>>("situation", regoInput);
    const normalized = normalizeRawResult(raw);

    if (!normalized) {
      logger.warn(
        { candidateId: candidate.id },
        "[Situational/Policy] Situation entrypoint returned a malformed result; degrading safely.",
      );
      return { result: computeDegradedSituationResult(context, candidate), policyRuntimeStatus: "DEGRADED" };
    }

    return { result: normalized, policyRuntimeStatus: "HEALTHY" };
  } catch (error) {
    if (error instanceof PolicyRuntimeDegradedError || error instanceof PolicyRuntimeError) {
      return { result: computeDegradedSituationResult(context, candidate), policyRuntimeStatus: "DEGRADED" };
    }
    // Any other unexpected error still degrades rather than throwing — the situational layer must
    // never make Today (or any other coach-facing surface) unavailable.
    logger.error(
      { candidateId: candidate.id, message: error instanceof Error ? error.message : String(error) },
      "[Situational/Policy] Unexpected error evaluating situation policy; degrading safely.",
    );
    return { result: computeDegradedSituationResult(context, candidate), policyRuntimeStatus: "DEGRADED" };
  }
}
