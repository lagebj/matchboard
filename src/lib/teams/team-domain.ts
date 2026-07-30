import { db } from "@/lib/db";

export type TeamMutationResult =
  | { success: true; teamId: string }
  | { success: false; error: string };

export async function checkTeamDeletionGuard(teamId: string): Promise<TeamMutationResult> {
  const [team, activeCorePlayerCount, rotationPathCount, matchCount] = await Promise.all([
    db.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    }),
    db.player.count({
      where: { coreTeamId: teamId, removedAt: null },
    }),
    db.rotationPath.count({
      where: {
        OR: [{ toTeamId: teamId }, { fromTeamId: teamId }],
      },
    }),
    db.match.count({
      where: { teamId: teamId },
    }),
  ]);

  if (!team) {
    return { success: false, error: "Team not found." };
  }

  if (activeCorePlayerCount > 0 || rotationPathCount > 0 || matchCount > 0) {
    return {
      success: false,
      error: "This team is still referenced by active players, rotation paths, or matches. Remove those references first.",
    };
  }

  return { success: true, teamId: team.id };
}

export async function createOrRestoreTeam(data: {
  name: string;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  maxSquadSize: number;
  minCorePlayers: number;
  minSupportPlayers: number;
  developmentSlots: number;
  supportPriority: number;
}): Promise<TeamMutationResult> {
  const existingTeam = await db.team.findFirst({
    where: { name: data.name },
    select: { archivedAt: true, id: true },
  });

  if (existingTeam?.archivedAt) {
    await db.team.update({
      where: { id: existingTeam.id },
      data: {
        archivedAt: null,
        developmentSlots: data.developmentSlots,
        maxSquadSize: data.maxSquadSize,
        minAcceptedSquadSize: data.minAcceptedSquadSize,
        minCorePlayers: data.minCorePlayers,
        minSupportPlayers: data.minSupportPlayers,
        name: data.name,
        supportPriority: data.supportPriority,
        targetSquadSize: data.targetSquadSize,
      },
    });

    return { success: true, teamId: existingTeam.id };
  }

  if (existingTeam) {
    return { success: false, error: "A team with this name already exists." };
  }

  const team = await db.team.create({
    data: {
      developmentSlots: data.developmentSlots,
      maxSquadSize: data.maxSquadSize,
      minAcceptedSquadSize: data.minAcceptedSquadSize,
      minCorePlayers: data.minCorePlayers,
      minSupportPlayers: data.minSupportPlayers,
      name: data.name,
      supportPriority: data.supportPriority,
      targetSquadSize: data.targetSquadSize,
    },
  });

  return { success: true, teamId: team.id };
}

export async function archiveTeam(teamId: string): Promise<TeamMutationResult> {
  const guard = await checkTeamDeletionGuard(teamId);
  if (!guard.success) return guard;

  await db.team.update({
    where: { id: guard.teamId },
    data: { archivedAt: new Date() },
  });

  return { success: true, teamId: guard.teamId };
}