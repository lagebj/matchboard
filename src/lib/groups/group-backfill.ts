import { db } from "@/lib/db";
import { generateSlug } from "./group-slug";

const DEFAULT_GROUP_NAME = "Default Group";

async function ensureUniqueSlug(baseSlug: string, organisationId: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await db.footballGroup.findFirst({
      where: {
        organisationId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

export type BackfillResult = {
  groupsCreated: number;
  teamsAssigned: number;
  groupAccessCreated: number;
  groupPlayersCreated: number;
};

export async function backfillOrganisation(organisationId: string): Promise<BackfillResult> {
  const result: BackfillResult = {
    groupsCreated: 0,
    teamsAssigned: 0,
    groupAccessCreated: 0,
    groupPlayersCreated: 0,
  };

  const existingGroups = await db.footballGroup.findMany({
    where: { organisationId, isActive: true },
    select: { id: true, slug: true },
  });

  let defaultGroupId: string;

  if (existingGroups.length > 0) {
    const existingDefault = existingGroups.find((g) => g.slug === generateSlug(DEFAULT_GROUP_NAME));
    defaultGroupId = existingDefault ? existingDefault.id : existingGroups[0].id;
  } else {
    const slug = await ensureUniqueSlug(generateSlug(DEFAULT_GROUP_NAME), organisationId);
    const group = await db.footballGroup.create({
      data: {
        name: DEFAULT_GROUP_NAME,
        slug,
        type: "AGE_GROUP",
        organisationId,
      },
    });
    defaultGroupId = group.id;
    result.groupsCreated++;
  }

  const teamsResult = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Team" WHERE "organisationId" = ${organisationId} AND "footballGroupId" IS NULL
  `;

  if (teamsResult.length > 0) {
    const teamIds = teamsResult.map((t) => t.id);
    const updateResult = await db.team.updateMany({
      where: {
        id: { in: teamIds },
      },
      data: { footballGroupId: defaultGroupId },
    });
    result.teamsAssigned += updateResult.count;
  }

  const memberships = await db.organisationMembership.findMany({
    where: {
      organisationId,
      role: { in: ["COACH", "VIEWER"] },
    },
    select: { id: true },
  });

  for (const membership of memberships) {
    const existing = await db.groupAccess.findFirst({
      where: {
        membershipId: membership.id,
        group: { organisationId },
      },
      select: { id: true },
    });

    if (!existing) {
      await db.groupAccess.create({
        data: {
          membershipId: membership.id,
          footballGroupId: defaultGroupId,
          role: "GROUP_COACH",
        },
      });
      result.groupAccessCreated++;
    }
  }

  const activePlayers = await db.player.findMany({
    where: {
      organisationId,
      active: true,
      coreTeamId: { not: null },
    },
    select: { id: true, coreTeamId: true },
  });

  for (const player of activePlayers) {
    if (!player.coreTeamId) continue;

    const team = await db.team.findFirst({
      where: { id: player.coreTeamId, organisationId },
      select: { footballGroupId: true },
    });

    if (!team) continue;

    const existingMembership = await db.footballGroupPlayer.findFirst({
      where: {
        playerId: player.id,
        membershipType: "PRIMARY",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!existingMembership) {
      await db.footballGroupPlayer.create({
        data: {
          footballGroupId: team.footballGroupId,
          playerId: player.id,
          organisationId,
          membershipType: "PRIMARY",
          status: "ACTIVE",
          coreTeamId: player.coreTeamId,
        },
      });
      result.groupPlayersCreated++;
    }
  }

  return result;
}

export async function backfillAllOrganisations(): Promise<BackfillResult> {
  const organisations = await db.organisation.findMany({
    select: { id: true, name: true, slug: true },
  });

  const total: BackfillResult = {
    groupsCreated: 0,
    teamsAssigned: 0,
    groupAccessCreated: 0,
    groupPlayersCreated: 0,
  };

  for (const org of organisations) {
    const result = await backfillOrganisation(org.id);
    total.groupsCreated += result.groupsCreated;
    total.teamsAssigned += result.teamsAssigned;
    total.groupAccessCreated += result.groupAccessCreated;
    total.groupPlayersCreated += result.groupPlayersCreated;
  }

  return total;
}