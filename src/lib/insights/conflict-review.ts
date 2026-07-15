import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import type {
  InsightFilters,
  ConflictEntry,
} from "./insights-types";
import { classifyConflictSeverity } from "./conflict-review-helpers";

export async function getConflictReview(
  filters: InsightFilters,
): Promise<ConflictEntry[]> {
  await requireCoachAccess();

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      status: { in: ["DRAFT", "FINALIZED"] },
    },
    select: {
      id: true,
      playerId: true,
      matchId: true,
      matchRoundId: true,
      role: true,
      status: true,
      player: {
        select: { id: true, firstName: true, lastName: true },
      },
      match: {
        select: {
          id: true,
          teamId: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { playerId: "asc" },
  });

  const conflicts: ConflictEntry[] = [];

  const playerSelectionsByRound = new Map<string, Map<string, typeof selections>>();
  for (const sel of selections) {
    if (!playerSelectionsByRound.has(sel.playerId)) {
      playerSelectionsByRound.set(sel.playerId, new Map());
    }
    const roundMap = playerSelectionsByRound.get(sel.playerId)!;
    if (!roundMap.has(sel.matchRoundId)) {
      roundMap.set(sel.matchRoundId, []);
    }
    roundMap.get(sel.matchRoundId)!.push(sel);
  }

  for (const [playerId, roundMap] of playerSelectionsByRound) {
    for (const [roundId, roundSelections] of roundMap) {
      if (roundSelections.length > 1) {
        const player = roundSelections[0].player;
        const playerName = player.firstName + (player.lastName ? " " + player.lastName : "");
        const round = rounds.find((r) => r.id === roundId);
        const matchIds = roundSelections.map((s) => s.matchId);
        const teamNames = roundSelections.map((s) => s.match.team.name);
        const uniqueMatchIds = [...new Set(matchIds)];

        conflicts.push({
          conflictType: "player_double_planned",
          playerId,
          playerName,
          teamId: roundSelections[0].match.teamId,
          teamName: teamNames[0],
          matchId: uniqueMatchIds[0],
          matchRoundId: roundId,
          matchRoundLabel: round?.name ?? roundId,
          detail: `Selected in ${roundSelections.length} matches in the same round: ${teamNames.join(", ")}`,
          severity: classifyConflictSeverity("player_double_planned"),
          linkTo: {
            type: "round",
            id: roundId,
          },
        });
      }
    }
  }

  const matches = await db.match.findMany({
    where: { matchRoundId: { in: roundIds } },
    select: { id: true, matchRoundId: true, teamId: true, team: { select: { name: true } } },
  });

  const matchIds = matches.map((m) => m.id);

  const allReports = await db.postMatchReport.findMany({
    where: {
      matchId: { in: matchIds },
    },
    select: { matchId: true, status: true },
  });

  const completedReportMatchIds = new Set<string>();
  for (const r of allReports) {
    if (r.status === "REPORTED" || r.status === "LOCKED") {
      completedReportMatchIds.add(r.matchId);
    }
  }

  const scheduledMatches = matches.filter(
    (m) => !completedReportMatchIds.has(m.id),
  );

  for (const match of scheduledMatches) {
    const round = rounds.find((r) => r.id === match.matchRoundId);

    const hasReport = allReports.some((r) => r.matchId === match.id);
    if (!hasReport) {
      conflicts.push({
        conflictType: "missing_report",
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        matchRoundLabel: round?.name ?? match.matchRoundId,
        teamId: match.teamId,
        teamName: match.team.name,
        detail: `Missing post-match report for ${match.team.name}`,
        severity: classifyConflictSeverity("missing_report"),
      });
    }
  }

  return conflicts.sort((a, b) => {
    const severityOrder = { blocked: 0, decision_required: 1, planning_note: 2 };
    return (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2);
  });
}