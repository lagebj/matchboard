import { db } from "@/lib/db";
import type { GroupMovementPathRole, GroupMovementPathScope } from "@/generated/prisma/client";

export type GroupPlayerPoolEntry = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  active: boolean;
  coreTeamId: string | null;
  coreTeam: { id: string; name: string } | null;
  membershipType: string;
  supportSuitability: string | null;
  developmentReadiness: string | null;
  nonRotatable: boolean;
  footballGroupId: string;
};

export type GroupMovementPathInfo = {
  id: string;
  fromGroupId: string;
  toGroupId: string;
  fromGroupName: string;
  toGroupName: string;
  role: GroupMovementPathRole;
  scope: GroupMovementPathScope;
  isActive: boolean;
};

export async function getGroupPlayerPool(
  groupId: string,
  organisationId: string,
  options?: { membershipType?: string },
): Promise<GroupPlayerPoolEntry[]> {
  const where: Record<string, unknown> = {
    footballGroupId: groupId,
    organisationId,
    status: "ACTIVE",
    ...(options?.membershipType && { membershipType: options.membershipType }),
  };

  const players = await db.footballGroupPlayer.findMany({
    where,
    select: {
      playerId: true,
      membershipType: true,
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          active: true,
          coreTeamId: true,
          coreTeam: { select: { id: true, name: true } },
          supportSuitability: true,
          developmentReadiness: true,
          nonRotatable: true,
        },
      },
    },
    orderBy: { player: { firstName: "asc" } },
  });

  return players
    .filter((p) => p.player.active)
    .map((p) => ({
      playerId: p.player.id,
      firstName: p.player.firstName,
      lastName: p.player.lastName,
      active: p.player.active,
      coreTeamId: p.player.coreTeamId,
      coreTeam: p.player.coreTeam,
      membershipType: p.membershipType,
      supportSuitability: p.player.supportSuitability,
      developmentReadiness: p.player.developmentReadiness,
      nonRotatable: p.player.nonRotatable,
      footballGroupId: groupId,
    }));
}

export async function getGroupMovementPaths(
  groupId: string,
  organisationId: string,
  options?: { activeOnly?: boolean; scope?: GroupMovementPathScope },
): Promise<GroupMovementPathInfo[]> {
  const where: Record<string, unknown> = {
    organisationId,
    ...(options?.activeOnly !== false && { isActive: true }),
    OR: [
      { fromGroupId: groupId },
      { toGroupId: groupId },
    ],
    ...(options?.scope && { scope: options.scope }),
  };

  const paths = await db.groupMovementPath.findMany({
    where,
    include: {
      fromGroup: { select: { id: true, name: true } },
      toGroup: { select: { id: true, name: true } },
    },
    orderBy: [{ fromGroup: { name: "asc" } }, { toGroup: { name: "asc" } }],
  });

  return paths.map((p) => ({
    id: p.id,
    fromGroupId: p.fromGroupId,
    toGroupId: p.toGroupId,
    fromGroupName: p.fromGroup.name,
    toGroupName: p.toGroup.name,
    role: p.role,
    scope: p.scope,
    isActive: p.isActive,
  }));
}

export function canMoveBetweenGroups(
  paths: GroupMovementPathInfo[],
  fromGroupId: string,
  toGroupId: string,
  role: string,
  scope?: string,
): boolean {
  return paths.some(
    (p) =>
      p.fromGroupId === fromGroupId &&
      p.toGroupId === toGroupId &&
      p.role === role &&
      p.isActive &&
      (scope ? p.scope === scope : true),
  );
}

export function getGroupIdsWithMovementAccess(
  paths: GroupMovementPathInfo[],
  sourceGroupId: string,
  role?: string,
): string[] {
  return [
    ...new Set(
      paths
        .filter(
          (p) =>
            p.fromGroupId === sourceGroupId &&
            p.isActive &&
            (role ? p.role === role : true),
        )
        .map((p) => p.toGroupId),
    ),
  ];
}

export function getPlayerEligibleTargetGroups(
  playerCoreTeamGroupId: string,
  allGroupPaths: GroupMovementPathInfo[],
  role?: string,
): string[] {
  const groups = [playerCoreTeamGroupId];

  const movementTargets = allGroupPaths
    .filter(
      (p) =>
        p.fromGroupId === playerCoreTeamGroupId &&
        p.isActive &&
        (role ? p.role === role : true),
    )
    .map((p) => p.toGroupId);

  return [...new Set([...groups, ...movementTargets])];
}