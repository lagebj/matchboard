import type {
  AssistantIssueEntityType,
  DecisionAction,
  DecisionRecord,
  DecisionType,
  MatchReview,
  ReadinessState,
  RoundReview,
  SelectionExplanation,
  TeamReadiness,
} from "./types";
import { db } from "@/lib/db";
import { WarningSeverity } from "@/generated/prisma/client";
import { signalCategoryFromSeverity } from "@/lib/selection/signal-category";

function mapSeverityToState(severity: string): ReadinessState {
  if (severity === "HARD_BLOCK") return "NOT_PLAYABLE";
  if (severity === "REQUIRES_OVERRIDE") return "AT_RISK";
  if (severity === "WARNING") return "WATCH";
  return "READY";
}

function mapSeverityToBlockerType(severity: WarningSeverity): "HARD" | "SOFT" | "NONE" {
  if (severity === WarningSeverity.HARD_BLOCK) return "HARD";
  if (severity === WarningSeverity.REQUIRES_OVERRIDE) return "SOFT";
  return "NONE";
}

function worstSeverity(severities: string[]): string {
  const order: Record<string, number> = { HARD_BLOCK: 0, REQUIRES_OVERRIDE: 1, WARNING: 2, SCORING_PREFERENCE: 3 };
  return severities.reduce((worst, s) => (order[s] ?? 3) < (order[worst] ?? 3) ? s : worst, "SCORING_PREFERENCE");
}

type AvailabilityBreakdown = {
  unavailablePlayerIds: string[];
  unknownRsvpPlayerIds: string[];
  tentativePlayerIds: string[];
};

async function getAvailabilityForTeamInRound(teamId: string, matchRoundId: string): Promise<AvailabilityBreakdown> {
  const teamPlayers = await db.player.findMany({
    where: { coreTeamId: teamId, active: true },
    select: { id: true },
  });
  const playerIds = new Set(teamPlayers.map((p) => p.id));

  const availabilities = await db.availability.findMany({
    where: { matchRoundId, playerId: { in: [...playerIds] } },
  });

  const unavailable: string[] = [];
  const unknown: string[] = [];
  const tentative: string[] = [];

  const playersWithAvailability = new Set(availabilities.map((a) => a.playerId));

  for (const playerId of playerIds) {
    if (!playersWithAvailability.has(playerId)) {
      unknown.push(playerId);
      continue;
    }
    const avail = availabilities.find((a) => a.playerId === playerId);
    if (!avail) {
      unknown.push(playerId);
      continue;
    }
    const status = avail.status.toUpperCase();
    if (status === "INJURED" || status === "SICK" || status === "AWAY") {
      unavailable.push(playerId);
    } else if (status === "UNKNOWN") {
      unknown.push(playerId);
    } else if (status === "TENTATIVE") {
      tentative.push(playerId);
    }
  }

  return { unavailablePlayerIds: unavailable, unknownRsvpPlayerIds: unknown, tentativePlayerIds: tentative };
}

