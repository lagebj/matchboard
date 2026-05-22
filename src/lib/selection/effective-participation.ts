import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// --- Types ---

export type ParticipationSource =
  | "PLANNED_DRAFT"
  | "PLANNED_FINALIZED"
  | "ACTUAL_REPORTED"
  | "ACTUAL_LOCKED";

export type ActualAppearanceSource =
  | "PLANNED"
  | "ADDED_POST_MATCH"
  | "EMERGENCY_BACKFILL";

export type EffectiveParticipationRow = {
  playerId: string;
  matchId: string;
  matchRoundId: string;
  teamId: string;
  plannedRole: SelectionRole | null;
  actualSource: ActualAppearanceSource | null;
  plannedSelectionStatus: "DRAFT" | "FINALIZED" | null;
  reportStatus: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED" | null;
  played: boolean;
  absenceReason: string | null;
  countsForLoad: boolean;
  countsForFairness: boolean;
  countsForSeasonStats: boolean;
  source: ParticipationSource;
  goals: number;
  assists: number;
};

export type PlayerSeasonStats = {
  playerId: string;
  actualAppearances: number;
  plannedFinalizedAppearances: number;
  plannedDraftAppearances: number;
  coreCount: number;
  supportCount: number;
  developmentCount: number;
  backfillLegacyCount: number;
  goals: number;
  assists: number;
  plannedButAbsent: number;
  emergencyBackfill: number;
  addedPostMatch: number;
  actualDoubleLoads: number;
  flags: SeasonFlag[];
};

export type SeasonFlag =
  | "high_support_burden"
  | "low_development_exposure"
  | "actual_double_load"
  | "planned_but_absent_recent"
  | "high_emergency_backfill";

// --- Helper: classify role buckets ---
// BACKFILL and CONFIDENCE_REBUILD are legacy roles retained for backward
// compatibility. New generation only produces CORE, SUPPORT, DEVELOPMENT.

export function isCoreRole(role: SelectionRole): boolean {
  return role === "CORE";
}

export function isSupportRole(role: SelectionRole): boolean {
  return role === "SUPPORT" || role === "BACKFILL";
}

export function isDevelopmentRole(role: SelectionRole): boolean {
  return role === "DEVELOPMENT" || role === "CONFIDENCE_REBUILD";
}

export function isFloatingRole(role: SelectionRole): boolean {
  return (
    role === "SUPPORT" ||
    role === "DEVELOPMENT" ||
    role === "BACKFILL" ||
    role === "CONFIDENCE_REBUILD" ||
    role === "CORE_MATCH_DROP" ||
    role === "REDUCED_MATCH_LOAD_DROP"
  );
}

export function classifyRole(role: SelectionRole): "core" | "support" | "development" {
  if (isCoreRole(role)) return "core";
  if (isSupportRole(role)) return "support";
  return "development";
}

// --- Core query functions ---

