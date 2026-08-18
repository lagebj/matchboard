import "server-only";

import { db } from "@/lib/db";
import { hasLeagueMatchPassed } from "@/lib/match-date-utils";
import type {
  PlannedVsActualMatch,
  PlannedSelectionSummary,
  ActualParticipationSummary,
  PlannedAbsentSummary,
  UnplannedParticipationSummary,
  ReportStatus,
  AuditWorkItem,
  ParticipationSummary,
  SeasonReviewData,
} from "./audit-types";
import { buildDeltaSummary } from "./delta-summary";

import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export async function getPlannedVsActualForMatch(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedVsActualMatch | null> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    include: {
      opponentTeam: { select: { displayName: true } },
      team: { select: { id: true, name: true } },
      matchRound: { select: { id: true, name: true, leagueSeasonId: true } },
    },
  });

  if (!match) return null;

  const finalizedSelections = await db.selection.findMany({
    where: { matchId, status: "FINALIZED" },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
      match: { select: { teamId: true } },
    },
    orderBy: { role: "asc" },
  });

  const plannedPlayers: PlannedSelectionSummary[] = finalizedSelections.map((s) => ({
    playerId: s.playerId,
    playerName: s.player.firstName + (s.player.lastName ? ` ${s.player.lastName}` : ""),
    coreTeamId: s.player.coreTeamId,
    coreTeamName: s.player.coreTeam?.name ?? null,
    role: s.role,
    teamId: s.match.teamId,
    teamName: match.team.name,
    wasPlannedAsStarter: s.role === "CORE",
    matchdayResponsibility: s.matchdayResponsibility,
    overrideReason: s.overrideReason,
  }));

  const plannedPlayerIds = new Set(plannedPlayers.map((p) => p.playerId));

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...orgFilter.filterNullable },
    include: {
      playerActuals: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
        },
      },
      absences: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  const matchGoals = report
    ? await db.goal.findMany({
        where: { reportId: report.id },
        select: { playerId: true },
      })
    : [];

  const matchAssists = report
    ? await db.assist.findMany({
        where: { reportId: report.id },
        select: { playerId: true },
      })
    : [];

  let reportStatus: ReportStatus = "NONE";
  const actualParticipants: ActualParticipationSummary[] = [];
  const unplannedParticipants: UnplannedParticipationSummary[] = [];
  const plannedButAbsent: PlannedAbsentSummary[] = [];
  let homeGoals: number | null = null;
  let awayGoals: number | null = null;

  if (report) {
    reportStatus = report.status === "LOCKED" ? "LOCKED" : report.status === "REPORTED" ? "REPORTED" : "DRAFT";
    homeGoals = report.homeGoals;
    awayGoals = report.awayGoals;

    const goalCounts = new Map<string, number>();
    const assistCounts = new Map<string, number>();

    for (const goal of matchGoals) {
      if (goal.playerId) {
        goalCounts.set(goal.playerId, (goalCounts.get(goal.playerId) ?? 0) + 1);
      }
    }
    for (const assist of matchAssists) {
      assistCounts.set(assist.playerId, (assistCounts.get(assist.playerId) ?? 0) + 1);
    }

    for (const actual of report.playerActuals) {
      const playerName = actual.player.firstName + (actual.player.lastName ? ` ${actual.player.lastName}` : "");
      const isPlanned = plannedPlayerIds.has(actual.playerId);

      const entry: ActualParticipationSummary = {
        playerId: actual.playerId,
        playerName,
        coreTeamId: actual.player.coreTeamId,
        attendanceStatus: actual.attendanceStatus,
        source: actual.source,
        unplannedAppearanceReason: actual.unplannedAppearanceReason,
        goals: goalCounts.get(actual.playerId) ?? 0,
        assists: assistCounts.get(actual.playerId) ?? 0,
      };

      actualParticipants.push(entry);

      if (!isPlanned && actual.attendanceStatus === "PRESENT" && actual.source === "ADDED_POST_MATCH") {
        unplannedParticipants.push({
          playerId: actual.playerId,
          playerName,
          coreTeamId: actual.player.coreTeamId,
          unplannedAppearanceReason: actual.unplannedAppearanceReason,
          goals: goalCounts.get(actual.playerId) ?? 0,
          assists: assistCounts.get(actual.playerId) ?? 0,
        });
      }
    }

    for (const absence of report.absences) {
      const plannedSelection = finalizedSelections.find((s) => s.playerId === absence.playerId);
      if (plannedSelection) {
        plannedButAbsent.push({
          playerId: absence.playerId,
          playerName: plannedSelection.player.firstName + (plannedSelection.player.lastName ? ` ${plannedSelection.player.lastName}` : ""),
          coreTeamId: plannedSelection.player.coreTeamId,
          plannedRole: plannedSelection.role,
          plannedTeamId: plannedSelection.match.teamId,
          plannedTeamName: match.team.name,
          absenceReason: absence.reason,
          wasMarkedUnavailable: false,
        });
      }
    }

    const presentPlayerIds = new Set(
      report.playerActuals
        .filter((a) => a.attendanceStatus === "PRESENT")
        .map((a) => a.playerId),
    );

    for (const planned of plannedPlayers) {
      if (!presentPlayerIds.has(planned.playerId)) {
        const alreadyAbsent = plannedButAbsent.some((a) => a.playerId === planned.playerId);
        if (!alreadyAbsent) {
          plannedButAbsent.push({
            playerId: planned.playerId,
            playerName: planned.playerName,
            coreTeamId: planned.coreTeamId,
            plannedRole: planned.role,
            plannedTeamId: planned.teamId,
            plannedTeamName: planned.teamName,
            absenceReason: null,
            wasMarkedUnavailable: false,
          });
        }
      }
    }
  }

  const isHome = match.homeAway === "HOME";
  let result: "won" | "drawn" | "lost" | null = null;
  if (homeGoals !== null && awayGoals !== null) {
    if (homeGoals > awayGoals) result = isHome ? "won" : "lost";
    else if (homeGoals < awayGoals) result = isHome ? "lost" : "won";
    else result = "drawn";
  }

  const deltaSummary = buildDeltaSummary(
    plannedPlayers.length,
    actualParticipants.filter((a) => a.attendanceStatus === "PRESENT").length,
    plannedButAbsent.length,
    unplannedParticipants.length,
  );

  return {
    matchId: match.id,
    matchRoundId: match.matchRoundId,
    matchDate: match.startsAt,
    opponent: match.opponentTeam?.displayName ?? match.opponent,
    homeAway: match.homeAway,
    isCancelled: match.status === "CANCELLED",
    reportStatus,
    plannedPlayers,
    actualParticipants,
    plannedButAbsent,
    unplannedParticipants,
    deltaSummary,
    homeGoals,
    awayGoals,
    result,
  };
}

