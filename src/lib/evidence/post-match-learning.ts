import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
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

/** What kicked off a learning run — for the observable `PostMatchLearningRun` record (ADR-0127). */
export type PostMatchLearningTrigger = "REPORT_COMPLETION" | "REPLAY" | "RECONCILE";

export type LearningRunOutcome = "APPLIED" | "SKIPPED" | "FAILED";

/**
 * FAILED if any step failed; else APPLIED if any step applied; else SKIPPED. This is the
 * single fact an operator / integrity audit / retry tool checks — "did learning succeed for
 * this match?".
 */
export function summariseLearningOutcome(result: PostMatchLearningResult): LearningRunOutcome {
  const steps = Object.values(result);
  if (steps.some((s) => s.status === "FAILED")) return "FAILED";
  if (steps.some((s) => s.status === "APPLIED")) return "APPLIED";
  return "SKIPPED";
}

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
  trigger: PostMatchLearningTrigger = "REPORT_COMPLETION",
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
        : {
            status: "SKIPPED",
            // Distinguishes "no observations recorded for this match" from "observations
            // exist but haven't crossed evidence-accumulator.ts's MINIMUM_DISTINCT_MATCHES
            // threshold yet" -- verified against a real single-match fixture during manual
            // browser verification (Event Evidence Parity programme): the latter is a
            // legitimate, expected outcome, not a missing-input problem.
            reason: outcome.observationsFound === 0 ? "NO_FOOTBALL_OBSERVATIONS" : "INSUFFICIENT_DISTINCT_MATCHES",
          };
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

  const overallOutcome = summariseLearningOutcome(result);
  const organisationId = orgFilter.type === "org" ? orgFilter.organisationId : undefined;

  logger[overallOutcome === "FAILED" ? "warn" : "info"](
    { matchRefKind: ref.kind, sourceId: footballMatchRefSourceId(ref), organisationId, trigger, overallOutcome, result },
    "[PostMatchLearning] runPostMatchLearning completed",
  );

  // Authoritative, observable record of this run (ADR-0127). Best-effort: a persistence failure
  // here must never turn a swallowed learning failure into a completion failure, so it is
  // logged and dropped — the report is already LOCKED by the time this runs.
  if (organisationId) {
    try {
      await db.postMatchLearningRun.create({
        data: {
          organisationId,
          matchId: ref.kind === "LEAGUE_MATCH" ? ref.matchId : null,
          eventMatchId: ref.kind === "EVENT_MATCH" ? ref.eventMatchId : null,
          trigger,
          overallOutcome,
          steps: result as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error(
        { matchRefKind: ref.kind, sourceId: footballMatchRefSourceId(ref), organisationId, err: failureReason(error) },
        "[PostMatchLearning] failed to persist PostMatchLearningRun",
      );
    }
  }

  return result;
}
