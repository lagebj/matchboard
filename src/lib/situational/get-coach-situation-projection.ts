import { evaluateSituationPolicy } from "./situation-policy-adapter";
import type {
  CoachDecision,
  CoachDecisionCandidate,
  CoachSituationProjection,
  CoachSituationProjectionStatus,
  DecisionCandidateProvider,
  SituationContext,
  SituationPolicyResult,
} from "./situation-types";

/**
 * The one query boundary situational UI surfaces (Today, Matchday, Next, Long-term) consume.
 * React must not independently reconstruct priority — see docs/domain/situational-decision-support.md.
 *
 * Providers adapt existing domain owners into normalized candidates; this function owns
 * situation-policy evaluation and deterministic ordering only. It never queries a database
 * itself — providers do that.
 */
export async function getCoachSituationProjection(
  context: SituationContext,
  providers: DecisionCandidateProvider[],
): Promise<CoachSituationProjection> {
  const candidateLists = await Promise.all(providers.map((p) => p.getCandidates(context)));
  const candidates = candidateLists.flat();
  return projectCandidates(context, candidates);
}

/** Exposed separately so callers that already have candidates (e.g. tests, or a caller composing
 * providers itself) can skip the provider-invocation step. */
export async function projectCandidates(
  context: SituationContext,
  candidates: CoachDecisionCandidate[],
): Promise<CoachSituationProjection> {
  const evaluations = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      outcome: await evaluateSituationPolicy(context, candidate),
    })),
  );

  let anyDegraded = false;
  let deferredCount = 0;
  const decisions: CoachDecision[] = [];

  for (const { candidate, outcome } of evaluations) {
    if (outcome.policyRuntimeStatus === "DEGRADED") anyDegraded = true;

    const { result } = outcome;
    if (result.visibility === "SUPPRESS") continue;
    if (result.visibility === "DEFER") {
      deferredCount++;
      continue;
    }

    decisions.push(toCoachDecision(context, candidate, result));
  }

  decisions.sort(compareDecisions);

  return {
    situation: context,
    decisions,
    deferredCount,
    status: computeStatus(context, decisions),
    policyRuntimeStatus: anyDegraded ? "DEGRADED" : "HEALTHY",
  };
}

function toCoachDecision(
  context: SituationContext,
  candidate: CoachDecisionCandidate,
  result: SituationPolicyResult,
): CoachDecision {
  return {
    id: `${context.primarySituation}|${candidate.id}`,
    candidateId: candidate.id,
    situation: context.primarySituation,
    horizon: result.horizon,
    visibility: result.visibility,
    urgency: result.urgency,
    interaction: result.interaction,
    title: candidate.title,
    summary: candidate.summary,
    recommendedAction: candidate.recommendedAction,
    alternatives: candidate.alternativeActions,
    affectedEntities: [{ entityType: candidate.entityType, entityId: candidate.entityId }],
    deadlineAt: candidate.deadlineAt,
    deepLink: candidate.defaultDeepLink,
    reasonCodes: result.reasonCodes,
  };
}

/**
 * Collapses docs/domain/situational-decision-support.md §"Ordering"'s 10-class precedence list
 * into the fields actually available on a normalized `CoachDecision` (urgency/horizon/visibility)
 * — a deliberate, documented simplification, not a silent deviation:
 *   1: active/live or imminent hard consequence (NOW + IMMEDIATE)
 *   2: other immediate-horizon work (NOW)
 *   3: deadline-sensitive preparation (SOON)
 *   4: next-round blocker (NEXT + PROMOTE)
 *   5: next-round decision (NEXT)
 *   6: long-term analysis promoted as primary content (LONG_TERM + PROMOTE)
 *   7: everything else (post-match work, administrative information, ...)
 */
function decisionTier(decision: CoachDecision): number {
  if (decision.horizon === "NOW" && decision.urgency === "IMMEDIATE") return 1;
  if (decision.horizon === "NOW") return 2;
  if (decision.urgency === "SOON") return 3;
  if (decision.horizon === "NEXT" && decision.visibility === "PROMOTE") return 4;
  if (decision.horizon === "NEXT") return 5;
  if (decision.horizon === "LONG_TERM" && decision.visibility === "PROMOTE") return 6;
  return 7;
}

function compareDecisions(a: CoachDecision, b: CoachDecision): number {
  const tierDiff = decisionTier(a) - decisionTier(b);
  if (tierDiff !== 0) return tierDiff;

  const aDeadline = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
  const bDeadline = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;

  // Stable, deterministic tie-break — never arbitrary.
  return a.id.localeCompare(b.id);
}

function computeStatus(context: SituationContext, decisions: CoachDecision[]): CoachSituationProjectionStatus {
  // A promoted decision always wins attention, even during an active match.
  if (decisions.some((d) => d.visibility === "PROMOTE")) return "ACTION_REQUIRED";
  if (context.activeMatchId) return "LIVE";
  if (decisions.length === 0) return "READY";
  return "REVIEW_AVAILABLE";
}
