import type { PrismaClient } from "@/generated/prisma/client";
import { db as defaultDb } from "@/lib/db";
import type { IntegrityAuditInput, IntegrityAuditResult, IntegrityFinding, IntegrityDomain, IntegritySeverity } from "./types";

type Dbc = PrismaClient;
type CompletedReportStatus = "REPORTED" | "LOCKED";

const COMPLETED_STATUSES: CompletedReportStatus[] = ["REPORTED", "LOCKED"];

async function checkGoalAggregateDiffersFromGoalEvents(
  db: Dbc,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const where = {
    status: { in: COMPLETED_STATUSES },
    ...(scope.matchId ? { matchId: scope.matchId } : {}),
  };

  const reports = await db.postMatchReport.findMany({
    where,
    select: {
      id: true,
      matchId: true,
      playerStats: { select: { playerId: true, goals: true } },
      goals: { select: { playerId: true } },
    },
  });

  const filteredReports = scope.leagueSeasonId
    ? await filterByLeagueSeason(db, reports, scope.leagueSeasonId)
    : reports;

  for (const report of filteredReports) {
    const statGoalCounts = new Map<string, number>();
    for (const stat of report.playerStats) {
      if (stat.goals > 0) {
        statGoalCounts.set(stat.playerId, (statGoalCounts.get(stat.playerId) ?? 0) + stat.goals);
      }
    }

    const eventGoalCounts = new Map<string, number>();
    for (const goal of report.goals) {
      if (goal.playerId) {
        eventGoalCounts.set(goal.playerId, (eventGoalCounts.get(goal.playerId) ?? 0) + 1);
      }
    }

    const allPlayerIds = new Set([...statGoalCounts.keys(), ...eventGoalCounts.keys()]);
    for (const playerId of allPlayerIds) {
      const statGoals = statGoalCounts.get(playerId) ?? 0;
      const eventGoals = eventGoalCounts.get(playerId) ?? 0;
      if (statGoals !== eventGoals) {
        findings.push({
          code: "PLAYER_GOAL_AGGREGATE_DIFFERS_FROM_GOAL_EVENTS",
          severity: "REVIEW",
          domain: "PLAYER_GOALS" as IntegrityDomain,
          entityType: "PostMatchPlayerStat",
          entityId: playerId,
          matchId: report.matchId,
          playerId,
          message: `Goal-event count (${eventGoals}) differs from aggregate player-stat goals (${statGoals})`,
          canonicalValue: eventGoals,
          conflictingValue: statGoals,
          repairability: "REQUIRES_FACTUAL_REVIEW",
          recommendedAction: "Review Goal events for this player in this report. Do not infer events from the aggregate.",
        });
      }
    }
  }
}

async function checkAssistAggregateDiffersFromAssistEvents(
  db: Dbc,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const where = {
    status: { in: COMPLETED_STATUSES },
    ...(scope.matchId ? { matchId: scope.matchId } : {}),
  };

  const reports = await db.postMatchReport.findMany({
    where,
    select: {
      id: true,
      matchId: true,
      playerStats: { select: { playerId: true, assists: true } },
      assists: { select: { playerId: true } },
    },
  });

  const filteredReports = scope.leagueSeasonId
    ? await filterByLeagueSeason(db, reports, scope.leagueSeasonId)
    : reports;

  for (const report of filteredReports) {
    const statAssistCounts = new Map<string, number>();
    for (const stat of report.playerStats) {
      if (stat.assists > 0) {
        statAssistCounts.set(stat.playerId, (statAssistCounts.get(stat.playerId) ?? 0) + stat.assists);
      }
    }

    const eventAssistCounts = new Map<string, number>();
    for (const assist of report.assists) {
      eventAssistCounts.set(assist.playerId, (eventAssistCounts.get(assist.playerId) ?? 0) + 1);
    }

    const allPlayerIds = new Set([...statAssistCounts.keys(), ...eventAssistCounts.keys()]);
    for (const playerId of allPlayerIds) {
      const statAssists = statAssistCounts.get(playerId) ?? 0;
      const eventAssists = eventAssistCounts.get(playerId) ?? 0;
      if (statAssists !== eventAssists) {
        findings.push({
          code: "PLAYER_ASSIST_AGGREGATE_DIFFERS_FROM_ASSIST_EVENTS",
          severity: "REVIEW",
          domain: "PLAYER_ASSISTS" as IntegrityDomain,
          entityType: "PostMatchPlayerStat",
          entityId: playerId,
          matchId: report.matchId,
          playerId,
          message: `Assist-event count (${eventAssists}) differs from aggregate player-stat assists (${statAssists})`,
          canonicalValue: eventAssists,
          conflictingValue: statAssists,
          repairability: "REQUIRES_FACTUAL_REVIEW",
          recommendedAction: "Review Assist events for this player in this report. Do not infer events from the aggregate.",
        });
      }
    }
  }
}

