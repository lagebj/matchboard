/**
 * Situational decision-support type contracts (ADR-0107,
 * docs/domain/situational-decision-support.md). Pure types — no React, no Prisma.
 *
 * These are projections over one domain model, not persistent application modes and not
 * parallel sources of truth. `SituationContext` is derived fresh on every read.
 */

export type CoachingSituation = "MATCHDAY" | "NEXT" | "LONG_TERM";

export type SituationRouteIntent =
  | "TODAY"
  | "MATCH"
  | "ROUND"
  | "EVENT"
  | "PLAYER"
  | "INSIGHTS"
  | "DOMAIN_MANAGEMENT";

export type SituationContext = {
  nowIso: string;
  primarySituation: CoachingSituation;
  activeMatchId?: string;
  imminentMatchIds: string[];
  nextRoundId?: string;
  routeIntent?: SituationRouteIntent;
  temporal: {
    nearestKickoffMinutes?: number;
    nextRoundDays?: number;
  };
};

export type DecisionEntityType =
  | "ROUND"
  | "MATCH"
  | "TEAM"
  | "PLAYER"
  | "EVENT"
  | "REPORT"
  | "SELECTION"
  | "AVAILABILITY";

export type DecisionEntityReference = {
  entityType: DecisionEntityType;
  entityId: string;
};

export type DecisionConsequence =
  | "MATCH_NOT_PLAYABLE"
  | "SQUAD_DEGRADED"
  | "PLANNING_BLOCKED"
  | "PLAYER_OPPORTUNITY"
  | "POSITION_COVERAGE"
  | "RESPONSIBILITY_GAP"
  | "REPORTING_DEBT"
  | "DEVELOPMENT_SIGNAL"
  | "INFORMATION_ONLY";

export type DecisionActionCandidate = {
  label: string;
  href: string;
};

/**
 * A normalized candidate fact sent to the situation policy. Never a raw Prisma/domain object —
 * compact, deterministic, tenant-safe primitives only.
 */
export type DecisionFact = {
  code: string;
  numericValue?: number;
  booleanValue?: boolean;
  playerId?: string;
};

/**
 * Produced by a `DecisionCandidateProvider` from an existing domain owner's output. Providers
 * adapt; they never decide final situational relevance — that is the situation policy's job.
 */
export type CoachDecisionCandidate = {
  id: string;
  /** Provider id, e.g. "assistant-work-items" */
  source: string;
  entityType: DecisionEntityType;
  entityId: string;
  title: string;
  summary?: string;
  facts: DecisionFact[];
  consequences: DecisionConsequence[];
  affectedMatchIds: string[];
  affectedTeamIds: string[];
  affectedPlayerIds: string[];
  /** ISO timestamp of the deadline this candidate is tied to (e.g. kickoff), if any. */
  deadlineAt?: string;
  eventAt?: string;
  recommendedAction?: DecisionActionCandidate;
  alternativeActions: DecisionActionCandidate[];
  defaultDeepLink?: string;
  reversibleUntil?: string;
  sourceConfidence?: "LOW" | "MEDIUM" | "HIGH";
  /** True for candidates describing longitudinal/developmental signal rather than an
   * immediate operational fact (e.g. opportunity trends, opponent evidence over time). */
  isLongTermSignal?: boolean;
  /** True when this signal is relevant to a live NEXT-round trade-off (e.g. a tie-break
   * between two otherwise-equivalent players). Providers set this only when they know it. */
  affectsNextRoundDecision?: boolean;
  /** True when the candidate's own trade-offs are non-trivial enough that a coach should be
   * routed to a deep workspace rather than offered a single confirm/choose action. */
  requiresReview?: boolean;
};

export function assertCoachDecisionCandidate(
  candidate: CoachDecisionCandidate,
): asserts candidate is CoachDecisionCandidate {
  if (!candidate.id || !candidate.source || !candidate.entityId) {
    throw new Error(
      `Invalid CoachDecisionCandidate: id/source/entityId are required (got id=${candidate.id}, source=${candidate.source}, entityId=${candidate.entityId})`,
    );
  }
}

/** Interface every candidate provider implements. Providers adapt existing domain owners; they
 * must not implement final situation relevance themselves. */
export interface DecisionCandidateProvider {
  id: string;
  getCandidates(context: SituationContext): Promise<CoachDecisionCandidate[]> | CoachDecisionCandidate[];
}

export type DecisionVisibility = "PROMOTE" | "NORMAL" | "DEFER" | "SUPPRESS";
export type DecisionHorizon = "NOW" | "BEFORE_NEXT_MATCH" | "NEXT" | "LONG_TERM";
export type DecisionUrgency = "IMMEDIATE" | "SOON" | "NORMAL" | "LOW";
/** AUTO is reserved and MUST NOT be used for player/squad/lineup/opportunity/report/development
 * mutations in this programme (ADR-0107). No situation-policy caller in this codebase should ever
 * branch on AUTO as if it authorizes an automatic mutation. */
export type DecisionInteraction = "INFORM" | "CONFIRM" | "CHOOSE" | "REVIEW" | "AUTO";

export type SituationPolicyResult = {
  visibility: DecisionVisibility;
  horizon: DecisionHorizon;
  urgency: DecisionUrgency;
  interaction: DecisionInteraction;
  reasonCodes: string[];
  suppressNonessentialContext: boolean;
};

/** Normalized, coach-facing, ordered decision — the output of the projection service. */
export type CoachDecision = {
  id: string;
  candidateId: string;
  situation: CoachingSituation;
  horizon: DecisionHorizon;
  visibility: DecisionVisibility;
  urgency: DecisionUrgency;
  interaction: DecisionInteraction;
  title: string;
  summary?: string;
  recommendedAction?: DecisionActionCandidate;
  alternatives: DecisionActionCandidate[];
  affectedEntities: DecisionEntityReference[];
  deadlineAt?: string;
  deepLink?: string;
  reasonCodes: string[];
};

export type CoachSituationProjectionStatus = "ACTION_REQUIRED" | "READY" | "LIVE" | "REVIEW_AVAILABLE";

export type CoachSituationProjection = {
  situation: SituationContext;
  /** Every non-suppressed decision, already ordered (most relevant first). Deferred/suppressed
   * decisions are excluded from this list; `deferredCount` records how many were held back. */
  decisions: CoachDecision[];
  deferredCount: number;
  status: CoachSituationProjectionStatus;
  policyRuntimeStatus: "HEALTHY" | "DEGRADED";
};
