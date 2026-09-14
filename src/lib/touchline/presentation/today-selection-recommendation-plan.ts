/**
 * Today selection-decision recommendation planner (ADR-0141,
 * `03_DATA_AND_RECOMMENDATION_CONTRACT.md` "Pure recommendation planner" / "Coordinated
 * recommendation planner"). Pure and DB-free — every fact this module needs is already resolved
 * by its caller (`get-today-selection-recommendations.ts`), which does the batched database
 * work. This module never queries the database and never invents a new assignment algorithm: it
 * reuses `buildAssignmentContext()` (Round Board's own deterministic-destination chooser) and
 * `determineAutomaticRoleFromPaths()` (Round Board's own role deriver) exactly as the Round Board
 * production adapter does.
 *
 * Source population is out of scope for this module — the caller must have already restricted
 * candidates to `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` plan-integrity signals (this
 * module does not decide which players need an opportunity; plan integrity owns that).
 *
 * Coordination: recommendations are computed sequentially against a *projected* squad count per
 * match. A player's chosen destination reserves capacity in the projection so that a later
 * player's recommendation in the same batch is evaluated against the reserved state, not the
 * original database snapshot. The projection never mutates anything — it exists only inside this
 * pure function call.
 */

import { createHash } from "node:crypto";
import {
  buildAssignmentContext,
  type AssignmentSuggestionInput,
} from "@/lib/touchline/presentation/round-board-production-adapter";
import { determineAutomaticRoleFromPaths } from "@/lib/selection/determine-automatic-role";

export type TodaySelectionAvailability = "AVAILABLE" | "TENTATIVE" | "UNAVAILABLE";
export type TodaySelectionRole = "CORE" | "SUPPORT" | "DEVELOPMENT";

export type TodayRecommendationReason = { text: string };

/** One candidate destination match in the player's round, already resolved by the caller. */
export type TodayCandidateDestinationMatch = {
  matchId: string;
  teamId: string;
  teamName: string;
  teamKitColor: string | null;
  opponentName: string;
  targetSquadSize: number;
  /** Actual, currently-persisted squad count (never the projected count — the planner projects
   * internally). */
  currentSquadCount: number;
  /** True when this player's core team is this match's team. */
  isCoreTeam: boolean;
  /** Rotation-path roles (e.g. `["SUPPORT"]`, `["DEVELOPMENT"]`, `["SUPPORT","DEVELOPMENT"]`)
   * connecting the player's core team to this match's team; empty when no active path exists. */
  activePathRoles: string[];
  /** False when the match's planning boundary is closed, the match is cancelled, or planning is
   * already finalized — a direct recommendation is never eligible against such a destination. */
  planningOpen: boolean;
};

/** One missing-opportunity player, already resolved from a plan-integrity signal by the caller. */
export type TodayMissingOpportunityCandidate = {
  /** The originating `PlanIntegritySignal.idempotencyKey` — never a new UI-only id. */
  signalKey: string;
  playerId: string;
  displayName: string;
  availability: TodaySelectionAvailability;
  isActive: boolean;
  coreTeamId: string | null;
  matchRoundId: string;
  roundLabel: string;
  roundBoardHref: string;
  /** True when, at load time, this player already has a same-round selection — a stale signal
   * that must never produce a direct recommendation. */
  hasSameRoundAssignment: boolean;
  /** From `PlanIntegritySignal.repeatedContext` — 0 when absent. */
  repeatedMissedRoundCount: number;
  candidateMatches: TodayCandidateDestinationMatch[];
  /** Position in the caller's already-ordered situational projection, when this signal is
   * represented there (decision order rule 1); `null` when it is only known from plan integrity
   * directly (decision order rule 2). */
  projectionOrderIndex: number | null;
};