async function checkReportedUnknownAttendance(
  db: Dbc,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const where = {
    attendanceStatus: "UNKNOWN" as const,
    report: { status: { in: COMPLETED_STATUSES } },
    ...(scope.matchId ? { matchId: scope.matchId } : {}),
  };

  const unknownActuals = await db.postMatchPlayerActual.findMany({
    where,
    select: {
      id: true,
      playerId: true,
      matchId: true,
      reportId: true,
    },
  });

  const filteredActuals = scope.leagueSeasonId
    ? await filterByLeagueSeason(db, unknownActuals, scope.leagueSeasonId)
    : unknownActuals;

  for (const actual of filteredActuals) {
    findings.push({
      code: "REPORTED_REPORT_HAS_UNKNOWN_ATTENDANCE",
      severity: "ERROR" as IntegritySeverity,
      domain: "ACTUAL_APPEARANCES" as IntegrityDomain,
      entityType: "PostMatchPlayerActual",
      entityId: actual.id,
      matchId: actual.matchId,
      playerId: actual.playerId,
      message: `Reported/locked report has UNKNOWN attendance for player`,
      repairability: "REQUIRES_FACTUAL_REVIEW",
      recommendedAction: "Resolve attendance before trusting appearance counts. Do not automatically convert UNKNOWN.",
    });
  }
}

async function checkPlannedPlayerNotPresentWithoutAbsenceReason(
  db: Dbc,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const matchIds = scope.matchId
    ? [scope.matchId]
    : await getCompletedMatchIds(db, scope.leagueSeasonId);

  for (const matchId of matchIds) {
    const finalizedSelections = await db.selection.findMany({
      where: { matchId, status: "FINALIZED" },
      select: { playerId: true },
    });

    const plannedPlayerIds = new Set(finalizedSelections.map((s) => s.playerId));

    const actuals = await db.postMatchPlayerActual.findMany({
      where: {
        matchId,
        report: { status: { in: COMPLETED_STATUSES } },
      },
      select: { playerId: true, attendanceStatus: true },
    });

    const presentPlayerIds = new Set(
      actuals.filter((a) => a.attendanceStatus === "PRESENT").map((a) => a.playerId),
    );

    const absences = await db.matchReportAbsence.findMany({
      where: {
        matchId,
        report: { status: { in: COMPLETED_STATUSES } },
      },
      select: { playerId: true },
    });

    const absentPlayerIds = new Set(absences.map((a) => a.playerId));

    for (const playerId of plannedPlayerIds) {
      const isPresent = presentPlayerIds.has(playerId);
      const hasAbsence = absentPlayerIds.has(playerId);

      if (!isPresent && !hasAbsence) {
        findings.push({
          code: "PLANNED_PLAYER_NOT_PRESENT_WITHOUT_ABSENCE_REASON",
          severity: "REVIEW" as IntegritySeverity,
          domain: "PLANNED_ABSENCES" as IntegrityDomain,
          entityType: "MatchReportAbsence",
          entityId: playerId,
          matchId,
          playerId,
          message: `Finalized planned player is not PRESENT and has no structured absence reason in completed report`,
          repairability: "REQUIRES_FACTUAL_REVIEW",
          recommendedAction: "Record a structured absence reason for this planned player.",
        });
      }

      if (isPresent && hasAbsence) {
        findings.push({
          code: "CONTRADICTORY_PRESENT_AND_ABSENT",
          severity: "ERROR" as IntegritySeverity,
          domain: "PLANNED_ABSENCES" as IntegrityDomain,
          entityType: "MatchReportAbsence",
          entityId: playerId,
          matchId,
          playerId,
          message: `Player is both PRESENT and has an absence record in the same completed report`,
          canonicalValue: "PRESENT",
          conflictingValue: "has absence record",
          repairability: "REQUIRES_FACTUAL_REVIEW",
          recommendedAction: "Remove the absence record or change attendance to not PRESENT.",
        });
      }
    }
  }
}

