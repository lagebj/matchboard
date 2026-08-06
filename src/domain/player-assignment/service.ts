import type { PlayerAssignmentBoard, PlayerAssignmentBoardPlayer, MovePlayerToTeamInput } from "./types";
import { db } from "@/lib/db";
import { recordDecision } from "@/domain/assistant-manager/service";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export async function getPlayerAssignmentBoard(orgFilter: OrgFilterMode): Promise<PlayerAssignmentBoard> {
  const teams = await db.team.findMany({
    where: { archivedAt: null, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    orderBy: { name: "asc" },
    include: {
      corePlayers: {
        where: { active: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          nonRotatable: true,
          coreTeamId: true,
        },
        orderBy: { firstName: "asc" },
      },
    },
  });

  const assignedPlayerIds = new Set<string>();
  for (const team of teams) {
    for (const player of team.corePlayers) {
      assignedPlayerIds.add(player.id);
    }
  }

  const allActivePlayers = await db.player.findMany({
    where: { active: true, ...(orgFilter.type === "org" ? orgFilter.filterNullable : {}) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      primaryPosition: true,
      nonRotatable: true,
      coreTeamId: true,
    },
    orderBy: { firstName: "asc" },
  });

  const activePlayersWithoutTeam = allActivePlayers
    .filter((p) => !assignedPlayerIds.has(p.id) && !p.coreTeamId)
    .map((p) => ({
      playerId: p.id,
      displayName: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
      primaryPosition: p.primaryPosition ?? undefined,
      rotatable: !p.nonRotatable,
      teamId: p.coreTeamId ?? undefined,
    }));

  const result: PlayerAssignmentBoard = {
    teams: teams.map((team) => ({
      teamId: team.id,
      name: team.name,
      players: team.corePlayers.map((p) => ({
        playerId: p.id,
        displayName: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
        primaryPosition: p.primaryPosition ?? undefined,
        rotatable: !p.nonRotatable,
        teamId: p.coreTeamId,
        coreGroup: team.name,
      })),
    })),
    unassigned: activePlayersWithoutTeam,
  };

  return result;
}

export async function movePlayerToTeam(input: MovePlayerToTeamInput): Promise<PlayerAssignmentBoardPlayer> {
  const player = await db.player.findUniqueOrThrow({ where: { id: input.playerId } });
  const previousTeamId = player.coreTeamId;

  await db.player.update({
    where: { id: input.playerId },
    data: { coreTeamId: input.targetTeamId },
  });

  const targetTeam = input.targetTeamId
    ? await db.team.findUnique({ where: { id: input.targetTeamId } })
    : null;

  await recordDecision({
    decisionType: "PLAYER_ASSIGNMENT",
    entityType: "PLAYER",
    entityId: input.playerId,
    action: "MOVE_PLAYER_TO_TEAM",
    reason: input.reason ?? `Moved player from ${previousTeamId ? "previous team" : "unassigned"} to ${targetTeam?.name ?? "unassigned"}`,
    beforeSnapshot: { previousTeamId },
    afterSnapshot: { newTeamId: input.targetTeamId },
    organisationId: input.organisationId,
  });

  const updatedPlayer = await db.player.findUniqueOrThrow({ where: { id: input.playerId } });
  const updatedTeam = updatedPlayer.coreTeamId
    ? await db.team.findUnique({ where: { id: updatedPlayer.coreTeamId } })
    : null;

  return {
    playerId: updatedPlayer.id,
    displayName: `${updatedPlayer.firstName}${updatedPlayer.lastName ? ` ${updatedPlayer.lastName}` : ""}`,
    primaryPosition: updatedPlayer.primaryPosition ?? undefined,
    rotatable: !updatedPlayer.nonRotatable,
    teamId: updatedPlayer.coreTeamId ?? undefined,
    coreGroup: updatedTeam?.name ?? undefined,
  };
}