export async function getEffectiveMatchParticipation(
  matchId: string,
): Promise<EffectiveParticipationRow[]> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchRoundId: true,
      teamId: true,
    },
  });

  if (!match) return [];

  const [selections, report] = await Promise.all([
    db.selection.findMany({
      where: {
        matchId,
        status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] },
      },
      select: {
        playerId: true,
        role: true,
        status: true,
        controlledDoubleLoad: true,
      },
    }),
    db.postMatchReport.findUnique({
      where: { matchId },
      select: {
        id: true,
        status: true,
        playerActuals: {
          select: {
            playerId: true,
            source: true,
            attendanceStatus: true,
            unplannedAppearanceReason: true,
          },
        },
        absences: {
          select: {
            playerId: true,
            reason: true,
          },
        },
        playerStats: {
          select: {
            playerId: true,
            goals: true,
            assists: true,
          },
        },
      },
    }),
  ]);

  const rows: EffectiveParticipationRow[] = [];

  if (report && (report.status === "REPORTED" || report.status === "LOCKED")) {
    const playerStatsMap = new Map(
      report.playerStats.map((s) => [s.playerId, s] as const),
    );
    const actualsSet = new Set(
      report.playerActuals.map((a) => a.playerId),
    );

    // Reported/LOCKED: actuals are source of truth
    for (const actual of report.playerActuals) {
      if (actual.attendanceStatus === "NO_SHOW") continue;

      const plannedSel = selections.find((s) => s.playerId === actual.playerId);
      const stats = playerStatsMap.get(actual.playerId);

      rows.push({
        playerId: actual.playerId,
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        teamId: match.teamId,
        plannedRole: plannedSel?.role ?? null,
        actualSource: actual.source as ActualAppearanceSource,
        plannedSelectionStatus: plannedSel?.status as "DRAFT" | "FINALIZED" ?? null,
        reportStatus: report.status as "REPORTED" | "LOCKED",
        played: true,
        absenceReason: null,
        countsForLoad: true,
        countsForFairness: true,
        countsForSeasonStats: true,
        source: report.status === "LOCKED" ? "ACTUAL_LOCKED" : "ACTUAL_REPORTED",
        goals: stats?.goals ?? 0,
        assists: stats?.assists ?? 0,
      });
    }

    // Planned-but-absent: shown for context but marked as not played
    for (const absence of report.absences) {
      if (actualsSet.has(absence.playerId)) continue;

      const plannedSel = selections.find((s) => s.playerId === absence.playerId);

      rows.push({
        playerId: absence.playerId,
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        teamId: match.teamId,
        plannedRole: plannedSel?.role ?? null,
        actualSource: null,
        plannedSelectionStatus: plannedSel?.status as "DRAFT" | "FINALIZED" ?? null,
        reportStatus: report.status as "REPORTED" | "LOCKED",
        played: false,
        absenceReason: absence.reason,
        countsForLoad: false,
        countsForFairness: false,
        countsForSeasonStats: false,
        source: report.status === "LOCKED" ? "ACTUAL_LOCKED" : "ACTUAL_REPORTED",
        goals: 0,
        assists: 0,
      });
    }

    // NO_SHOW players: shown for context
    for (const actual of report.playerActuals) {
      if (actual.attendanceStatus !== "NO_SHOW") continue;

      const plannedSel = selections.find((s) => s.playerId === actual.playerId);

      rows.push({
        playerId: actual.playerId,
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        teamId: match.teamId,
        plannedRole: plannedSel?.role ?? null,
        actualSource: actual.source as ActualAppearanceSource,
        plannedSelectionStatus: plannedSel?.status as "DRAFT" | "FINALIZED" ?? null,
        reportStatus: report.status as "REPORTED" | "LOCKED",
        played: false,
        absenceReason: "NO_SHOW",
        countsForLoad: false,
        countsForFairness: false,
        countsForSeasonStats: false,
        source: report.status === "LOCKED" ? "ACTUAL_LOCKED" : "ACTUAL_REPORTED",
        goals: 0,
        assists: 0,
      });
    }
  } else if (report && report.status === "DRAFT") {
    // DRAFT report: draft report data does NOT count as actual participation.
    // Use finalized planned selections as expected participation.
    for (const sel of selections.filter((s) => s.status === "FINALIZED")) {
      rows.push({
        playerId: sel.playerId,
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        teamId: match.teamId,
        plannedRole: sel.role,
        actualSource: null,
        plannedSelectionStatus: "FINALIZED",
        reportStatus: "DRAFT",
        played: false,
        absenceReason: null,
        countsForLoad: true,
        countsForFairness: true,
        countsForSeasonStats: false,
        source: "PLANNED_FINALIZED",
        goals: 0,
        assists: 0,
      });
    }
  } else {
    // No report: use planned selections as expected participation
    for (const sel of selections) {
      rows.push({
        playerId: sel.playerId,
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        teamId: match.teamId,
        plannedRole: sel.role,
        actualSource: null,
        plannedSelectionStatus: sel.status as "DRAFT" | "FINALIZED",
        reportStatus: "NOT_STARTED",
        played: false,
        absenceReason: null,
        countsForLoad: sel.status === "FINALIZED",
        countsForFairness: sel.status === "FINALIZED",
        countsForSeasonStats: false,
        source: sel.status === "FINALIZED" ? "PLANNED_FINALIZED" : "PLANNED_DRAFT",
        goals: 0,
        assists: 0,
      });
    }
  }

  return rows;
}

export async function getEffectiveRoundParticipation(
  matchRoundId: string,
): Promise<EffectiveParticipationRow[]> {
  const matches = await db.match.findMany({
    where: { matchRoundId },
    select: { id: true },
  });

  const allRows: EffectiveParticipationRow[] = [];
  for (const match of matches) {
    const rows = await getEffectiveMatchParticipation(match.id);
    allRows.push(...rows);
  }
  return allRows;
}