async function checkGoalEventCountExceedsTeamScore(
  db: Dbc,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const matchIds = scope.matchId
    ? [scope.matchId]
    : await getCompletedMatchIds(db, scope.leagueSeasonId);

  for (const matchId of matchIds) {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { id: true, teamId: true, homeAway: true },
    });
    if (!match) continue;

    const reports = await db.postMatchReport.findMany({
      where: {
        matchId,
        status: { in: COMPLETED_STATUSES },
        homeGoals: { not: null },
        awayGoals: { not: null },
      },
      select: {
        id: true,
        homeGoals: true,
        awayGoals: true,
        goals: { select: { playerId: true } },
      },
    });

    for (const report of reports) {
      const isHome = match.homeAway === "HOME";
      const ownTeamScore = isHome ? report.homeGoals! : report.awayGoals!;
      const ownPlayerGoalCount = report.goals.filter((g) => g.playerId !== null).length;

      if (ownPlayerGoalCount > ownTeamScore) {
        findings.push({
          code: "GOAL_EVENT_COUNT_EXCEEDS_RECORDED_TEAM_SCORE",
          severity: "ERROR" as IntegritySeverity,
          domain: "MATCH_SCORE_GOAL_EVENTS" as IntegrityDomain,
          entityType: "PostMatchReport",
          entityId: report.id,
          matchId,
          message: `Known own-player Goal events (${ownPlayerGoalCount}) exceed recorded own-team score (${ownTeamScore})`,
          canonicalValue: ownTeamScore,
          conflictingValue: ownPlayerGoalCount,
          repairability: "REQUIRES_FACTUAL_REVIEW",
          recommendedAction: "Correct the goal events or the recorded score. Do not attribute unregistered goals to any player.",
        });
      }
    }
  }
}

async function checkCandidateSupportConfigDivergence(
  db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const teams = await db.team.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, minSupportCount: true, minSupportPlayers: true },
  });

  for (const team of teams) {
    if (team.minSupportCount !== null && team.minSupportPlayers !== null && team.minSupportCount !== team.minSupportPlayers) {
      findings.push({
        code: "SUPPORT_CONFIG_COUNT_PLAYER_MISMATCH",
        severity: "INFO" as IntegritySeverity,
        domain: "SUPPORT_REQUIREMENT_CONFIG" as IntegrityDomain,
        entityType: "Team",
        entityId: team.id,
        message: `Team "${team.name}" has minSupportCount=${team.minSupportCount} but minSupportPlayers=${team.minSupportPlayers}`,
        canonicalValue: team.minSupportPlayers,
        conflictingValue: team.minSupportCount,
        repairability: "REPORT_ONLY",
        recommendedAction: "Audit: determine which field drives selection and unify or derive one from the other.",
      });
    }
  }
}

