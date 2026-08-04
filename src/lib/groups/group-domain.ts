import { db } from "@/lib/db";
import type { FootballGroupType, GroupMembershipType, GroupMembershipStatus, GroupAccessRole } from "@/generated/prisma/client";
import { generateSlug } from "./group-slug";

export type GroupMutationResult =
  | { success: true; groupId: string }
  | { success: false; error: string };

export async function createFootballGroup(data: {
  name: string;
  type: FootballGroupType;
  cohortYear?: number;
  description?: string;
  organisationId: string;
}): Promise<GroupMutationResult> {
  const slug = generateSlug(data.name);

  const existing = await db.footballGroup.findFirst({
    where: {
      organisationId: data.organisationId,
      slug,
      isActive: true,
    },
    select: { id: true },
  });

  if (existing) {
    return { success: false, error: "An active group with this name already exists in this organisation." };
  }

  const existingInactive = await db.footballGroup.findFirst({
    where: {
      organisationId: data.organisationId,
      slug,
      isActive: false,
    },
    select: { id: true },
  });

  if (existingInactive) {
    await db.footballGroup.update({
      where: { id: existingInactive.id },
      data: {
        name: data.name,
        type: data.type,
        cohortYear: data.cohortYear ?? null,
        description: data.description ?? null,
        isActive: true,
        deactivatedAt: null,
      },
    });

    return { success: true, groupId: existingInactive.id };
  }

  const uniqueSlug = await ensureUniqueSlug(slug, data.organisationId);

  const group = await db.footballGroup.create({
    data: {
      name: data.name,
      slug: uniqueSlug,
      type: data.type,
      cohortYear: data.cohortYear ?? null,
      description: data.description ?? null,
      organisationId: data.organisationId,
    },
  });

  return { success: true, groupId: group.id };
}

export async function updateFootballGroup(
  groupId: string,
  data: {
    name?: string;
    type?: FootballGroupType;
    cohortYear?: number | null;
    description?: string | null;
  },
  organisationId: string,
): Promise<GroupMutationResult> {
  const group = await db.footballGroup.findFirst({
    where: { id: groupId, organisationId, isActive: true },
    select: { id: true },
  });

  if (!group) {
    return { success: false, error: "Group not found or not accessible." };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.cohortYear !== undefined) updateData.cohortYear = data.cohortYear;
  if (data.description !== undefined) updateData.description = data.description;

  if (data.name !== undefined) {
    updateData.slug = await ensureUniqueSlug(generateSlug(data.name), organisationId, groupId);
  }

  await db.footballGroup.update({
    where: { id: groupId },
    data: updateData,
  });

  return { success: true, groupId };
}

