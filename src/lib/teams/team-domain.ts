import { db } from "@/lib/db";
import { getOrCreateDefaultGroup } from "@/lib/groups/group-domain";

export type TeamMutationResult =
  | { success: true; teamId: string }
  | { success: false; error: string };

export async function checkTeamDeletionGuard(teamId: string, organisationId?: string): Promise<TeamMutationResult> {
  const orgFilter = organisationId ? { organisationId } : {};
  const [team, activeCorePlayerCount, rotationPathCount, matchCount] = await Promise.all([
    db.team.findUnique({
      where: { id: teamId },
      select: { id: true, organisationId: true },
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

  if (organisationId && team.organisationId !== organisationId) {
    return { success: false, error: "Team not found in your organisation." };
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
  organisationId?: string;
}): Promise<TeamMutationResult> {
  const nameFilter = data.organisationId
    ? { name: data.name, organisationId: data.organisationId }
    : { name: data.name };

  const existingTeam = await db.team.findFirst({
    where: nameFilter,
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

  const organisationId = data.organisationId;
  if (!organisationId) {
    return { success: false, error: "Organisation ID is required to create a team." };
  }

  const footballGroupId = await getOrCreateDefaultGroup(organisationId);

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
      organisationId,
      footballGroupId,
    },
  });

  return { success: true, teamId: team.id };
}

export async function archiveTeam(teamId: string, organisationId?: string): Promise<TeamMutationResult> {
  const guard = await checkTeamDeletionGuard(teamId, organisationId);
  if (!guard.success) return guard;

  await db.team.update({
    where: { id: guard.teamId },
    data: { archivedAt: new Date() },
  });

  return { success: true, teamId: guard.teamId };
}