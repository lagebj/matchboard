import type { PrismaClient } from "@/generated/prisma/client";
import { db as defaultDb } from "@/lib/db";
import type { IntegrityFinding, ReconcileInput, ReconcileResult } from "./types";

type Dbc = PrismaClient;

async function reconcilePlayerGoalsDerivedProjection(
  db: Dbc,
  dryRun: boolean,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<{ inspected: number; proposedChanges: number; appliedChanges: number; skipped: number }> {
  const completedReports = await db.postMatchReport.findMany({
    where: {
      status: { in: ["REPORTED", "LOCKED"] },
      ...(scope.matchId ? { matchId: scope.matchId } : {}),
    },
    select: {
      id: true,
      matchId: true,
      playerStats: {
        select: { id: true, playerId: true, goals: true },
      },
      goals: {
        select: { playerId: true },
      },
    },
  });

  const filteredReports = scope.leagueSeasonId
    ? await filterReportsByLeagueSeason(db, completedReports, scope.leagueSeasonId)
    : completedReports;

  let inspected = 0;
  let proposedChanges = 0;
  let appliedChanges = 0;
  let skipped = 0;

  for (const report of filteredReports) {
    const eventGoalCounts = new Map<string, number>();
    for (const goal of report.goals) {
      if (goal.playerId) {
        eventGoalCounts.set(goal.playerId, (eventGoalCounts.get(goal.playerId) ?? 0) + 1);
      }
    }

    for (const stat of report.playerStats) {
      inspected++;
      const canonicalGoals = eventGoalCounts.get(stat.playerId) ?? 0;
      if (stat.goals !== canonicalGoals) {
        proposedChanges++;
        findings.push({
          code: "PLAYER_GOALS_DERIVED_PROJECTION_RECONCILED",
          severity: "REVIEW" as const,
          domain: "PLAYER_GOALS" as const,
          entityType: "MatchReportPlayerStat",
          entityId: stat.id,
          matchId: report.matchId,
          playerId: stat.playerId,
          message: `Reconciled player-stat goals from ${stat.goals} to ${canonicalGoals} (derived from Goal events)`,
          canonicalValue: canonicalGoals,
          conflictingValue: stat.goals,
          repairability: "AUTO_SAFE",
          recommendedAction: "MatchReportPlayerStat.goals rebuilt from canonical Goal events",
        });

        if (!dryRun) {
          await db.matchReportPlayerStat.update({
            where: { id: stat.id },
            data: { goals: canonicalGoals },
          });
          appliedChanges++;
        } else {
          skipped++;
        }
      }
    }
  }

  return { inspected, proposedChanges, appliedChanges, skipped };
}

async function reconcilePlayerAssistsDerivedProjection(
  db: Dbc,
  dryRun: boolean,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<{ inspected: number; proposedChanges: number; appliedChanges: number; skipped: number }> {
  const completedReports = await db.postMatchReport.findMany({
    where: {
      status: { in: ["REPORTED", "LOCKED"] },
      ...(scope.matchId ? { matchId: scope.matchId } : {}),
    },
    select: {
      id: true,
      matchId: true,
      playerStats: {
        select: { id: true, playerId: true, assists: true },
      },
      assists: {
        select: { playerId: true },
      },
    },
  });

  const filteredReports = scope.leagueSeasonId
    ? await filterReportsByLeagueSeason(db, completedReports, scope.leagueSeasonId)
    : completedReports;

  let inspected = 0;
  let proposedChanges = 0;
  let appliedChanges = 0;
  let skipped = 0;

  for (const report of filteredReports) {
    const eventAssistCounts = new Map<string, number>();
    for (const assist of report.assists) {
      eventAssistCounts.set(assist.playerId, (eventAssistCounts.get(assist.playerId) ?? 0) + 1);
    }

    for (const stat of report.playerStats) {
      inspected++;
      const canonicalAssists = eventAssistCounts.get(stat.playerId) ?? 0;
      if (stat.assists !== canonicalAssists) {
        proposedChanges++;
        findings.push({
          code: "PLAYER_ASSISTS_DERIVED_PROJECTION_RECONCILED",
          severity: "REVIEW" as const,
          domain: "PLAYER_ASSISTS" as const,
          entityType: "MatchReportPlayerStat",
          entityId: stat.id,
          matchId: report.matchId,
          playerId: stat.playerId,
          message: `Reconciled player-stat assists from ${stat.assists} to ${canonicalAssists} (derived from Assist events)`,
          canonicalValue: canonicalAssists,
          conflictingValue: stat.assists,
          repairability: "AUTO_SAFE",
          recommendedAction: "MatchReportPlayerStat.assists rebuilt from canonical Assist events",
        });

        if (!dryRun) {
          await db.matchReportPlayerStat.update({
            where: { id: stat.id },
            data: { assists: canonicalAssists },
          });
          appliedChanges++;
        } else {
          skipped++;
        }
      }
    }
  }

  return { inspected, proposedChanges, appliedChanges, skipped };
}

async function reconcileOpponentSnapshotDerivedProjection(
  db: Dbc,
  dryRun: boolean,
  _scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<{ inspected: number; proposedChanges: number; appliedChanges: number; skipped: number }> {
  const matches = await db.match.findMany({
    where: {
      opponent: { not: "" },
      opponentTeamId: { not: null } as never,
    },
    select: {
      id: true,
      opponent: true,
      opponentTeamId: true,
    },
  });

  const opponentTeamIds = [...new Set(matches.map((m) => m.opponentTeamId!))];
  const opponentTeams = await db.opponentTeam.findMany({
    where: { id: { in: opponentTeamIds } },
    select: { id: true, displayName: true },
  });
  const opponentTeamById = new Map(opponentTeams.map((ot) => [ot.id, ot]));

  let inspected = 0;
  let proposedChanges = 0;
  let appliedChanges = 0;
  let skipped = 0;

  for (const match of matches) {
    inspected++;
    const opponentTeam = opponentTeamById.get(match.opponentTeamId!);
    if (!opponentTeam) continue;

    if (match.opponent !== opponentTeam.displayName) {
      proposedChanges++;
      findings.push({
        code: "OPPONENT_SNAPSHOT_RECONCILED",
        severity: "INFO" as const,
        domain: "OPPONENT_IDENTITY" as const,
        entityType: "Match",
        entityId: match.id,
        matchId: match.id,
        message: `Match opponent snapshot "${match.opponent}" differs from OpponentTeam "${opponentTeam.displayName}"`,
        canonicalValue: opponentTeam.displayName,
        conflictingValue: match.opponent,
        repairability: "AUTO_SAFE",
        recommendedAction: "Update Match.opponent to match OpponentTeam.displayName",
      });

      if (!dryRun) {
        await db.match.update({
          where: { id: match.id },
          data: { opponent: opponentTeam.displayName },
        });
        appliedChanges++;
      } else {
        skipped++;
      }
    }
  }

  return { inspected, proposedChanges, appliedChanges, skipped };
}

async function rebuildActivePlanIntegrityProjection(
  db: Dbc,
  dryRun: boolean,
  scope: { leagueSeasonId?: string; matchId?: string },
  findings: IntegrityFinding[],
): Promise<{ inspected: number; proposedChanges: number; appliedChanges: number; skipped: number }> {
  const { computeRoundPlanIntegrity } = await import("@/lib/selection/compute-plan-integrity");
  const { replaceRoundActiveSignals } = await import("@/lib/selection/reconcile-integrity");

  const whereClause: { status: string; id?: string; matchRound?: { leagueSeasonId?: string } } = {
    status: "DRAFT",
  };

  if (scope.matchId) {
    const match = await db.match.findUnique({
      where: { id: scope.matchId },
      select: { matchRoundId: true },
    });
    if (match) {
      whereClause.id = match.matchRoundId;
    }
  } else if (scope.leagueSeasonId) {
    whereClause.matchRound = { leagueSeasonId: scope.leagueSeasonId };
  }

  const rounds = await db.matchRound.findMany({
    where: whereClause,
    select: { id: true },
  });

  let inspected = 0;
  let proposedChanges = 0;
  let appliedChanges = 0;
  let skipped = 0;

  for (const round of rounds) {
    inspected++;
    const integrity = await computeRoundPlanIntegrity(round.id);

    const existingWarningCount = await db.warning.count({
      where: { matchRoundId: round.id },
    });

    if (existingWarningCount > 0 || integrity.summary.blockerCount > 0 || integrity.summary.decisionRequiredCount > 0) {
      proposedChanges++;

      if (!dryRun) {
        await replaceRoundActiveSignals(round.id, integrity);
        appliedChanges++;
      } else {
        findings.push({
          code: "ACTIVE_PLAN_INTEGRITY_PROJECTION_RECONCILED",
          severity: "INFO" as const,
          domain: "PLAN_INTEGRITY_PROJECTION" as const,
          entityType: "MatchRound",
          entityId: round.id,
          message: `Would reconcile warnings for round (existing: ${existingWarningCount}, computed blockers: ${integrity.summary.blockerCount}, decisions: ${integrity.summary.decisionRequiredCount})`,
          repairability: "AUTO_SAFE",
          recommendedAction: "Rebuild active warning rows from canonical plan integrity computation",
        });
        skipped++;
      }
    }
  }

  return { inspected, proposedChanges, appliedChanges, skipped };
}

export async function reconcileCanonicalDerivedData(input: ReconcileInput, dbClient?: PrismaClient): Promise<ReconcileResult> {
  const db = dbClient ?? defaultDb;
  const findings: IntegrityFinding[] = [];
  const scope = {
    leagueSeasonId: input.leagueSeasonId,
    matchId: input.matchId,
  };

  let totalInspected = 0;
  let totalProposedChanges = 0;
  let totalAppliedChanges = 0;
  const totalSkippedRequiresFactualReview = 0;

  for (const domain of input.domains) {
    if (domain === "PLAYER_GOALS_DERIVED_PROJECTION") {
      const result = await reconcilePlayerGoalsDerivedProjection(db, input.dryRun, scope, findings);
      totalInspected += result.inspected;
      totalProposedChanges += result.proposedChanges;
      totalAppliedChanges += result.appliedChanges;
    }

    if (domain === "PLAYER_ASSISTS_DERIVED_PROJECTION") {
      const result = await reconcilePlayerAssistsDerivedProjection(db, input.dryRun, scope, findings);
      totalInspected += result.inspected;
      totalProposedChanges += result.proposedChanges;
      totalAppliedChanges += result.appliedChanges;
    }

    if (domain === "OPPONENT_SNAPSHOT_DERIVED_PROJECTION") {
      const result = await reconcileOpponentSnapshotDerivedProjection(db, input.dryRun, scope, findings);
      totalInspected += result.inspected;
      totalProposedChanges += result.proposedChanges;
      totalAppliedChanges += result.appliedChanges;
    }

    if (domain === "ACTIVE_PLAN_INTEGRITY_PROJECTION") {
      const result = await rebuildActivePlanIntegrityProjection(db, input.dryRun, scope, findings);
      totalInspected += result.inspected;
      totalProposedChanges += result.proposedChanges;
      totalAppliedChanges += result.appliedChanges;
    }
  }

  return {
    dryRun: input.dryRun,
    inspected: totalInspected,
    proposedChanges: totalProposedChanges,
    appliedChanges: totalAppliedChanges,
    skippedRequiresFactualReview: totalSkippedRequiresFactualReview,
    findings,
  };
}

async function filterReportsByLeagueSeason<T extends { matchId: string }>(
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