import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type {
  PlayerPathwayData,
  PlayerPathwayRow,
  PathwayCell,
  PathwayContext,
  PathwayCellStatus,
  PathwayFilters,
  PathwayViewMode,
} from "./pathways-types";
import {
  mapSelectionRoleToPathwayContext,
  mapSelectionRoleToCellStatus,
  computePathwaySummaryMetrics,
} from "./pathways-helpers";

export async function getPlayerPathways(
  filters: PathwayFilters,
  viewMode: PathwayViewMode = "finalized_only",
): Promise<PlayerPathwayData> {
  const ctx = await requireActorContext();
  const orgWhere =
    ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

  const includeDrafts = viewMode === "include_drafts";

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: filters.leagueSeasonId },
    select: {
      id: true,
      name: true,
      organisationId: true,
    },
  });

  if (!leagueSeason) {
    throw new Error("League season not found");
  }

  if (
    ctx.orgFilter.type === "org" &&
    leagueSeason.organisationId !== ctx.organisationId
  ) {
    throw new Error("League season not found or access denied");
  }

  const matchRounds = await db.matchRound.findMany({
    where: {
      leagueSeasonId: filters.leagueSeasonId,
      ...orgWhere,
    },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const roundIds = matchRounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: roundIds },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      matchRoundId: true,
      teamId: true,
      opponent: true,
      status: true,
      team: { select: { id: true, name: true } },
    },
  });

  const matchIds = matches.map((m) => m.id);

  const finalizedRoundIds = matchRounds
    .filter((r) => r.status === "FINALIZED")
    .map((r) => r.id);

  const effectiveRoundIds = includeDrafts ? roundIds : finalizedRoundIds;

  if (effectiveRoundIds.length === 0) {
    return {
      leagueSeasonId: filters.leagueSeasonId,
      leagueSeasonName: leagueSeason.name,
      roundCount: matchRounds.length,
      finalizedRoundCount: finalizedRoundIds.length,
      draftRoundCount: matchRounds.length - finalizedRoundIds.length,
      summary: {
        playersShown: 0,
        temporarySupportAppearances: 0,
        playersWithNoCompletedOpportunity: 0,
        playersInMultipleContexts: 0,
        mostFrequentHelpers: [],
      },
      players: [],
      rounds: matchRounds.map((r) => ({
        matchRoundId: r.id,
        matchRoundName: r.name,
        isFinalized: r.status === "FINALIZED",
      })),
    };
  }

  const selectionWhere = {
    matchId: { in: matchIds },
    ...(includeDrafts ? {} : { status: "FINALIZED" as const }),
  };

  const selections = await db.selection.findMany({
    where: selectionWhere,
    select: {
      id: true,
      playerId: true,
      matchId: true,
      role: true,
      status: true,
      controlledDoubleLoad: true,
      match: {
        select: {
          id: true,
          teamId: true,
          matchRoundId: true,
          opponent: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  const availabilities = await db.availability.findMany({
    where: {
      matchRoundId: { in: effectiveRoundIds },
    },
    select: {
      id: true,
      playerId: true,
      matchRoundId: true,
      status: true,
    },
  });

  const availabilityByPlayerRound = new Map<string, string>();
  for (const a of availabilities) {
    availabilityByPlayerRound.set(`${a.playerId}:${a.matchRoundId}`, a.status);
  }

  const teamIds = [...new Set(matches.map((m) => m.teamId))];
  const players = await db.player.findMany({
    where: {
      coreTeamId: { in: teamIds },
      active: true,
      removedAt: null,
      ...orgWhere,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
  });

  const selectionByPlayerMatch = new Map<string, (typeof selections)[number]>();
  for (const s of selections) {
    selectionByPlayerMatch.set(`${s.playerId}:${s.matchId}`, s);
  }

  const matchesByRound = new Map<string, (typeof matches)[number][]>();
  for (const m of matches) {
    const list = matchesByRound.get(m.matchRoundId) ?? [];
    list.push(m);
    matchesByRound.set(m.matchRoundId, list);
  }

  const effectiveRoundSet = new Set(effectiveRoundIds);

  const playerRows: PlayerPathwayRow[] = players.map((player) => {
    const cells: PathwayCell[] = [];
    let roundsPlayed = 0;
    let totalSelections = 0;
    let coreAppearances = 0;
    let supportAppearances = 0;
    let developmentAppearances = 0;
    let squadRepairAppearances = 0;
    let droppedRounds = 0;
    let unavailableRounds = 0;
    let contextTransitions = 0;

    let prevContext: PathwayContext | null = null;

    for (const round of matchRounds) {
      const isFinalizedRound = round.status === "FINALIZED";
      if (!includeDrafts && !isFinalizedRound) continue;
      if (!effectiveRoundSet.has(round.id)) continue;

      const roundMatches = matchesByRound.get(round.id) ?? [];

      const availStatus = availabilityByPlayerRound.get(
        `${player.id}:${round.id}`,
      );

      if (availStatus === "UNAVAILABLE") {
        unavailableRounds++;
        cells.push({
          matchRoundId: round.id,
          matchRoundName: round.name,
          matchId: "",
          status: "unavailable" as PathwayCellStatus,
          context: "unknown" as PathwayContext,
          teamId: player.coreTeamId ?? "",
          teamName: player.coreTeam?.name ?? "",
          role: "UNAVAILABLE",
          isDraft: !isFinalizedRound,
        });
        prevContext = null;
        continue;
      }

      let playerSelection: (typeof selections)[number] | null = null;
      let playerMatch: (typeof matches)[number] | null = null;

      for (const match of roundMatches) {
        const sel = selectionByPlayerMatch.get(`${player.id}:${match.id}`);
        if (sel) {
          playerSelection = sel;
          playerMatch = match;
          break;
        }
      }

      if (!playerSelection) {
        cells.push({
          matchRoundId: round.id,
          matchRoundName: round.name,
          matchId: "",
          status: "not_selected" as PathwayCellStatus,
          context: "unknown" as PathwayContext,
          teamId: player.coreTeamId ?? "",
          teamName: player.coreTeam?.name ?? "",
          role: "NOT_SELECTED",
          isDraft: !isFinalizedRound,
        });
        prevContext = null;
        continue;
      }

      const sel = playerSelection;
      const context = mapSelectionRoleToPathwayContext(sel.role);
      const isHomeTeam = sel.match.teamId === player.coreTeamId;
      const cellStatus = mapSelectionRoleToCellStatus(
        sel.role,
        !isFinalizedRound,
        isHomeTeam,
      );

      totalSelections++;
      if (context === "core") coreAppearances++;
      else if (context === "support") supportAppearances++;
      else if (context === "development") developmentAppearances++;
      else if (context === "squad_repair") squadRepairAppearances++;
      else if (context === "core_match_drop") droppedRounds++;

      if (isFinalizedRound) roundsPlayed++;

      if (prevContext !== null && prevContext !== context) {
        contextTransitions++;
      }
      prevContext = context;

      cells.push({
        matchRoundId: round.id,
        matchRoundName: round.name,
        matchId: sel.matchId,
        status: cellStatus,
        context,
        teamId: sel.match.teamId,
        teamName: sel.match.team.name,
        role: sel.role,
        isDraft: !isFinalizedRound,
        opponent: sel.match.opponent,
      });
    }

    return {
      playerId: player.id,
      playerName: [player.firstName, player.lastName].filter(Boolean).join(" "),
      coreTeamId: player.coreTeamId ?? "",
      coreTeamName: player.coreTeam?.name ?? "",
      roundsPlayed,
      totalSelections,
      coreAppearances,
      supportAppearances,
      developmentAppearances,
      squadRepairAppearances,
      droppedRounds,
      unavailableRounds,
      contextTransitions,
      cells,
    };
  });

  const filteredRows = filters.teamId
    ? playerRows.filter((p) => p.coreTeamId === filters.teamId)
    : playerRows;

  const summary = computePathwaySummaryMetrics(filteredRows);

  return {
    leagueSeasonId: filters.leagueSeasonId,
    leagueSeasonName: leagueSeason.name,
    roundCount: matchRounds.length,
    finalizedRoundCount: finalizedRoundIds.length,
    draftRoundCount: matchRounds.length - finalizedRoundIds.length,
    summary,
    players: filteredRows,
    rounds: matchRounds
      .filter((r) => effectiveRoundSet.has(r.id))
      .map((r) => ({
        matchRoundId: r.id,
        matchRoundName: r.name,
        isFinalized: r.status === "FINALIZED",
      })),
  };
}