export async function getEffectiveParticipationHistory(
  playerId: string,
  options?: { planningPeriodId?: string; beforeDate?: Date },
): Promise<EffectiveParticipationRow[]> {
  const where: Record<string, unknown> = {};
  if (options?.beforeDate) {
    where.startsAt = { lt: options.beforeDate };
  }
  if (options?.planningPeriodId) {
    where.matchRound = { planningPeriodId: options.planningPeriodId };
  }

  const matches = await db.match.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    select: { id: true },
  });

  const allRows: EffectiveParticipationRow[] = [];
  for (const match of matches) {
    const rows = await getEffectiveMatchParticipation(match.id);
    const playerRows = rows.filter((r) => r.playerId === playerId);
    allRows.push(...playerRows);
  }
  return allRows;
}

export async function getEffectivePlayerParticipation(
  playerId: string,
  matchId: string,
): Promise<EffectiveParticipationRow | null> {
  const rows = await getEffectiveMatchParticipation(matchId);
  return rows.find((r) => r.playerId === playerId) ?? null;
}

export async function getEffectivePlanningContext(
  matchRoundId: string,
): Promise<EffectiveParticipationRow[]> {
  return getEffectiveRoundParticipation(matchRoundId);
}

export async function getEffectiveSeasonStats(
  playerId: string,
  planningPeriodId: string,
): Promise<PlayerSeasonStats> {
  const rows = await getEffectiveRoundParticipationForPlayer(playerId, planningPeriodId);

  let coreCount = 0;
  let supportCount = 0;
  let developmentCount = 0;
  let backfillLegacyCount = 0;
  let actualAppearances = 0;
  let plannedFinalizedAppearances = 0;
  let plannedDraftAppearances = 0;
  let goals = 0;
  let assists = 0;
  let plannedButAbsent = 0;
  let emergencyBackfill = 0;
  let addedPostMatch = 0;

  const roundMap = new Map<string, number>();

  for (const row of rows) {
    if (row.plannedRole) {
      if (isCoreRole(row.plannedRole)) coreCount++;
      else if (isSupportRole(row.plannedRole)) supportCount++;
      else if (isDevelopmentRole(row.plannedRole)) developmentCount++;
      if (row.plannedRole === "BACKFILL") backfillLegacyCount++;
    }

    if (row.source === "ACTUAL_REPORTED" || row.source === "ACTUAL_LOCKED") {
      if (row.played) {
        actualAppearances++;
        goals += row.goals;
        assists += row.assists;
        const existing = roundMap.get(row.matchRoundId) ?? 0;
        roundMap.set(row.matchRoundId, existing + 1);
      }
      if (!row.played && row.absenceReason) plannedButAbsent++;
      if (row.actualSource === "EMERGENCY_BACKFILL") emergencyBackfill++;
      if (row.actualSource === "ADDED_POST_MATCH") addedPostMatch++;
    } else if (row.source === "PLANNED_FINALIZED") {
      plannedFinalizedAppearances++;
    } else if (row.source === "PLANNED_DRAFT") {
      plannedDraftAppearances++;
    }
  }

  let actualDoubleLoads = 0;
  for (const count of roundMap.values()) {
    if (count > 1) actualDoubleLoads += count - 1;
  }

  const flags: SeasonFlag[] = [];
  if (supportCount > coreCount) flags.push("high_support_burden");
  if (developmentCount > coreCount) flags.push("low_development_exposure");
  if (actualDoubleLoads > 0) flags.push("actual_double_load");
  if (plannedButAbsent > 0) flags.push("planned_but_absent_recent");
  if (emergencyBackfill > 0) flags.push("high_emergency_backfill");

  return {
    playerId,
    actualAppearances,
    plannedFinalizedAppearances,
    plannedDraftAppearances,
    coreCount,
    supportCount,
    developmentCount,
    backfillLegacyCount,
    goals,
    assists,
    plannedButAbsent,
    emergencyBackfill,
    addedPostMatch,
    actualDoubleLoads,
    flags,
  };
}

async function getEffectiveRoundParticipationForPlayer(
  playerId: string,
  planningPeriodId: string,
): Promise<EffectiveParticipationRow[]> {
  const rounds = await db.matchRound.findMany({
    where: { planningPeriodId },
    select: { id: true },
  });

  const allRows: EffectiveParticipationRow[] = [];
  for (const round of rounds) {
    const rows = await getEffectiveRoundParticipation(round.id);
    const playerRows = rows.filter((r) => r.playerId === playerId);
    allRows.push(...playerRows);
  }
  return allRows;
}

export async function getPlayerAllTimeStats(
  playerId: string,
): Promise<{
  actualAppearances: number;
  goals: number;
  assists: number;
  plannedButAbsent: number;
}> {
  const reports = await db.postMatchReport.findMany({
    where: { status: { in: ["REPORTED", "LOCKED"] } },
    select: { id: true, matchId: true },
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