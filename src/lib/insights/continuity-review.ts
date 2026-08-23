import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { InsightFilters, ContinuityRow } from "./insights-types";

// I-006: Continuity vs exploration — round-over-round comparison per team. "Do not prescribe
// one universal ideal" (per spec): this reports facts (retained/new players, formation repeat,
// role churn), not a recommended balance.
export async function getContinuityReview(filters: InsightFilters): Promise<ContinuityRow[]> {
  const ctx = await requireActorContext();
  const orgId = ctx.organisationId;

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const roundIds = rounds.map((r) => r.id);
  const roundNameById = new Map(rounds.map((r) => [r.id, r.name]));

  const teamFilter = filters.teamId ? { id: filters.teamId, organisationId: orgId } : { organisationId: orgId, archivedAt: null };
  const teams = await db.team.findMany({ where: teamFilter, select: { id: true, name: true } });

  const matches = await db.match.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId, teamId: { in: teams.map((t) => t.id) }, status: { not: "CANCELLED" } },
    select: { id: true, teamId: true, matchRoundId: true },
  });

  const selections = await db.selection.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId, status: "FINALIZED" },
    select: { playerId: true, role: true, matchId: true },
  });
  const selectionsByMatch = new Map<string, typeof selections>();
  for (const s of selections) {
    const list = selectionsByMatch.get(s.matchId) ?? [];
    list.push(s);
    selectionsByMatch.set(s.matchId, list);
  }

  const lineups = await db.matchLineup.findMany({
    where: { matchId: { in: matches.map((m) => m.id) }, organisationId: orgId },
    select: { matchId: true, formation: { select: { name: true } } },
  });
  const formationByMatch = new Map(lineups.map((l) => [l.matchId, l.formation?.name ?? null]));

  const matchesByTeamRound = new Map<string, { matchId: string; roundId: string }>();
  for (const m of matches) {
    matchesByTeamRound.set(`${m.teamId}:${m.matchRoundId}`, { matchId: m.id, roundId: m.matchRoundId });
  }

  const rows: ContinuityRow[] = [];

  for (const team of teams) {
    const teamRoundEntries = roundIds
      .map((roundId) => ({ roundId, match: matchesByTeamRound.get(`${team.id}:${roundId}`) }))
      .filter((e): e is { roundId: string; match: { matchId: string; roundId: string } } => !!e.match);

    for (let i = 0; i < teamRoundEntries.length; i++) {
      const current = teamRoundEntries[i]!;
      const previous = i > 0 ? teamRoundEntries[i - 1] : null;

      const currentSelections = selectionsByMatch.get(current.match.matchId) ?? [];
      const currentPlayerIds = new Set(currentSelections.map((s) => s.playerId));
      const currentRoleByPlayer = new Map(currentSelections.map((s) => [s.playerId, s.role]));

      const previousSelections = previous ? (selectionsByMatch.get(previous.match.matchId) ?? []) : [];
      const previousPlayerIds = new Set(previousSelections.map((s) => s.playerId));
      const previousRoleByPlayer = new Map(previousSelections.map((s) => [s.playerId, s.role]));

      let retainedStarterCount = 0;
      let newPlayerCount = 0;
      let supportPlayerChanges = 0;

      for (const playerId of currentPlayerIds) {
        if (previousPlayerIds.has(playerId)) {
          retainedStarterCount++;
          if (currentRoleByPlayer.get(playerId) !== previousRoleByPlayer.get(playerId)) {
            supportPlayerChanges++;
          }
        } else if (previous) {
          newPlayerCount++;
        }
      }

      const formationName = formationByMatch.get(current.match.matchId) ?? null;
      const previousFormationName = previous ? (formationByMatch.get(previous.match.matchId) ?? null) : null;

      rows.push({
        teamId: team.id,
        teamName: team.name,
        matchRoundId: current.roundId,
        matchRoundLabel: roundNameById.get(current.roundId) ?? current.roundId,
        previousMatchRoundId: previous?.roundId ?? null,
        retainedStarterCount,
        newPlayerCount: previous ? newPlayerCount : currentPlayerIds.size,
        retainedFormation: previous ? (formationName && previousFormationName ? formationName === previousFormationName : null) : null,
        formationName,
        previousFormationName,
        supportPlayerChanges,
      });
    }
  }

  return rows;
}
