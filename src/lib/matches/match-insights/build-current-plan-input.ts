import "server-only";
import { db } from "@/lib/db";
import type { CurrentPlanInput, OperationalRosterEntry } from "./types";

/**
 * Assembles the current plan (squad, formation, planned rotations) for a match — shared by
 * `match-prep.ts` (AI eligibility gates on top of this) and the Match Insights server view-model
 * (no completeness gate: deterministic insights must remain useful for a partial/incomplete plan
 * too, per the bundle's "must remain useful when AI is unavailable"). Returns `null` only when the
 * match itself cannot be resolved in this organisation, never because the plan is incomplete.
 *
 * ADR-0151: The operational roster is now computed alongside the planned squad. The operational
 * roster includes match-day additions and excludes absent players, while the planned squad
 * preserves the original Round Board allocation. Match Insights and AI use the operational roster
 * for active-participant reasoning and the planned squad for historical/comparison reasoning.
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

  // ADR-0151: Build operational roster from effective roster (selections + helpers + guests - absences).
  // This is computed in parallel with the planned squad above, since selections are already loaded.
  const [helpers, absences, guests] = await Promise.all([
    db.matchHelperAssignment.findMany({
      where: { matchId: match.id },
      select: {
        provenance: true,
        playerId: true,
        player: { select: { id: true, primaryPosition: true } },
      },
    }),
    db.matchReportAbsence.findMany({
      where: { matchId: match.id },
      select: { playerId: true, reason: true },
    }),
    db.leagueMatchGuestAssignment.findMany({
      where: { matchId: match.id },
      select: { guestPlayerId: true },
    }),
  ]);

  const absentPlayerIds = new Set(absences.map((a) => a.playerId));

  // Operational roster: planned players (excluding absent) + helpers/additions (excluding absent) + guests
  const operationalRoster: OperationalRosterEntry[] = [];

  // Planned players
  for (const s of selections) {
    const isAbsent = absentPlayerIds.has(s.playerId);
    operationalRoster.push({
      playerId: s.playerId,
      participantType: "PLAYER",
      source: "planned",
      provenance: null,
      role: toPlanRole(s.role),
      position: positionByPlayer.get(s.playerId) ?? null,
      isActiveParticipant: !isAbsent,
      absenceReason: isAbsent ? absences.find((a) => a.playerId === s.playerId)?.reason ?? null : null,
    });
  }

  // Helper and match-day addition players
  const allHelperPlayerIds = new Set(selections.map((s) => s.playerId));
  for (const h of helpers) {
    if (allHelperPlayerIds.has(h.playerId)) continue; // already in planned squad
    const isAbsent = absentPlayerIds.has(h.playerId);
    operationalRoster.push({
      playerId: h.playerId,
      participantType: "PLAYER",
      source: h.provenance === "MATCH_DAY_ADDITION" ? "match_day_addition" : "helper",
      provenance: h.provenance,
      role: null,
      position: h.player.primaryPosition,
      isActiveParticipant: !isAbsent,
      absenceReason: isAbsent ? absences.find((a) => a.playerId === h.playerId)?.reason ?? null : null,
    });
  }

  // Guest players (always active)
  for (const g of guests) {
    operationalRoster.push({
      playerId: null,
      guestPlayerId: g.guestPlayerId,
      participantType: "GUEST_PLAYER",
      source: "guest",
      provenance: null,
      role: null,
      position: null,
      isActiveParticipant: true,
      absenceReason: null,
    });
  }

  // Planned squad: the original Selection rows, preserved for historical comparison
  const plannedSquad = selections.map((s) => ({
    playerId: s.playerId,
    role: toPlanRole(s.role),
    position: positionByPlayer.get(s.playerId) ?? null,
  }));

  return {
    matchId: match.id,
    teamId: match.teamId,
    organisationId: params.organisationId,
    leagueSeasonId: match.matchRound.leagueSeasonId,
    opponentTeamId: match.opponentTeamId,
    formation: match.formation,
    matchStartsAt: match.startsAt,
    squad: plannedSquad,
    operationalRoster,
    plannedRotations: rotationChanges.map((c) => ({
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
    })),
  };
}