export async function getPlannedVsActualForRound(
  matchRoundId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedVsActualMatch[]> {
  const matches = await db.match.findMany({
    where: {
      matchRoundId,
      status: { not: "CANCELLED" },
      ...orgFilter.filter,
    },
    select: { id: true },
  });

  const results: PlannedVsActualMatch[] = [];
  for (const match of matches) {
    const result = await getPlannedVsActualForMatch(match.id, orgFilter);
    if (result) results.push(result);
  }
  return results;
}

export async function getAuditWorkItems(
  leagueSeasonId: string,
  orgFilter: OrgFilterMode,
): Promise<AuditWorkItem[]> {
  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId, ...orgFilter.filter },
    select: { id: true, name: true },
  });

  const items: AuditWorkItem[] = [];

  for (const round of rounds) {
    const matches = await db.match.findMany({
      where: {
        matchRoundId: round.id,
        status: { not: "CANCELLED" },
        ...orgFilter.filter,
      },
    });

    for (const match of matches) {
      if (!hasLeagueMatchPassed(match)) continue;

      const report = await db.postMatchReport.findFirst({
        where: { matchId: match.id, ...orgFilter.filterNullable },
        select: {
          id: true,
          status: true,
          playerActuals: { select: { attendanceStatus: true } },
        },
      });

      if (!report) {
        items.push({
          type: "missing_report",
          matchId: match.id,
          matchDate: match.startsAt,
          matchRoundId: round.id,
          roundName: round.name,
          description: `Match has passed but has no post-match report.`,
        });
        continue;
      }

      if (report.status === "DRAFT") {
        const hasUnknown = report.playerActuals.some(
          (a) => a.attendanceStatus === "UNKNOWN",
        );
        if (hasUnknown) {
          items.push({
            type: "unknown_attendance",
            matchId: match.id,
            matchDate: match.startsAt,
            matchRoundId: round.id,
            roundName: round.name,
            description: `Report has unknown attendance that must be confirmed.`,
          });
        } else {
          items.push({
            type: "incomplete_report",
            matchId: match.id,
            matchDate: match.startsAt,
            matchRoundId: round.id,
            roundName: round.name,
            description: `Report is draft and has not been completed.`,
          });
        }
      }

      if (report.status === "REPORTED") {
        items.push({
          type: "incomplete_report",
          matchId: match.id,
          matchDate: match.startsAt,
          matchRoundId: round.id,
          roundName: round.name,
          description: `Report has been submitted but not locked.`,
        });
      }
    }
  }

  return items;
}

