"use server";

import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";
import { getPlayerAssignmentBoard, movePlayerToTeam } from "@/domain/player-assignment/service";

async function requireTeamOrgAccess(teamId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found or access denied.");
}

async function requirePlayerOrgAccess(playerId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const player = await db.player.findFirst({
    where: { id: playerId, ...orgFilter.filterNullable },
    select: { id: true },
  });
  if (!player) throw new Error("Player not found or access denied.");
}

export async function fetchPlayerAssignmentBoard() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  return getPlayerAssignmentBoard(orgFilter);
}

export async function movePlayerToTeamAction(input: {
  playerId: string;
  targetTeamId: string | null;
  previousTeamId?: string | null;
  reason?: string;
}) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requirePlayerOrgAccess(input.playerId, orgFilter);
  if (input.targetTeamId) {
    await requireTeamOrgAccess(input.targetTeamId, orgFilter);
  }
  return movePlayerToTeam(input);
}