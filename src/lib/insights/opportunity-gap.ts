import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { InsightFilters, OpportunityGapRow } from "./insights-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

// I-003: Opportunity gap — descriptive gap between intended and realised opportunity over a
// period. Deliberately not a punitive debt score or automatic future-selection obligation (see
// AGENTS.md / 08-COACHING-INTELLIGENCE-MODELS.md's I-003).
export async function getOpportunityGap(filters: InsightFilters): Promise<OpportunityGapRow[]> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const playerFilter = filters.includeInactive
    ? { organisationId: orgId, removedAt: null }
    : { organisationId: orgId, active: true, removedAt: null };

  const players = await db.player.findMany({
    where: playerFilter,
    select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });
  const playerIds = players.map((p) => p.id);

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true },
  });
  const roundIds = rounds.map((r) => r.id);

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      organisationId: orgId,
      playerId: { in: playerIds },
      status: "FINALIZED",
    },
    select: {
      playerId: true,
      role: true,
      match: { select: { id: true, status: true } },
    },
  });

  const matchIds = await db.match.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId },
    select: { id: true },
  });

  const actuals = await db.postMatchPlayerActual.findMany({
    where: { organisationId: orgId, playerId: { in: playerIds }, matchId: { in: matchIds.map((m) => m.id) } },
    select: { playerId: true, matchId: true, attendanceStatus: true },
  });
  const actualByPlayerMatch = new Map<string, (typeof actuals)[number]>();
  for (const a of actuals) {
    actualByPlayerMatch.set(`${a.playerId}:${a.matchId}`, a);
  }

  const unavailableCounts = await db.availability.groupBy({
    by: ["playerId"],
    where: { organisationId: orgId, playerId: { in: playerIds }, matchRoundId: { in: roundIds }, status: "UNAVAILABLE" },
    _count: { id: true },
  });
  const unavailableByPlayer = new Map(unavailableCounts.map((u) => [u.playerId, u._count.id]));

  const selectionsByPlayer = new Map<string, typeof selections>();
  for (const s of selections) {
    const list = selectionsByPlayer.get(s.playerId) ?? [];
    list.push(s);
    selectionsByPlayer.set(s.playerId, list);
  }

  return players.map((player) => {
    const playerSelections = selectionsByPlayer.get(player.id) ?? [];
    const nonCancelled = playerSelections.filter((s) => s.match.status !== "CANCELLED");
    const cancelledMatches = playerSelections.filter((s) => s.match.status === "CANCELLED").length;

    let realisedOpportunities = 0;
    let noShowCount = 0;
    let unknownAttendanceCount = 0;
    let helperElsewhereCount = 0;

    for (const s of nonCancelled) {
      if (s.role !== "CORE") helperElsewhereCount++;
      const actual = actualByPlayerMatch.get(`${player.id}:${s.match.id}`);
      if (!actual || actual.attendanceStatus === "UNKNOWN") {
        unknownAttendanceCount++;
      } else if (actual.attendanceStatus === "PRESENT") {
        realisedOpportunities++;
      } else if (actual.attendanceStatus === "NO_SHOW") {
        noShowCount++;
      }
    }

    const plannedOpportunities = nonCancelled.length;

    return {
      playerId: player.id,
      playerName: player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName,
      coreTeamId: player.coreTeamId,
      coreTeamName: player.coreTeam?.name ?? null,
      plannedOpportunities,
      realisedOpportunities,
      gap: plannedOpportunities - realisedOpportunities,
      unavailableRounds: unavailableByPlayer.get(player.id) ?? 0,
      cancelledMatches,
      helperElsewhereCount,
      noShowCount,
      unknownAttendanceCount,
    };
  });
}