export async function getSeasonReview(
  leagueSeasonId: string,
  orgFilter: OrgFilterMode,
): Promise<SeasonReviewData> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...orgFilter.filter },
    include: { season: true },
  });

  if (!leagueSeason) {
    throw new Error(`League season not found: ${leagueSeasonId}`);
  }

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId },
    select: { id: true, name: true, status: true },
  });

  const finalizedRounds = rounds.filter((r) => r.status === "FINALIZED").length;
  const draftRounds = rounds.filter((r) => r.status === "DRAFT" || r.status === "BLOCKED" || r.status === "READY").length;

  const matchRoundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: matchRoundIds },
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });

  const matchIds = matches.map((m) => m.id);

  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matchIds } },
    select: { id: true, matchId: true, status: true },
  });

  const completedMatches = matches.length;
  const matchesWithReports = reports.length;
  const matchesMissingReports = completedMatches - matchesWithReports;

  const finalizedSelections = await db.selection.findMany({
    where: {
      status: "FINALIZED",
      match: { matchRound: { leagueSeasonId } },
    },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
    },
  });

  const completedReportIds = reports
    .filter((r) => r.status === "REPORTED" || r.status === "LOCKED")
    .map((r) => r.id);

  const actualParticipations = await db.postMatchPlayerActual.findMany({
    where: {
      attendanceStatus: "PRESENT",
      reportId: { in: completedReportIds },
    },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } } },
    },
  });

  const goals = await db.goal.findMany({
    where: { reportId: { in: completedReportIds } },
    select: { playerId: true },
  });

  const assists = await db.assist.findMany({
    where: { reportId: { in: completedReportIds } },
    select: { playerId: true },
  });

  const playerMap = new Map<string, ParticipationSummary>();

  for (const sel of finalizedSelections) {
    const name = sel.player.firstName + (sel.player.lastName ? ` ${sel.player.lastName}` : "");
    let entry = playerMap.get(sel.playerId);
    if (!entry) {
      entry = {
        playerId: sel.playerId,
        playerName: name,
        coreTeamId: sel.player.coreTeamId,
        coreTeamName: sel.player.coreTeam?.name ?? null,
        plannedOpportunities: 0,
        actualAppearances: 0,
        coreAppearances: 0,
        supportAppearances: 0,
        developmentAppearances: 0,
        squadRepairAppearances: 0,
        goals: 0,
        assists: 0,
        plannedButAbsent: 0,
        unplannedAppearances: 0,
        missingReports: 0,
      };
      playerMap.set(sel.playerId, entry);
    }
    entry.plannedOpportunities++;
  }

  for (const actual of actualParticipations) {
    const name = actual.player.firstName + (actual.player.lastName ? ` ${actual.player.lastName}` : "");
    let entry = playerMap.get(actual.playerId);
    if (!entry) {
      entry = {
        playerId: actual.playerId,
        playerName: name,
        coreTeamId: actual.player.coreTeamId,
        coreTeamName: actual.player.coreTeam?.name ?? null,
        plannedOpportunities: 0,
        actualAppearances: 0,
        coreAppearances: 0,
        supportAppearances: 0,
        developmentAppearances: 0,
        squadRepairAppearances: 0,
        goals: 0,
        assists: 0,
        plannedButAbsent: 0,
        unplannedAppearances: 0,
        missingReports: 0,
      };
      playerMap.set(actual.playerId, entry);
    }
    entry.actualAppearances++;
    if (entry.plannedOpportunities === 0) {
      entry.unplannedAppearances++;
    }
  }

  for (const goal of goals) {
    if (goal.playerId) {
      const entry = playerMap.get(goal.playerId);
      if (entry) entry.goals++;
    }
  }

  for (const assist of assists) {
    const entry = playerMap.get(assist.playerId);
    if (entry) entry.assists++;
  }

  const auditWorkItems = await getAuditWorkItems(leagueSeasonId, orgFilter);

  return {
    leagueSeasonId,
    leagueSeasonName: leagueSeason.name,
    period: leagueSeason.part,
    periodStart: leagueSeason.startDate,
    periodEnd: leagueSeason.endDate,
    totalRounds: rounds.length,
    finalizedRounds,
    draftRounds,
    completedMatches,
    matchesWithReports,
    matchesMissingReports,
    participationSummaries: Array.from(playerMap.values()),
    auditWorkItems,
  };
}