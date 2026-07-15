import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { classifyLoadCell, computeLoadAttentionFlags } from "./load-timeline-helpers";
import type {
  InsightFilters,
  LoadTimelineRow,
  LoadTimelineCell,
  LoadCellStatus,
} from "./insights-types";

export async function getLoadTimeline(
  filters: InsightFilters,
): Promise<LoadTimelineRow[]> {
  await requireCoachAccess();

  const playerFilter = filters.includeRemoved
    ? { OR: [{ active: true }, { active: false, removedAt: { not: null } }] }
    : filters.includeInactive
      ? { OR: [{ active: true }, { active: false }] }
      : { active: true, removedAt: null };

  const players = await db.player.findMany({
    where: playerFilter,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const selectionStatusFilter: "FINALIZED"[] = filters.includeRemoved
    ? ["FINALIZED"]
    : ["FINALIZED"];

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      status: { in: selectionStatusFilter },
      player: playerFilter,
    },
    select: {
      playerId: true,
      role: true,
      matchRoundId: true,
    },
  });

  const matchIds = await db.match.findMany({
    where: { matchRoundId: { in: roundIds } },
    select: { id: true, matchRoundId: true },
  });

  const completedReportMatchIds = new Set<string>();
  if (matchIds.length > 0) {
    const reports = await db.postMatchReport.findMany({
      where: {
        matchId: { in: matchIds.map((m) => m.id) },
        status: { in: ["REPORTED", "LOCKED"] },
      },
      select: { matchId: true },
    });
    for (const r of reports) {
      completedReportMatchIds.add(r.matchId);
    }
  }

  const actualParticipations = await db.postMatchPlayerActual.findMany({
    where: {
      report: {
        matchId: { in: matchIds.map((m) => m.id) },
        status: { in: ["REPORTED", "LOCKED"] },
      },
      attendanceStatus: "PRESENT",
    },
    select: {
      playerId: true,
      source: true,
      report: {
        select: { matchId: true },
      },
    },
  });

  const matchRoundIdByMatchId = new Map<string, string>();
  for (const m of matchIds) {
    matchRoundIdByMatchId.set(m.id, m.matchRoundId);
  }

  const plannedByPlayerRound = new Map<string, Map<string, string>>();
  for (const sel of selections) {
    if (!plannedByPlayerRound.has(sel.playerId)) {
      plannedByPlayerRound.set(sel.playerId, new Map());
    }
    plannedByPlayerRound.get(sel.playerId)!.set(sel.matchRoundId, sel.role);
  }

  const actualByPlayerRound = new Map<string, Map<string, { matchCount: number; sources: string[] }>>();
  for (const act of actualParticipations) {
    const matchRoundId = matchRoundIdByMatchId.get(act.report.matchId);
    if (!matchRoundId) continue;
    if (!actualByPlayerRound.has(act.playerId)) {
      actualByPlayerRound.set(act.playerId, new Map());
    }
    const roundMap = actualByPlayerRound.get(act.playerId)!;
    if (!roundMap.has(matchRoundId)) {
      roundMap.set(matchRoundId, { matchCount: 0, sources: [] });
    }
    const entry = roundMap.get(matchRoundId)!;
    entry.matchCount++;
    entry.sources.push(act.source);
  }

  const rows: LoadTimelineRow[] = [];

  for (const player of players) {
    const cells: LoadTimelineCell[] = [];
    let totalActualAppearances = 0;
    let roundsWithParticipation = 0;

    const plannedRounds = plannedByPlayerRound.get(player.id) ?? new Map();
    const actualRounds = actualByPlayerRound.get(player.id) ?? new Map();

    for (const round of rounds) {
      const planned = plannedRounds.get(round.id);
      const actual = actualRounds.get(round.id);

      let status: LoadCellStatus;
      let matchCount = 0;

      if (actual && actual.matchCount > 0) {
        matchCount = actual.matchCount;
        totalActualAppearances += actual.matchCount;
        roundsWithParticipation++;
        status = classifyLoadCell({
          hasActual: true,
          actualSources: actual.sources,
          plannedRole: planned,
        });
      } else if (planned) {
        status = "planned_only";
        matchCount = 1;
      } else {
        status = "unavailable";
        matchCount = 0;
      }

      cells.push({
        matchRoundId: round.id,
        matchRoundLabel: round.name,
        status,
        matchCount,
      });
    }

    const attentionFlags = computeLoadAttentionFlags(
      totalActualAppearances,
      roundsWithParticipation,
      rounds.length,
    );

    rows.push({
      playerId: player.id,
      playerName: player.firstName + (player.lastName ? " " + player.lastName : ""),
      coreTeamId: player.coreTeamId,
      coreTeamName: player.coreTeam?.name ?? null,
      attentionFlags,
      cells,
      recentLoad: totalActualAppearances,
    });
  }

  return rows;
}