export async function deactivateFootballGroup(
  groupId: string,
  organisationId: string,
): Promise<GroupMutationResult> {
  const group = await db.footballGroup.findFirst({
    where: { id: groupId, organisationId, isActive: true },
    select: { id: true },
  });

  if (!group) {
    return { success: false, error: "Group not found or already inactive." };
  }

  const [activePlayers, teams, activeSeasons, activeEvents] = await Promise.all([
    db.footballGroupPlayer.count({
      where: { footballGroupId: groupId, status: "ACTIVE" },
    }),
    db.team.count({
      where: { footballGroupId: groupId, archivedAt: null },
    }),
    db.leagueSeason.count({
      where: { footballGroupId: groupId, status: "OPEN" },
    }),
    db.event.count({
      where: { footballGroupId: groupId },
    }),
  ]);

  if (activePlayers > 0 || teams > 0 || activeSeasons > 0 || activeEvents > 0) {
    return {
      success: false,
      error: "Cannot deactivate a group with active players, teams, seasons, or events. Remove those first.",
    };
  }

  await db.footballGroup.update({
    where: { id: groupId },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  return { success: true, groupId };
}

export async function addPlayerToGroup(
  playerId: string,
  groupId: string,
  organisationId: string,
  options?: {
    membershipType?: GroupMembershipType;
    coreTeamId?: string;
  },
): Promise<GroupMutationResult> {
  const membershipType = options?.membershipType ?? "PRIMARY";

  const existingActive = await db.footballGroupPlayer.findFirst({
    where: {
      playerId,
      status: "ACTIVE",
      membershipType: "PRIMARY",
    },
    select: { id: true, footballGroupId: true },
  });

  if (existingActive && membershipType === "PRIMARY") {
    return {
      success: false,
      error: `Player already has an active primary membership in group ${existingActive.footballGroupId}.`,
    };
  }

  const membership = await db.footballGroupPlayer.create({
    data: {
      footballGroupId: groupId,
      playerId,
      organisationId,
      membershipType,
      status: "ACTIVE",
      coreTeamId: options?.coreTeamId ?? null,
      joinedAt: new Date(),
    },
  });

  return { success: true, groupId: membership.footballGroupId };
}

export async function removePlayerFromGroup(
  playerId: string,
  groupId: string,
  organisationId: string,
): Promise<GroupMutationResult> {
  const membership = await db.footballGroupPlayer.findFirst({
    where: {
      playerId,
      footballGroupId: groupId,
      organisationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!membership) {
    return { success: false, error: "No active membership found for this player in this group." };
  }

  await db.footballGroupPlayer.update({
    where: { id: membership.id },
    data: {
      status: "INACTIVE",
      deactivatedAt: new Date(),
    },
  });

  return { success: true, groupId };
}

export async function transferPlayerBetweenGroups(
  playerId: string,
  sourceGroupId: string,
  targetGroupId: string,
  organisationId: string,
  options?: {
    coreTeamId?: string;
  },
): Promise<GroupMutationResult> {
  const sourceMembership = await db.footballGroupPlayer.findFirst({
    where: {
      playerId,
      footballGroupId: sourceGroupId,
      organisationId,
      status: "ACTIVE",
      membershipType: "PRIMARY",
    },
    select: { id: true },
  });

  if (!sourceMembership) {
    return { success: false, error: "No active primary membership found in source group." };
  }

  const existingInTarget = await db.footballGroupPlayer.findFirst({
    where: {
      playerId,
      footballGroupId: targetGroupId,
      status: "ACTIVE",
      membershipType: "PRIMARY",
    },
    select: { id: true },
  });

  if (existingInTarget) {
    return { success: false, error: "Player already has an active primary membership in target group." };
  }

  await db.$transaction([
    db.footballGroupPlayer.update({
      where: { id: sourceMembership.id },
      data: {
        status: "TRANSFERRED",
        transferredToGroupId: targetGroupId,
      },
    }),
    db.footballGroupPlayer.create({
      data: {
        footballGroupId: targetGroupId,
        playerId,
        organisationId,
        membershipType: "PRIMARY",
        status: "ACTIVE",
        coreTeamId: options?.coreTeamId ?? null,
        joinedAt: new Date(),
      },
    }),
  ]);

  return { success: true, groupId: targetGroupId };
}

export async function addGroupAccess(
  membershipId: string,
  groupId: string,
  role: GroupAccessRole,
): Promise<{ success: true; accessId: string } | { success: false; error: string }> {
  const existing = await db.groupAccess.findFirst({
    where: { membershipId, footballGroupId: groupId },
    select: { id: true },
  });

  if (existing) {
    if (role) {
      await db.groupAccess.update({
        where: { id: existing.id },
        data: { role },
      });
    }
    return { success: true, accessId: existing.id };
  }

  const access = await db.groupAccess.create({
    data: {
      membershipId,
      footballGroupId: groupId,
      role,
    },
  });

  return { success: true, accessId: access.id };
}

export async function removeGroupAccess(
  membershipId: string,
  groupId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const existing = await db.groupAccess.findFirst({
    where: { membershipId, footballGroupId: groupId },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "No group access found for this membership and group." };
  }

  await db.groupAccess.delete({
    where: { id: existing.id },
  });

  return { success: true };
}

export async function getGroupWithDetails(groupSlugOrId: string, organisationId: string) {
  const group = await db.footballGroup.findFirst({
    where: {
      organisationId,
      isActive: true,
      OR: [
        { id: groupSlugOrId },
        { slug: groupSlugOrId },
      ],
    },
    include: {
      teams: { where: { archivedAt: null }, select: { id: true, name: true } },
      leagueSeasons: { select: { id: true, name: true, status: true } },
      events: { select: { id: true, name: true, eventType: true } },
      groupAccesses: {
        include: {
          membership: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      players: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          playerId: true,
          membershipType: true,
          coreTeamId: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              active: true,
              coreTeamId: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { player: { firstName: "asc" } },
      },
    },
  });

  if (!group) return null;

  const playerCount = group.players.length;

  return { ...group, playerCount };
}

export async function listGroupsForOrganisation(organisationId: string) {
  return db.footballGroup.findMany({
    where: { organisationId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      cohortYear: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          teams: { where: { archivedAt: null } },
          players: { where: { status: "ACTIVE" } },
          groupAccesses: true,
        },
      },
    },
  });
}

async function ensureUniqueSlug(
  baseSlug: string,
  organisationId: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.footballGroup.findFirst({
      where: {
        organisationId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}