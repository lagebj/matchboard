import "server-only";

import { db } from "@/lib/db";
import type { ParticipationSummary } from "./audit-types";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type PlayerHistoryEntry = {
  matchRoundId: string;
  matchRoundName: string;
  matchId: string;
  matchDate: Date | null;
  opponent: string;
  homeAway: string;
  isCancelled: boolean;
  plannedRole: string | null;
  plannedTeamId: string | null;
  plannedTeamName: string | null;
  actualAttendance: string | null;
  actualSource: string | null;
  goals: number;
  assists: number;
  reportStatus: string | null;
};

export type PlayerHistoryData = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  history: PlayerHistoryEntry[];
  summary: ParticipationSummary;
};

export async function getPlayerHistory(
  playerId: string,
  leagueSeasonId: string,
  orgFilter: OrgFilterMode,
): Promise<PlayerHistoryData | null> {
  const player = await db.player.findFirst({
    where: { id: playerId, ...orgFilter.filter },
    select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } },
  });

  if (!player) return null;

  const playerName = player.firstName + (player.lastName ? ` ${player.lastName}` : "");

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const matchRoundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: matchRoundIds },
    },
    include: {
      opponentTeam: { select: { displayName: true } },
      team: { select: { id: true, name: true } },
      matchRound: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const matchIds = matches.map((m) => m.id);

  const selections = await db.selection.findMany({
    where: {
      playerId,
      matchId: { in: matchIds },
    },
    include: {
      match: { select: { teamId: true } },
    },
  });

  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matchIds } },
    select: { id: true, matchId: true, status: true },
  });

  const reportByMatchId = new Map(reports.map((r) => [r.matchId, r]));

  const completedReportIds = reports
    .filter((r) => r.status === "REPORTED" || r.status === "LOCKED")
    .map((r) => r.id);

  const actuals = await db.postMatchPlayerActual.findMany({
    where: {
      playerId,
      reportId: { in: completedReportIds },
    },
    select: {
      reportId: true,
      attendanceStatus: true,
      source: true,
    },
  });

  const actualsByReportId = new Map(actuals.map((a) => [a.reportId, a]));

  const playerGoals = await db.goal.findMany({
    where: {
      playerId,
      reportId: { in: completedReportIds },
    },
    select: { reportId: true },
  });

  const playerAssists = await db.assist.findMany({
    where: {
      playerId,
      reportId: { in: completedReportIds },
    },
    select: { reportId: true },
  });

  const goalsByReport = new Map<string, number>();
  for (const g of playerGoals) {
    goalsByReport.set(g.reportId, (goalsByReport.get(g.reportId) ?? 0) + 1);
  }

  const assistsByReport = new Map<string, number>();
  for (const a of playerAssists) {
    assistsByReport.set(a.reportId, (assistsByReport.get(a.reportId) ?? 0) + 1);
  }

  const selectionByMatchId = new Map(selections.map((s) => [s.matchId, s]));

  const history: PlayerHistoryEntry[] = [];

  let plannedOpportunities = 0;
  let actualAppearances = 0;
  let coreAppearances = 0;
  let supportAppearances = 0;
  let developmentAppearances = 0;
  let squadRepairAppearances = 0;
  let totalGoals = 0;
  let totalAssists = 0;
  let plannedButAbsent = 0;
  let unplannedAppearances = 0;

  for (const match of matches) {
    const selection = selectionByMatchId.get(match.id);
    const report = reportByMatchId.get(match.id);
    const actual = report ? actualsByReportId.get(report.id) : undefined;

    const plannedRole = selection?.role ?? null;
    const plannedTeamId = selection?.match.teamId ?? null;
    const plannedTeamName = match.team.name;

    let actualAttendance: string | null = null;
    let actualSource: string | null = null;
    let goals = 0;
    let assists = 0;

    if (report && actual) {
      actualAttendance = actual.attendanceStatus;
      actualSource = actual.source;
      goals = goalsByReport.get(report.id) ?? 0;
      assists = assistsByReport.get(report.id) ?? 0;
      totalGoals += goals;
      totalAssists += assists;
    }

    if (selection && selection.status === "FINALIZED") {
      plannedOpportunities++;
    }

    if (actual?.attendanceStatus === "PRESENT") {
      actualAppearances++;
      if (plannedRole === "CORE") coreAppearances++;
      else if (plannedRole === "SUPPORT") supportAppearances++;
      else if (plannedRole === "DEVELOPMENT") developmentAppearances++;
      else if (plannedRole === "BACKFILL") squadRepairAppearances++;
      else if (!selection) unplannedAppearances++;
    } else if (selection && selection.status === "FINALIZED" && actual?.attendanceStatus !== "PRESENT") {
      plannedButAbsent++;
    }

    history.push({
      matchRoundId: match.matchRoundId,
      matchRoundName: match.matchRound.name,
      matchId: match.id,
      matchDate: match.startsAt,
      opponent: match.opponentTeam?.displayName ?? match.opponent,
      homeAway: match.homeAway,
      isCancelled: match.status === "CANCELLED",
      plannedRole,
      plannedTeamId,
      plannedTeamName,
      actualAttendance,
      actualSource,
      goals,
      assists,
      reportStatus: report?.status ?? null,
    });
  }

  const summary: ParticipationSummary = {
    playerId: player.id,
    playerName,
    coreTeamId: player.coreTeamId,
    coreTeamName: player.coreTeam?.name ?? null,
    plannedOpportunities,
    actualAppearances,
    coreAppearances,
    supportAppearances,
    developmentAppearances,
    squadRepairAppearances,
    goals: totalGoals,
    assists: totalAssists,
    plannedButAbsent,
    unplannedAppearances,
    missingReports: 0,
  };

  return {
    playerId: player.id,
    playerName,
    coreTeamId: player.coreTeamId,
    coreTeamName: player.coreTeam?.name ?? null,
    history,
    summary,
  };
}