import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { InsightFilters, PositionExposureRow } from "./insights-types";
import { incrementCount } from "./position-exposure-helpers";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

// I-004: Position and formation exposure. "Unused lineup assignments are not realised
// exposure" (per spec) — planned positions come from actual MatchLineupAssignment rows (a
// coach-built lineup), not from the player's static primaryPosition, and realised positions
// come only from PostMatchPlayerActual.actualPositions recorded after the match.
export async function getPositionExposure(filters: InsightFilters): Promise<PositionExposureRow[]> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const playerFilter = filters.includeInactive
    ? { organisationId: orgId, removedAt: null }
    : { organisationId: orgId, active: true, removedAt: null };

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true },
  });
  const roundIds = rounds.map((r) => r.id);

  const players = await db.player.findMany({
    where: playerFilter,
    select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });
  const playerIds = players.map((p) => p.id);

  const selections = await db.selection.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId, status: "FINALIZED", playerId: { in: playerIds } },
    select: { playerId: true, matchId: true },
  });
  const matchIds = [...new Set(selections.map((s) => s.matchId))];

  const lineups = await db.matchLineup.findMany({
    where: { matchId: { in: matchIds }, organisationId: orgId },
    select: {
      matchId: true,
      formation: { select: { name: true } },
      assignments: { where: { playerId: { in: playerIds } }, select: { playerId: true, slotId: true } },
    },
  });

  const slotIds = [...new Set(lineups.flatMap((l) => l.assignments.map((a) => a.slotId)))];
  const slots = await db.formationSlot.findMany({
    where: { id: { in: slotIds }, organisationId: orgId },
    select: { id: true, label: true },
  });
  const slotLabelById = new Map(slots.map((s) => [s.id, s.label]));

  const plannedByPlayerMatch = new Map<string, string>();
  const formationByPlayerMatch = new Map<string, string>();
  for (const lineup of lineups) {
    for (const assignment of lineup.assignments) {
      const key = `${assignment.playerId}:${lineup.matchId}`;
      const label = slotLabelById.get(assignment.slotId);
      if (label) plannedByPlayerMatch.set(key, label);
      if (lineup.formation?.name) formationByPlayerMatch.set(key, lineup.formation.name);
    }
  }

  const actuals = await db.postMatchPlayerActual.findMany({
    where: { organisationId: orgId, matchId: { in: matchIds }, playerId: { in: playerIds } },
    select: { playerId: true, matchId: true, actualPositions: true },
  });
  const actualByPlayerMatch = new Map(actuals.map((a) => [`${a.playerId}:${a.matchId}`, a.actualPositions as string[] | null]));

  const selectionsByPlayer = new Map<string, typeof selections>();
  for (const s of selections) {
    const list = selectionsByPlayer.get(s.playerId) ?? [];
    list.push(s);
    selectionsByPlayer.set(s.playerId, list);
  }

  return players
    .map((player) => {
      const playerSelections = selectionsByPlayer.get(player.id) ?? [];
      const plannedPositions: Record<string, number> = {};
      const realisedPositions: Record<string, number> = {};
      const formationsExperienced = new Set<string>();
      let withEvidence = 0;

      for (const s of playerSelections) {
        const key = `${player.id}:${s.matchId}`;
        let hasEvidence = false;

        const plannedLabel = plannedByPlayerMatch.get(key);
        if (plannedLabel) {
          incrementCount(plannedPositions, plannedLabel);
          hasEvidence = true;
        }
        const formationName = formationByPlayerMatch.get(key);
        if (formationName) formationsExperienced.add(formationName);

        const realised = actualByPlayerMatch.get(key);
        if (realised && realised.length > 0) {
          for (const pos of realised) incrementCount(realisedPositions, pos);
          hasEvidence = true;
        }

        if (hasEvidence) withEvidence++;
      }

      return {
        playerId: player.id,
        playerName: player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName,
        coreTeamId: player.coreTeamId,
        coreTeamName: player.coreTeam?.name ?? null,
        sampleSize: playerSelections.length,
        plannedPositions,
        realisedPositions,
        formationsExperienced: [...formationsExperienced],
        evidenceCompleteness: playerSelections.length > 0 ? withEvidence / playerSelections.length : 0,
      };
    })
    .filter((row) => row.sampleSize > 0);
}
