"use server";

import { requireActorContext } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
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
  const ctx = await requireActorContext();
  return getPlayerAssignmentBoard(ctx.orgFilter);
}

export async function movePlayerToTeamAction(input: {
  playerId: string;
  targetTeamId: string | null;
  previousTeamId?: string | null;
  reason?: string;
}) {
  const ctx = await requireActorContext();
  await requirePlayerOrgAccess(input.playerId, ctx.orgFilter);
  if (input.targetTeamId) {
    await requireTeamOrgAccess(input.targetTeamId, ctx.orgFilter);
  }
  return movePlayerToTeam(input);
}