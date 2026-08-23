import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { InsightFilters, OpportunityQualityEntry } from "./insights-types";

// I-002: Opportunity quality — one factual record per planned opportunity. Realised minutes
// are not a tracked field for league matches (only Event reports track minutesPlayed), so this
// is reported honestly as untracked rather than inferred (I-001 evidence semantics).
export async function getOpportunityQuality(filters: InsightFilters): Promise<OpportunityQualityEntry[]> {
  const ctx = await requireActorContext();
  const orgId = ctx.organisationId;

  const playerFilter = filters.includeInactive
    ? { organisationId: orgId, removedAt: null }
    : { organisationId: orgId, active: true, removedAt: null };

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, name: true },
  });
  const roundIds = rounds.map((r) => r.id);
  const roundNameById = new Map(rounds.map((r) => [r.id, r.name]));

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      organisationId: orgId,
      status: "FINALIZED",
      player: playerFilter,
      ...(filters.teamId ? { match: { teamId: filters.teamId } } : {}),
    },
    select: {
      playerId: true,
      role: true,
      matchId: true,
      matchRoundId: true,
      player: {
        select: { firstName: true, lastName: true, primaryPosition: true, coreTeamId: true, coreTeam: { select: { name: true } } },
      },
      match: {
        select: {
          id: true,
          startsAt: true,
          status: true,
          team: { select: { id: true, name: true } },
          opponentTeam: { select: { displayName: true } },
          opponent: true,
        },
      },
    },
    orderBy: { match: { startsAt: "asc" } },
  });

  const matchIds = [...new Set(selections.map((s) => s.matchId))];
  const actuals = await db.postMatchPlayerActual.findMany({
    where: { organisationId: orgId, matchId: { in: matchIds } },
    select: { playerId: true, matchId: true, attendanceStatus: true },
  });
  const actualByPlayerMatch = new Map(actuals.map((a) => [`${a.playerId}:${a.matchId}`, a]));

  return selections.map((s) => {
    const actual = actualByPlayerMatch.get(`${s.playerId}:${s.matchId}`);
    const realisedAttendance: OpportunityQualityEntry["realisedAttendance"] =
      actual?.attendanceStatus === "PRESENT" ? "present" : actual?.attendanceStatus === "NO_SHOW" ? "no_show" : "unknown";

    return {
      playerId: s.playerId,
      playerName: s.player.lastName ? `${s.player.firstName} ${s.player.lastName}` : s.player.firstName,
      coreTeamId: s.player.coreTeamId,
      coreTeamName: s.player.coreTeam?.name ?? null,
      matchId: s.matchId,
      matchRoundId: s.matchRoundId,
      matchRoundLabel: roundNameById.get(s.matchRoundId) ?? s.matchRoundId,
      matchDate: s.match.startsAt.toISOString(),
      teamId: s.match.team.id,
      teamName: s.match.team.name,
      opponentName: s.match.opponentTeam?.displayName ?? s.match.opponent ?? null,
      role: s.role,
      isCore: s.role === "CORE",
      supportBurden: s.role !== "CORE",
      plannedPosition: s.player.primaryPosition,
      realisedAttendance,
      realisedMinutes: null,
      minutesEvidence: "not_tracked",
      cancelled: s.match.status === "CANCELLED",
    };
  });
}