export type TodaySelectionRecommendation = {
  targetMatchId: string;
  targetTeamName: string;
  opponentName: string;
  role: TodaySelectionRole;
  fingerprint: string;
  directlyActionable: boolean;
  dependsOnPrior: boolean;
  prerequisiteSignalKeys: string[];
  unavailableReason: string | null;
};

export type TodaySelectionDecision = {
  signalKey: string;
  playerId: string;
  displayName: string;
  availability: TodaySelectionAvailability;
  roundId: string;
  roundLabel: string;
  problemTitle: string;
  problemDetail: string;
  reasons: TodayRecommendationReason[];
  recommendation: TodaySelectionRecommendation | null;
  roundBoardHref: string;
};

const SCHEMA_VERSION = 1;
const MAX_VISIBLE_REASONS = 3;

function sortCandidates(
  candidates: TodayMissingOpportunityCandidate[],
): TodayMissingOpportunityCandidate[] {
  return [...candidates].sort((a, b) => {
    const aOrder = a.projectionOrderIndex ?? Number.POSITIVE_INFINITY;
    const bOrder = b.projectionOrderIndex ?? Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.repeatedMissedRoundCount !== b.repeatedMissedRoundCount) {
      return b.repeatedMissedRoundCount - a.repeatedMissedRoundCount;
    }
    const nameCompare = a.displayName.localeCompare(b.displayName);
    if (nameCompare !== 0) return nameCompare;
    return a.playerId.localeCompare(b.playerId);
  });
}

function deriveRole(
  coreTeamId: string | null,
  candidate: TodayCandidateDestinationMatch,
): TodaySelectionRole {
  return determineAutomaticRoleFromPaths(coreTeamId, candidate.teamId, candidate.activePathRoles);
}

function toAssignmentSuggestionInputs(
  candidate: TodayMissingOpportunityCandidate,
  squadCountByMatchId: Map<string, number>,
): AssignmentSuggestionInput[] {
  return candidate.candidateMatches.map((m) => ({
    matchId: m.matchId,
    teamName: m.teamName,
    teamKitColor: m.teamKitColor,
    targetTeamId: m.teamId,
    currentSquadCount: squadCountByMatchId.get(m.matchId) ?? m.currentSquadCount,
    targetCount: m.targetSquadSize,
    derivedRole: deriveRole(candidate.coreTeamId, m),
    isCoreTeam: m.isCoreTeam,
    hasRotationPath: m.activePathRoles.length > 0,
  }));
}

/** Resolves the deterministic destination for a candidate against a given squad-count snapshot,
 * reusing `buildAssignmentContext()` exactly as Round Board does. Returns `null` when there is no
 * planning-open candidate match at all. */
function resolveTarget(
  candidate: TodayMissingOpportunityCandidate,
  squadCountByMatchId: Map<string, number>,
): { matchId: string; teamName: string; role: TodaySelectionRole; validPath: boolean; overCapacity: boolean; planningOpen: boolean } | null {
  const openMatches = candidate.candidateMatches.filter((m) => m.planningOpen);
  if (openMatches.length === 0) return null;

  const suggestionInputs = toAssignmentSuggestionInputs(
    { ...candidate, candidateMatches: openMatches },
    squadCountByMatchId,
  );

  const context = buildAssignmentContext(
    {
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      shirtNumber: null,
      kitColor: null,
      positions: [],
      attentionSummary: null,
    },
    suggestionInputs,
  );

  const recommended = context.suggestions.find((s) => s.isRecommended);
  if (!recommended) return null;

  const sourceMatch = openMatches.find((m) => m.matchId === recommended.matchId);
  if (!sourceMatch) return null;

  const role = deriveRole(candidate.coreTeamId, sourceMatch);
  const validPath = sourceMatch.isCoreTeam || sourceMatch.activePathRoles.length > 0;
  const overCapacity = recommended.resultingSquadCount > recommended.targetCount;

  return {
    matchId: recommended.matchId,
    teamName: recommended.teamName,
    role,
    validPath,
    overCapacity,
    planningOpen: true,
  };
}