async function checkCandidateOpponentIdentityDivergence(
  db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<void> {
  const matchesWithOpponent = await db.match.findMany({
    where: {
      opponent: { not: "" },
    },
    select: {
      id: true,
      opponent: true,
      opponentTeamId: true,
    },
  });

  if (matchesWithOpponent.length === 0) return;

  const opponentTeamIds = [...new Set(matchesWithOpponent.map((m) => m.opponentTeamId))];
  const opponentTeams = await db.opponentTeam.findMany({
    where: { id: { in: opponentTeamIds } },
    select: { id: true, displayName: true },
  });
  const opponentTeamById = new Map(opponentTeams.map((ot) => [ot.id, ot]));

  for (const match of matchesWithOpponent) {
    const opponentTeam = opponentTeamById.get(match.opponentTeamId);
    if (opponentTeam && match.opponent !== opponentTeam.displayName) {
      findings.push({
        code: "OPPONENT_SNAPSHOT_DIFFERS_FROM_ENTITY",
        severity: "INFO" as IntegritySeverity,
        domain: "OPPONENT_IDENTITY" as IntegrityDomain,
        entityType: "Match",
        entityId: match.id,
        matchId: match.id,
        message: `Match opponent snapshot "${match.opponent}" differs from OpponentTeam "${opponentTeam.displayName}"`,
        canonicalValue: opponentTeam.displayName,
        conflictingValue: match.opponent,
        repairability: "REPORT_ONLY",
        recommendedAction: "Audit: decide whether opponent snapshot should be updated or kept as historical record.",
      });
    }
  }
}

async function checkCandidateSelectionExplanationDivergence(
  _db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  _findings: IntegrityFinding[],
): Promise<void> {
}
async function checkCandidateAvailabilityPrecedence(
  _db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  _findings: IntegrityFinding[],
): Promise<void> {
}
async function checkCandidateSupportNoShowCounterDrift(
  _db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  _findings: IntegrityFinding[],
): Promise<void> {
}
async function checkCandidateDoubleLoadLegacyRemnants(
  _db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  _findings: IntegrityFinding[],
): Promise<void> {
}
async function checkCandidateWarningProjectionDrift(
  _db: Dbc,
  _scope: { leagueSeasonId?: string; matchId?: string },
  _findings: IntegrityFinding[],
): Promise<void> {
}

async function filterByLeagueSeason<T extends { matchId: string }>(
  db: Dbc,
  items: T[],
  leagueSeasonId: string,
): Promise<T[]> {
  if (items.length === 0) return items;
  const matchIds = items.map((i) => i.matchId);
  const matchingMatchIds = new Set(
    (
      await db.match.findMany({
        where: { id: { in: matchIds }, matchRound: { leagueSeasonId } },
        select: { id: true },
      })
    ).map((m) => m.id),
  );
  return items.filter((i) => matchingMatchIds.has(i.matchId));
}

async function getCompletedMatchIds(db: Dbc, leagueSeasonId?: string): Promise<string[]> {
  if (leagueSeasonId) {
    const matches = await db.match.findMany({
      where: { matchRound: { leagueSeasonId } },
      select: { id: true },
    });
    return matches.map((m) => m.id);
  }
  const reports = await db.postMatchReport.findMany({
    where: { status: { in: COMPLETED_STATUSES } },
    select: { matchId: true },
  });
  return [...new Set(reports.map((r) => r.matchId))];
}

export async function auditDataIntegrity(input?: IntegrityAuditInput, dbClient?: PrismaClient): Promise<IntegrityAuditResult> {
  const db = dbClient ?? defaultDb;
  const scope = {
    leagueSeasonId: input?.leagueSeasonId,
    matchId: input?.matchId,
  };

  const findings: IntegrityFinding[] = [];

  await checkGoalAggregateDiffersFromGoalEvents(db, scope, findings);
  await checkAssistAggregateDiffersFromAssistEvents(db, scope, findings);
  await checkReportedUnknownAttendance(db, scope, findings);
  await checkPlannedPlayerNotPresentWithoutAbsenceReason(db, scope, findings);
  await checkGoalEventCountExceedsTeamScore(db, scope, findings);
  await checkCandidateSupportConfigDivergence(db, scope, findings);
  await checkCandidateOpponentIdentityDivergence(db, scope, findings);
  await checkCandidateSelectionExplanationDivergence(db, scope, findings);
  await checkCandidateAvailabilityPrecedence(db, scope, findings);
  await checkCandidateSupportNoShowCounterDrift(db, scope, findings);
  await checkCandidateDoubleLoadLegacyRemnants(db, scope, findings);
  await checkCandidateWarningProjectionDrift(db, scope, findings);

  const countsByDomain: Partial<Record<IntegrityDomain, number>> = {};
  const countsBySeverity: Partial<Record<IntegritySeverity, number>> = {};

  for (const f of findings) {
    countsByDomain[f.domain] = (countsByDomain[f.domain] ?? 0) + 1;
    countsBySeverity[f.severity] = (countsBySeverity[f.severity] ?? 0) + 1;
  }

  return {
    executedAt: new Date(),
    scope,
    countsByDomain,
    countsBySeverity,
    findings,
  };
}