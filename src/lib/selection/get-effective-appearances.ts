/**
 * @deprecated Use `effective-participation.ts` instead.
 *
 * This module is superseded by the effective participation layer which provides:
 * - More granular source tracking (PLANNED_DRAFT, PLANNED_FINALIZED, ACTUAL_REPORTED, ACTUAL_LOCKED)
 * - Role classification helpers (isCoreRole, isSupportRole, isDevelopmentRole)
 * - Proper NO_SHOW and absence handling
 * - countsForLoad/countsForFairness/countsForSeasonStats flags
 * - Season stats with flags
 *
 * Migration guide:
 * - getEffectiveAppearancesForMatch → getEffectiveMatchParticipation
 * - getEffectiveAppearancesForRound → getEffectiveRoundParticipation
 * - getPlayerActualSeasonStats → getEffectiveSeasonStats (note: requires planningPeriodId)
 *
 * This file is retained temporarily until all consumers are migrated.
 * See: src/app/(app)/players/[playerId]/page.tsx for the remaining consumer.
 */
import { db } from "@/lib/db";

export type EffectiveAppearance = {
  playerId: string;
  matchId: string;
  source: "PLANNED" | "ACTUAL";
  role?: string;
  attendanceStatus?: string;
};

export type EffectiveAppearancesResult = {
  appearances: EffectiveAppearance[];
  source: "PLANNED" | "ACTUAL";
  reportStatus: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED";
};

export async function getEffectiveAppearancesForMatch(
  matchId: string,
): Promise<EffectiveAppearancesResult> {
  const report = await db.postMatchReport.findUnique({
    where: { matchId },
    select: { id: true, status: true },
  });

  if (!report || report.status === "DRAFT") {
    const reportStatus = report?.status ?? "NOT_STARTED";
    const selections = await db.selection.findMany({
      where: { matchId, status: "FINALIZED" },
      select: { playerId: true, role: true },
    });

    return {
      appearances: selections.map((s) => ({
        playerId: s.playerId,
        matchId,
        source: "PLANNED" as const,
        role: s.role,
      })),
      source: "PLANNED",
      reportStatus,
    };
  }

  const actuals = await db.postMatchPlayerActual.findMany({
    where: {
      reportId: report.id,
      attendanceStatus: { not: "NO_SHOW" },
    },
    select: { playerId: true, matchId: true, source: true, attendanceStatus: true },
  });

  return {
    appearances: actuals.map((a) => ({
      playerId: a.playerId,
      matchId: a.matchId,
      source: "ACTUAL" as const,
      attendanceStatus: a.attendanceStatus,
    })),
    source: "ACTUAL",
    reportStatus: report.status,
  };
}

export async function getEffectiveAppearancesForRound(
  matchRoundId: string,
): Promise<Map<string, EffectiveAppearancesResult>> {
  const matches = await db.match.findMany({
    where: { matchRoundId },
    select: { id: true },
  });

  const results = new Map<string, EffectiveAppearancesResult>();

  for (const match of matches) {
    const result = await getEffectiveAppearancesForMatch(match.id);
    results.set(match.id, result);
  }

  return results;
}

export async function getPlayerActualSeasonStats(
  playerId: string,
): Promise<{
  actualAppearances: number;
  goals: number;
  assists: number;
  plannedButAbsent: number;
}> {
  const reports = await db.postMatchReport.findMany({
    where: { status: { in: ["REPORTED", "LOCKED"] } },
    select: { id: true },
  });

  if (reports.length === 0) {
    return { actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 };
  }

  const reportIds = reports.map((r) => r.id);

  const [actuals, stats, absences] = await Promise.all([
    db.postMatchPlayerActual.findMany({
      where: {
        reportId: { in: reportIds },
        playerId,
        attendanceStatus: { not: "NO_SHOW" },
      },
      select: { id: true },
    }),
    db.matchReportPlayerStat.findMany({
      where: {
        matchReportId: { in: reportIds },
        playerId,
      },
      select: { goals: true, assists: true },
    }),
    db.matchReportAbsence.findMany({
      where: {
        matchReportId: { in: reportIds },
        playerId,
      },
      select: { id: true },
    }),
  ]);

  const goals = stats.reduce((sum, s) => sum + s.goals, 0);
  const assists = stats.reduce((sum, s) => sum + s.assists, 0);

  return {
    actualAppearances: actuals.length,
    goals,
    assists,
    plannedButAbsent: absences.length,
  };
}