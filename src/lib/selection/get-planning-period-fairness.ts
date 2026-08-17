import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatPlayerName } from "@/lib/player-metrics";
import { isCoreRole, isSupportRole, isDevelopmentRole } from "./effective-participation";

export type FairnessFlag =
  | "support_burden_review"
  | "hidden_promotion_review"
  | "core_exposure_review";

export type PlayerFairnessResult = {
  coreCount: number;
  developmentCount: number;
  flags: FairnessFlag[];
  playerId: string;
  playerName: string;
  supportCount: number;
  teamId: string;
  teamName: string;
  availableRounds: number;
};

export type LeagueSeasonFairness = {
  players: PlayerFairnessResult[];
  leagueSeasonId: string;
};

export async function getLeagueSeasonFairness(
  leagueSeasonId: string,
): Promise<LeagueSeasonFairness> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { organisationId: true },
  });
  const leagueOrganisationId = leagueSeason?.organisationId;

  const [matchRounds, finalizedSelections, players, availabilities, reportedReports] = await Promise.all([
    db.matchRound.findMany({
      where: { leagueSeasonId },
      select: { id: true },
    }),
    db.selection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
        matchRound: { leagueSeasonId },
      },
      select: {
        playerId: true,
        role: true,
        matchRoundId: true,
        matchId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            coreTeamId: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
        ...(leagueOrganisationId ? { coreTeam: { organisationId: leagueOrganisationId } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        coreTeam: { select: { id: true, name: true } },
      },
    }),
    db.availability.findMany({
      where: {
        matchRound: { leagueSeasonId },
        status: "AVAILABLE",
      },
      select: {
        playerId: true,
        matchRoundId: true,
      },
    }),
    db.postMatchReport.findMany({
      where: {
        status: { in: ["REPORTED", "LOCKED"] },
      },
      select: {
        id: true,
        matchId: true,
      },
    }),
  ]);

  const matchRoundIds = new Set(matchRounds.map((mr) => mr.id));

  const matchIdToRoundId = new Map<string, string>();
  for (const sel of finalizedSelections) {
    matchIdToRoundId.set(sel.matchId, sel.matchRoundId);
  }

  const filteredReportedReports = reportedReports.filter((r) =>
    matchIdToRoundId.has(r.matchId) && matchRoundIds.has(matchIdToRoundId.get(r.matchId)!),
  );
  const reportedMatchIds = new Set(filteredReportedReports.map((r) => r.matchId));

  const reportedActuals = filteredReportedReports.length > 0
    ? await db.postMatchPlayerActual.findMany({
        where: {
          reportId: { in: filteredReportedReports.map((r) => r.id) },
          attendanceStatus: { not: "NO_SHOW" },
        },
        select: {
          playerId: true,
          matchId: true,
        },
      })
    : [];

  const reportedNoShows = filteredReportedReports.length > 0
    ? await db.postMatchPlayerActual.findMany({
        where: {
          reportId: { in: filteredReportedReports.map((r) => r.id) },
          attendanceStatus: "NO_SHOW",
        },
        select: {
          playerId: true,
          matchId: true,
        },
      })
    : [];

  const noShowPlayerMatches = new Set(
    reportedNoShows.map((a) => `${a.playerId}:${a.matchId}`),
  );

  const roleCountsByPlayerId = new Map<
    string,
    { coreCount: number; developmentCount: number; supportCount: number }
  >();

  for (const sel of finalizedSelections) {
    if (reportedMatchIds.has(sel.matchId)) {
      const key = `${sel.playerId}:${sel.matchId}`;
      if (noShowPlayerMatches.has(key)) continue;
    }

    const existing = roleCountsByPlayerId.get(sel.playerId) ?? {
      coreCount: 0,
      developmentCount: 0,
      supportCount: 0,
    };

    if (isCoreRole(sel.role)) {
      existing.coreCount++;
    } else if (isSupportRole(sel.role)) {
      existing.supportCount++;
    } else if (isDevelopmentRole(sel.role)) {
      existing.developmentCount++;
    }

    roleCountsByPlayerId.set(sel.playerId, existing);
  }

  for (const actual of reportedActuals) {
    const selForMatch = finalizedSelections.find(
      (s) => s.playerId === actual.playerId && s.matchId === actual.matchId,
    );
    if (selForMatch) continue;

    const existing = roleCountsByPlayerId.get(actual.playerId) ?? {
      coreCount: 0,
      developmentCount: 0,
      supportCount: 0,
    };

    existing.coreCount++;

    roleCountsByPlayerId.set(actual.playerId, existing);
  }

  const availableRoundsByPlayerId = new Map<string, number>();
  for (const av of availabilities) {
    if (!matchRoundIds.has(av.matchRoundId)) continue;
    availableRoundsByPlayerId.set(
      av.playerId,
      (availableRoundsByPlayerId.get(av.playerId) ?? 0) + 1,
    );
  }

  const results: PlayerFairnessResult[] = [];

  for (const player of players) {
    const counts = roleCountsByPlayerId.get(player.id) ?? {
      coreCount: 0,
      developmentCount: 0,
      supportCount: 0,
    };
    const availableRounds = availableRoundsByPlayerId.get(player.id) ?? 0;

    if (availableRounds === 0 && counts.coreCount === 0 && counts.supportCount === 0 && counts.developmentCount === 0) {
      continue;
    }

    const flags: FairnessFlag[] = [];

    if (counts.supportCount > counts.coreCount && availableRounds > 0) {
      flags.push("support_burden_review");
    }

    if (counts.developmentCount > counts.coreCount) {
      flags.push("hidden_promotion_review");
    }

    if (counts.coreCount === 0 && availableRounds > 0) {
      flags.push("core_exposure_review");
    }

    results.push({
      ...counts,
      availableRounds,
      flags,
      playerId: player.id,
      playerName: formatPlayerName(player),
      teamId: player.coreTeamId ?? "unassigned",
      teamName: player.coreTeam?.name ?? "Unassigned",
    });
  }

  return {
    players: results,
    leagueSeasonId,
  };
}