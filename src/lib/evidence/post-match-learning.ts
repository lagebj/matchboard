import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { FootballMatchRef } from "./football-match-ref";
import { footballMatchRefEvidenceLeagueSeasonId, footballMatchRefSourceId } from "./football-match-ref";
import { logger } from "@/lib/logger";

export type LearningStepStatus = "APPLIED" | "SKIPPED" | "FAILED";

export type LearningStepResult = {
  status: LearningStepStatus;
  reason?: string;
};

export type PostMatchLearningResult = {
  actualTimeline: LearningStepResult;
  opponent: LearningStepResult;
  players: LearningStepResult;
  combinations: LearningStepResult;
};

function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * The one shared post-match learning orchestrator (ADR-0104). Called by League's
 * `completeReport()` and Event's `completeEventReport()` alike — neither owns a separate
 * copy of these steps. No step's failure blocks another, and no step's failure is the
 * caller's problem to handle: report completion always succeeds once the report itself is
 * valid, regardless of what happens here.
 */
export async function runPostMatchLearning(
  ref: FootballMatchRef,
  orgFilter: OrgFilterMode,
): Promise<PostMatchLearningResult> {
  const result: PostMatchLearningResult = {
    actualTimeline: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
    opponent: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
    players: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
    combinations: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
  };

  try {
    const { rebuildActualTimelineForRef } = await import("./actual-timeline");
    const outcome = await rebuildActualTimelineForRef(ref);
    result.actualTimeline =
      outcome.intervalsCreated > 0
        ? { status: "APPLIED" }
        : { status: "SKIPPED", reason: "NO_ACTUAL_TIMELINE" };
  } catch (error) {
    result.actualTimeline = { status: "FAILED", reason: failureReason(error) };
  }

  try {
    const { recordOpponentSportingEvidenceForRef } = await import("@/lib/opponents/sporting-level-recording");
    const outcome = await recordOpponentSportingEvidenceForRef(ref, orgFilter);
    result.opponent = outcome.recorded
      ? { status: "APPLIED" }
      : { status: "SKIPPED", reason: outcome.reason ?? "NOT_ELIGIBLE" };
  } catch (error) {
    result.opponent = { status: "FAILED", reason: failureReason(error) };
  }

  try {
    const { computeAndApplyPlayerEvidenceForMatch } = await import("./player-evidence-service");
    const outcome = await computeAndApplyPlayerEvidenceForMatch(ref, orgFilter.type === "org" ? { filter: orgFilter.filter } : undefined);
    result.players =
      outcome.proposalsComputed > 0
        ? { status: "APPLIED" }
        : { status: "SKIPPED", reason: "NO_FOOTBALL_OBSERVATIONS" };
  } catch (error) {
    result.players = { status: "FAILED", reason: failureReason(error) };
  }

  const evidenceLeagueSeasonId = footballMatchRefEvidenceLeagueSeasonId(ref);
  if (!evidenceLeagueSeasonId) {
    result.combinations = { status: "SKIPPED", reason: "NO_EVIDENCE_SEASON" };
  } else {
    try {
      const { rebuildMatchCombinationEvidence } = await import("./combination-aggregation");
      const outcome = await rebuildMatchCombinationEvidence(ref, evidenceLeagueSeasonId);
      result.combinations =
        outcome.evidenceCreated > 0
          ? { status: "APPLIED" }
          : { status: "SKIPPED", reason: "INSUFFICIENT_POSITION_DATA" };
    } catch (error) {
      result.combinations = { status: "FAILED", reason: failureReason(error) };
    }
  }

  const failedSteps = Object.entries(result).filter(([, r]) => r.status === "FAILED");
  logger[failedSteps.length > 0 ? "warn" : "info"](
    {
      matchRefKind: ref.kind,
      sourceId: footballMatchRefSourceId(ref),
      organisationId: orgFilter.type === "org" ? orgFilter.organisationId : undefined,
      result,
    },
    "[PostMatchLearning] runPostMatchLearning completed",
  );

  return result;
}