function computeFingerprint(input: {
  roundId: string;
  signalKey: string;
  playerId: string;
  targetMatchId: string;
  role: TodaySelectionRole;
  actualTargetSquadCount: number;
  targetSquadSize: number;
  availability: TodaySelectionAvailability;
  rotationPathRoleSet: string[];
  orderedReasonFacts: string[];
  prerequisiteSignalKeys: string[];
}): string {
  const canonical = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    roundId: input.roundId,
    planIntegritySignalKey: input.signalKey,
    playerId: input.playerId,
    targetMatchId: input.targetMatchId,
    role: input.role,
    actualTargetSquadCount: input.actualTargetSquadCount,
    targetSquadSize: input.targetSquadSize,
    availability: input.availability,
    rotationPathRoleSet: [...input.rotationPathRoleSet].sort(),
    orderedReasonFacts: input.orderedReasonFacts,
    prerequisiteSignalKeys: [...input.prerequisiteSignalKeys].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function buildReasons(
  candidate: TodayMissingOpportunityCandidate,
  target: { teamName: string; role: TodaySelectionRole; validPath: boolean } | null,
): TodayRecommendationReason[] {
  const reasons: TodayRecommendationReason[] = [];

  // 1. why the player requires a decision now.
  reasons.push({
    text: `No planned match opportunity in ${candidate.roundLabel}.`,
  });

  // 2 & 3. why the target needs a player now / why this player can legitimately move there.
  if (target) {
    if (target.role === "CORE" && target.validPath) {
      reasons.push({ text: `${target.teamName} is ${candidate.displayName.split(" ")[0]}'s core team and has room this round.` });
    } else if (target.role === "SUPPORT") {
      reasons.push({ text: `${target.teamName} has a support opening this round.` });
      reasons.push({ text: "Counts as support opportunity." });
    } else if (target.role === "DEVELOPMENT") {
      reasons.push({ text: `${target.teamName} has a development opening this round.` });
      reasons.push({ text: "Development movement via rotation path." });
    } else {
      reasons.push({ text: `${target.teamName} has an opening but no active rotation path.` });
    }
  }

  if (candidate.repeatedMissedRoundCount > 0) {
    reasons.push({
      text:
        candidate.repeatedMissedRoundCount === 1
          ? `${candidate.displayName} also missed a planned opportunity in the previous round.`
          : `${candidate.displayName} also missed a planned opportunity in ${candidate.repeatedMissedRoundCount} previous rounds.`,
    });
  }

  return reasons.slice(0, MAX_VISIBLE_REASONS);
}

/**
 * Plans coordinated Today selection-decision recommendations.
 *
 * `actualSquadCountByMatchId` seeds the projection from real current counts; recommendations are
 * computed one candidate at a time in the canonical decision order, and each chosen destination
 * reserves projected capacity before the next candidate is evaluated.
 */
export function planTodaySelectionRecommendations(
  candidates: TodayMissingOpportunityCandidate[],
): TodaySelectionDecision[] {
  const ordered = sortCandidates(candidates);

  const projectedSquadCountByMatchId = new Map<string, number>();
  const actualSquadCountByMatchId = new Map<string, number>();
  for (const candidate of ordered) {
    for (const m of candidate.candidateMatches) {
      if (!projectedSquadCountByMatchId.has(m.matchId)) {
        projectedSquadCountByMatchId.set(m.matchId, m.currentSquadCount);
        actualSquadCountByMatchId.set(m.matchId, m.currentSquadCount);
      }
    }
  }

  const decisions: TodaySelectionDecision[] = [];
  const appliedTargetByMatchId = new Map<string, string[]>(); // matchId -> signalKeys reserved there

  for (const candidate of ordered) {
    const problemTitle = `${candidate.displayName} has no planned match opportunity this round.`;
    const problemDetail = "No planned match opportunity this round.";

    // Actual (unprojected) recommendation — used to decide whether coordination changed anything.
    const actualTarget = resolveTarget(candidate, actualSquadCountByMatchId);
    // Projected (coordinated) recommendation — used as the target actually shown/reserved.
    const projectedTarget = resolveTarget(candidate, projectedSquadCountByMatchId);

    const reasons = buildReasons(candidate, projectedTarget ?? actualTarget);

    if (!projectedTarget) {
      decisions.push({
        signalKey: candidate.signalKey,
        playerId: candidate.playerId,
        displayName: candidate.displayName,
        availability: candidate.availability,
        roundId: candidate.matchRoundId,
        roundLabel: candidate.roundLabel,
        problemTitle,
        problemDetail,
        reasons,
        recommendation: null,
        roundBoardHref: candidate.roundBoardHref,
      });
      continue;
    }

    // Reserve projected capacity for later candidates regardless of direct-actionability —
    // coordination exists so a prior recommendation always reserves capacity for later ones.
    projectedSquadCountByMatchId.set(
      projectedTarget.matchId,
      (projectedSquadCountByMatchId.get(projectedTarget.matchId) ?? 0) + 1,
    );
    const reservedBy = appliedTargetByMatchId.get(projectedTarget.matchId) ?? [];
    reservedBy.push(candidate.signalKey);
    appliedTargetByMatchId.set(projectedTarget.matchId, reservedBy);

    const dependsOnPrior = !actualTarget || actualTarget.matchId !== projectedTarget.matchId;
    const prerequisiteSignalKeys = dependsOnPrior
      ? (appliedTargetByMatchId.get(projectedTarget.matchId) ?? []).filter((k) => k !== candidate.signalKey)
      : [];

    const targetMatch = candidate.candidateMatches.find((m) => m.matchId === projectedTarget.matchId)!;

    const eligible =
      !dependsOnPrior &&
      candidate.availability === "AVAILABLE" &&
      candidate.isActive &&
      !candidate.hasSameRoundAssignment &&
      projectedTarget.planningOpen &&
      !projectedTarget.overCapacity &&
      projectedTarget.validPath;

    const unavailableReason = eligible
      ? null
      : dependsOnPrior
        ? "Resolve earlier decision first."
        : candidate.availability === "TENTATIVE"
          ? "Player availability is tentative — review before assigning."
          : candidate.hasSameRoundAssignment
            ? "Player already has a planned opportunity this round."
            : !projectedTarget.validPath
              ? "No active rotation path — requires an override reason in Round Board."
              : projectedTarget.overCapacity
                ? "Destination is already at its target squad size."
                : null;

    const recommendation: TodaySelectionRecommendation = {
      targetMatchId: projectedTarget.matchId,
      targetTeamName: targetMatch.teamName,
      opponentName: targetMatch.opponentName,
      role: projectedTarget.role,
      fingerprint: computeFingerprint({
        roundId: candidate.matchRoundId,
        signalKey: candidate.signalKey,
        playerId: candidate.playerId,
        targetMatchId: projectedTarget.matchId,
        role: projectedTarget.role,
        actualTargetSquadCount: targetMatch.currentSquadCount,
        targetSquadSize: targetMatch.targetSquadSize,
        availability: candidate.availability,
        rotationPathRoleSet: targetMatch.activePathRoles,
        orderedReasonFacts: reasons.map((r) => r.text),
        prerequisiteSignalKeys,
      }),
      directlyActionable: eligible,
      dependsOnPrior,
      prerequisiteSignalKeys,
      unavailableReason,
    };

    decisions.push({
      signalKey: candidate.signalKey,
      playerId: candidate.playerId,
      displayName: candidate.displayName,
      availability: candidate.availability,
      roundId: candidate.matchRoundId,
      roundLabel: candidate.roundLabel,
      problemTitle,
      problemDetail,
      reasons,
      recommendation,
      roundBoardHref: candidate.roundBoardHref,
    });
  }

  return decisions;
}