export async function getRoundReview(roundId: string): Promise<RoundReview> {
  const matchRound = await db.matchRound.findFirst({
    where: { id: roundId },
    include: { matches: { include: { team: true } } },
  });

  if (!matchRound) {
    return {
      roundId,
      title: `Round ${roundId}`,
      readinessState: "READY",
      teamReadiness: [],
      matchReviews: [],
      openIssueIds: [],
      blockedConditionCount: 0,
      decisionRequiredCount: 0,
      finalizeable: true,
    };
  }

  const warnings = await db.warning.findMany({ where: { matchRoundId: roundId } });
  const blockedConditions = warnings.filter((w) => w.severity === WarningSeverity.HARD_BLOCK);
  const decisionRequiredConditions = warnings.filter((w) => w.severity === WarningSeverity.REQUIRES_OVERRIDE);

  const matchReviews: MatchReview[] = await Promise.all(
    matchRound.matches.map(async (match) => {
      const matchWarnings = warnings.filter((w) => w.matchId === match.id);
      const selections = await db.selection.findMany({ where: { matchId: match.id, status: "DRAFT" } });
      const worst = matchWarnings.length > 0 ? worstSeverity(matchWarnings.map((w) => w.severity)) : "SCORING_PREFERENCE";
      const availability = await getAvailabilityForTeamInRound(match.teamId, roundId);

      return {
        matchId: match.id,
        teamId: match.teamId,
        teamName: match.team.name,
        readinessState: mapSeverityToState(worst),
        selectedPlayerIds: selections.map((s) => s.playerId),
        unavailablePlayerIds: availability.unavailablePlayerIds,
        unknownRsvpPlayerIds: [...availability.unknownRsvpPlayerIds, ...availability.tentativePlayerIds],
        eligibleNotSelectedPlayerIds: [],
        blockedPlayerIds: matchWarnings
          .filter((w) => w.severity === WarningSeverity.HARD_BLOCK && w.playerId)
          .map((w) => w.playerId!),
        positionGaps: [],
        ruleImpacts: matchWarnings.map((w) => ({
          ruleId: w.rule,
          ruleName: w.rule,
          effect: w.message,
          signalCategory: signalCategoryFromSeverity(w.severity as WarningSeverity),
          affectedPlayerIds: w.playerId ? [w.playerId] : [],
          affectedTeamIds: w.teamId ? [w.teamId] : [],
          blockerType: mapSeverityToBlockerType(w.severity as WarningSeverity),
          explanation: w.message,
        })),
        recommendations: [],
        crossTeamImpacts: [],
        approved: false,
        published: false,
      };
    }),
  );

  const teamReadiness: TeamReadiness[] = matchReviews.map((mr, idx) => {
    const team = matchRound.matches[idx]?.team;
    const targetSquadSize = team?.targetSquadSize ?? 11;
    const maxSquadSize = team?.maxSquadSize ?? 14;
    const selectedCount = mr.selectedPlayerIds.length;
    const supportNeeded = Math.max(0, targetSquadSize - selectedCount);
    return {
      teamId: mr.teamId,
      teamName: mr.teamName ?? mr.teamId,
      readinessState: mr.readinessState,
      confirmedPlayers: selectedCount,
      unknownRsvp: mr.unknownRsvpPlayerIds.length,
      unavailablePlayers: mr.unavailablePlayerIds.length,
      blockedPlayers: mr.blockedPlayerIds.length,
      targetSquadSize,
      maxSquadSize,
      supportNeeded,
      positionGaps: mr.positionGaps,
      rotationPressure: supportNeeded > 2 ? "HIGH" as const : supportNeeded > 0 ? "MEDIUM" as const : "LOW" as const,
      signals: mr.ruleImpacts.map((ri) => `${ri.ruleName}: ${ri.explanation}`),
      ruleImpacts: mr.ruleImpacts,
    };
  });

  const allStates = matchReviews.map((mr) => mr.readinessState);
  const worstState = allStates.length > 0
    ? allStates.reduce((worst, cur) => {
        const order: Record<string, number> = { NOT_PLAYABLE: 0, AT_RISK: 1, WATCH: 2, READY: 3 };
        return order[cur] < order[worst] ? cur : worst;
      })
    : "READY";

  return {
    roundId,
    title: matchRound.name,
    readinessState: worstState,
    teamReadiness,
    matchReviews,
    openIssueIds: [],
    blockedConditionCount: blockedConditions.length,
    decisionRequiredCount: decisionRequiredConditions.length,
    finalizeable: blockedConditions.length === 0 && decisionRequiredConditions.length === 0,
  };
}

export async function getTeamReadiness(teamId: string, matchId?: string): Promise<TeamReadiness> {
  const team = await db.team.findFirst({ where: { id: teamId } });

  if (!team) {
    return {
      teamId,
      teamName: teamId,
      readinessState: "READY",
      confirmedPlayers: 0,
      unknownRsvp: 0,
      unavailablePlayers: 0,
      blockedPlayers: 0,
      targetSquadSize: 11,
      maxSquadSize: 14,
      supportNeeded: 0,
      positionGaps: [],
      rotationPressure: "LOW",
      signals: [],
      ruleImpacts: [],
    };
  }

  const warnings = await db.warning.findMany({ where: { teamId } });
  const selections = await db.selection.findMany({ where: { match: { teamId }, status: "DRAFT" } });
  const supportNeeded = Math.max(0, team.targetSquadSize - selections.length);
  const worst = warnings.length > 0 ? worstSeverity(warnings.map((w) => w.severity)) : "SCORING_PREFERENCE";

  let matchRoundId: string | undefined;
  if (matchId) {
    const match = await db.match.findFirst({ where: { id: matchId }, select: { matchRoundId: true } });
    matchRoundId = match?.matchRoundId;
  } else {
    const latestDraftMatch = await db.match.findFirst({
      where: { teamId, matchRound: { status: "DRAFT" } },
      orderBy: { startsAt: "desc" },
      select: { matchRoundId: true },
    });
    matchRoundId = latestDraftMatch?.matchRoundId;
  }

  let unavailableCount = 0;
  let unknownRsvpCount = 0;
  if (matchRoundId) {
    const availability = await getAvailabilityForTeamInRound(teamId, matchRoundId);
    unavailableCount = availability.unavailablePlayerIds.length;
    unknownRsvpCount = availability.unknownRsvpPlayerIds.length + availability.tentativePlayerIds.length;
  }

  return {
    teamId: team.id,
    teamName: team.name,
    readinessState: mapSeverityToState(worst),
    confirmedPlayers: selections.length,
    unknownRsvp: unknownRsvpCount,
    unavailablePlayers: unavailableCount,
    blockedPlayers: warnings.filter((w) => w.severity === WarningSeverity.HARD_BLOCK).length,
    targetSquadSize: team.targetSquadSize,
    maxSquadSize: team.maxSquadSize,
    supportNeeded,
    positionGaps: [],
    rotationPressure: supportNeeded > 2 ? "HIGH" : supportNeeded > 0 ? "MEDIUM" : "LOW",
    signals: warnings.map((w) => `${w.rule}: ${w.message}`),
    ruleImpacts: warnings.map((w) => ({
      ruleId: w.rule,
      ruleName: w.rule,
      effect: w.message,
      signalCategory: signalCategoryFromSeverity(w.severity as WarningSeverity),
      affectedPlayerIds: w.playerId ? [w.playerId] : [],
      affectedTeamIds: w.teamId ? [w.teamId] : [],
      blockerType: mapSeverityToBlockerType(w.severity as WarningSeverity),
      explanation: w.message,
    })),
  };
}

