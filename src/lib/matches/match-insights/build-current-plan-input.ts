import "server-only";
import { db } from "@/lib/db";
import type { CurrentPlanInput } from "./types";

/**
 * Assembles the current plan (squad, formation, planned rotations) for a match — shared by
 * `match-prep.ts` (AI eligibility gates on top of this) and the Match Insights server view-model
 * (no completeness gate: deterministic insights must remain useful for a partial/incomplete plan
 * too, per the bundle's "must remain useful when AI is unavailable"). Returns `null` only when the
 * match itself cannot be resolved in this organisation, never because the plan is incomplete.
 */

/** `Selection.role` (`SelectionRole`) has six values; the Match Insight domain layer only
 * distinguishes CORE/SUPPORT/DEVELOPMENT (bundle's "role" concept for adjacency/opportunity
 * facts). `BACKFILL`/`CONFIDENCE_REBUILD`/`CORE_MATCH_DROP` are non-primary-starting,
 * non-development roles -- the closest existing bucket is SUPPORT. */
export function toPlanRole(role: string): "CORE" | "SUPPORT" | "DEVELOPMENT" {
  if (role === "CORE") return "CORE";
  if (role === "DEVELOPMENT") return "DEVELOPMENT";
  return "SUPPORT";
}

export async function buildCurrentPlanInput(params: {
  organisationId: string;
  matchId: string;
}): Promise<CurrentPlanInput | null> {
  const match = await db.match.findFirst({
    where: { id: params.matchId, organisationId: params.organisationId },
    select: {
      id: true,
      teamId: true,
      formation: true,
      opponentTeamId: true,
      startsAt: true,
      matchRound: { select: { leagueSeasonId: true } },
    },
  });
  if (!match || !match.matchRound) return null;

  const selections = await db.selection.findMany({
    where: { matchId: match.id, organisationId: params.organisationId, status: { in: ["DRAFT", "FINALIZED"] } },
    select: { playerId: true, role: true },
  });

  const players = selections.length
    ? await db.player.findMany({ where: { id: { in: selections.map((s) => s.playerId) } }, select: { id: true, primaryPosition: true } })
    : [];
  const positionByPlayer = new Map(players.map((p) => [p.id, p.primaryPosition]));

  const rotation = await db.plannedRotation.findFirst({
    where: { matchId: match.id, teamId: match.teamId, organisationId: params.organisationId },
    select: { changes: { select: { sequence: true, outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true } } },
  });
  const rotationChanges = [...(rotation?.changes ?? [])].sort((a, b) => a.sequence - b.sequence);

  return {
    matchId: match.id,
    teamId: match.teamId,
    organisationId: params.organisationId,
    leagueSeasonId: match.matchRound.leagueSeasonId,
    opponentTeamId: match.opponentTeamId,
    formation: match.formation,
    matchStartsAt: match.startsAt,
    squad: selections.map((s) => ({ playerId: s.playerId, role: toPlanRole(s.role), position: positionByPlayer.get(s.playerId) ?? null })),
    plannedRotations: rotationChanges.map((c) => ({
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
    })),
  };
}