export async function getMatchReview(matchId: string): Promise<MatchReview> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    include: { team: true },
  });

  if (!match) {
    return {
      matchId,
      teamId: "",
      readinessState: "READY",
      selectedPlayerIds: [],
      unavailablePlayerIds: [],
      unknownRsvpPlayerIds: [],
      eligibleNotSelectedPlayerIds: [],
      blockedPlayerIds: [],
      positionGaps: [],
      ruleImpacts: [],
      recommendations: [],
      crossTeamImpacts: [],
      approved: false,
      published: false,
    };
  }

  const warnings = await db.warning.findMany({ where: { matchId } });
  const selections = await db.selection.findMany({ where: { matchId, status: "DRAFT" } });
  const worst = warnings.length > 0 ? worstSeverity(warnings.map((w) => w.severity)) : "SCORING_PREFERENCE";
  const availability = await getAvailabilityForTeamInRound(match.teamId, match.matchRoundId);

  return {
    matchId,
    teamId: match.teamId,
    teamName: match.team.name,
    readinessState: mapSeverityToState(worst),
    selectedPlayerIds: selections.map((s) => s.playerId),
    unavailablePlayerIds: availability.unavailablePlayerIds,
    unknownRsvpPlayerIds: [...availability.unknownRsvpPlayerIds, ...availability.tentativePlayerIds],
    eligibleNotSelectedPlayerIds: [],
    blockedPlayerIds: warnings
      .filter((w) => w.severity === WarningSeverity.HARD_BLOCK && w.playerId)
      .map((w) => w.playerId!),
    positionGaps: [],
    ruleImpacts: warnings.map((w) => ({
      ruleId: w.rule,
      ruleName: w.rule,
      effect: w.message,
      signalCategory: signalCategoryFromSeverity(w.severity as WarningSeverity),
      affectedPlayerIds: w.playerId ? [w.playerId] : [],
      affectedTeamIds: w.teamId ? [w.teamId] : [],
      blockerType: mapSeverityToBlockerType(w.severity as WarningSeverity),
      explanation: w.message,
    })),
    recommendations: [],
    crossTeamImpacts: [],
    approved: false,
    published: false,
  };
}

export async function getSelectionExplanation(
  scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER",
  scopeId: string,
): Promise<SelectionExplanation | null> {
  const explanation = await db.selectionExplanation.findFirst({
    where: { scopeType, scopeId },
  });

  if (!explanation) return null;

  return {
    id: explanation.id,
    scopeType: explanation.scopeType as SelectionExplanation["scopeType"],
    scopeId: explanation.scopeId,
    matchId: explanation.matchId ?? undefined,
    teamId: explanation.teamId ?? undefined,
    playerId: explanation.playerId ?? undefined,
    summary: explanation.summary,
    rulesApplied: (explanation.rulesApplied as unknown as SelectionExplanation["rulesApplied"]) ?? [],
    blockers: (explanation.blockers as unknown as string[]) ?? [],
    signals: (explanation.warnings as unknown as string[]) ?? [],
    recommendations: (explanation.recommendations as unknown as SelectionExplanation["recommendations"]) ?? [],
    crossTeamImpacts: (explanation.crossTeamImpacts as unknown as SelectionExplanation["crossTeamImpacts"]) ?? [],
    createdAt: explanation.createdAt.toISOString(),
  };
}

export async function recordDecision(input: {
  decisionType: DecisionType;
  entityType: AssistantIssueEntityType;
  entityId: string;
  recommendationId?: string;
  action: DecisionAction;
  reason?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  organisationId: string;
}): Promise<DecisionRecord> {
  const decision = await db.decisionRecord.create({
    data: {
      organisationId: input.organisationId,
      decisionType: input.decisionType,
      entityType: input.entityType,
      entityId: input.entityId,
      recommendationId: input.recommendationId,
      action: input.action,
      reason: input.reason,
      createdBy: "coach",
      beforeSnapshot: input.beforeSnapshot ?? undefined,
      afterSnapshot: input.afterSnapshot ?? undefined,
    },
  });

  return {
    id: decision.id,
    decisionType: decision.decisionType as DecisionType,
    entityType: decision.entityType as AssistantIssueEntityType,
    entityId: decision.entityId,
    recommendationId: decision.recommendationId ?? undefined,
    action: decision.action as DecisionAction,
    reason: decision.reason ?? undefined,
    createdBy: decision.createdBy,
    createdAt: decision.createdAt.toISOString(),
    beforeSnapshot: (decision.beforeSnapshot as Record<string, unknown>) ?? undefined,
    afterSnapshot: (decision.afterSnapshot as Record<string, unknown>) ?? undefined,
  };
}

