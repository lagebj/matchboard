import { db } from "@/lib/db";
import type { GroupMovementPathRole, GroupMovementPathScope } from "@/generated/prisma/client";

export type CreateGroupMovementPathInput = {
  organisationId: string;
  fromGroupId: string;
  toGroupId: string;
  role: GroupMovementPathRole;
  scope?: GroupMovementPathScope;
};

export type UpdateGroupMovementPathInput = {
  role?: GroupMovementPathRole;
  scope?: GroupMovementPathScope;
  isActive?: boolean;
};

export type GroupMovementPathWithGroups = {
  id: string;
  organisationId: string;
  fromGroupId: string;
  toGroupId: string;
  role: GroupMovementPathRole;
  scope: GroupMovementPathScope;
  isActive: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fromGroup: { id: string; name: string; slug: string };
  toGroup: { id: string; name: string; slug: string };
};

export const MOVEMENT_PATH_ROLE_LABELS: Record<GroupMovementPathRole, string> = {
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  BACKFILL: "Squad repair",
};

export const MOVEMENT_PATH_SCOPE_LABELS: Record<GroupMovementPathScope, string> = {
  MATCH: "Match",
  EVENT: "Event",
};

export async function createGroupMovementPath(
  input: CreateGroupMovementPathInput,
): Promise<{ success: boolean; pathId?: string; error?: string }> {
  if (input.fromGroupId === input.toGroupId) {
    return { success: false, error: "Source and target groups must be different." };
  }

  const fromGroup = await db.footballGroup.findFirst({
    where: { id: input.fromGroupId, organisationId: input.organisationId, isActive: true },
    select: { id: true },
  });
  if (!fromGroup) {
    return { success: false, error: "Source group not found or inactive." };
  }

  const toGroup = await db.footballGroup.findFirst({
    where: { id: input.toGroupId, organisationId: input.organisationId, isActive: true },
    select: { id: true },
  });
  if (!toGroup) {
    return { success: false, error: "Target group not found or inactive." };
  }

  const existing = await db.groupMovementPath.findFirst({
    where: {
      organisationId: input.organisationId,
      fromGroupId: input.fromGroupId,
      toGroupId: input.toGroupId,
      role: input.role,
      scope: input.scope ?? "MATCH",
      isActive: true,
    },
  });
  if (existing) {
    return { success: false, error: "An active movement path with this source, target, role, and scope already exists." };
  }

  const deactivated = await db.groupMovementPath.findFirst({
    where: {
      organisationId: input.organisationId,
      fromGroupId: input.fromGroupId,
      toGroupId: input.toGroupId,
      role: input.role,
      scope: input.scope ?? "MATCH",
      isActive: false,
    },
  });

  if (deactivated) {
    const reactivated = await db.groupMovementPath.update({
      where: { id: deactivated.id },
      data: { isActive: true, deactivatedAt: null },
    });
    return { success: true, pathId: reactivated.id };
  }

  const path = await db.groupMovementPath.create({
    data: {
      organisationId: input.organisationId,
      fromGroupId: input.fromGroupId,
      toGroupId: input.toGroupId,
      role: input.role,
      scope: input.scope ?? "MATCH",
      isActive: true,
    },
  });

  return { success: true, pathId: path.id };
}

export async function updateGroupMovementPath(
  pathId: string,
  input: UpdateGroupMovementPathInput,
  organisationId: string,
): Promise<{ success: boolean; error?: string }> {
  const existing = await db.groupMovementPath.findFirst({
    where: { id: pathId, organisationId },
  });
  if (!existing) {
    return { success: false, error: "Movement path not found." };
  }

  await db.groupMovementPath.update({
    where: { id: pathId },
    data: {
      ...(input.role !== undefined && { role: input.role }),
      ...(input.scope !== undefined && { scope: input.scope }),
      ...(input.isActive !== undefined && {
        isActive: input.isActive,
        deactivatedAt: input.isActive ? null : new Date(),
      }),
    },
  });

  return { success: true };
}

export async function deactivateGroupMovementPath(
  pathId: string,
  organisationId: string,
): Promise<{ success: boolean; error?: string }> {
  const existing = await db.groupMovementPath.findFirst({
    where: { id: pathId, organisationId, isActive: true },
  });
  if (!existing) {
    return { success: false, error: "Active movement path not found." };
  }

  await db.groupMovementPath.update({
    where: { id: pathId },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  return { success: true };
}

export async function reactivateGroupMovementPath(
  pathId: string,
  organisationId: string,
): Promise<{ success: boolean; error?: string }> {
  const existing = await db.groupMovementPath.findFirst({
    where: { id: pathId, organisationId, isActive: false },
  });
  if (!existing) {
    return { success: false, error: "Inactive movement path not found." };
  }

  await db.groupMovementPath.update({
    where: { id: pathId },
    data: { isActive: true, deactivatedAt: null },
  });

  return { success: true };
}

export async function listGroupMovementPaths(
  organisationId: string,
  options?: { groupId?: string; activeOnly?: boolean; scope?: GroupMovementPathScope },
): Promise<GroupMovementPathWithGroups[]> {
  const where: Record<string, unknown> = {
    organisationId,
    ...(options?.activeOnly !== false && { isActive: true }),
    ...(options?.groupId && {
      OR: [
        { fromGroupId: options.groupId },
        { toGroupId: options.groupId },
      ],
    }),
    ...(options?.scope && { scope: options.scope }),
  };

  const paths = await db.groupMovementPath.findMany({
    where,
    include: {
      fromGroup: { select: { id: true, name: true, slug: true } },
      toGroup: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ fromGroup: { name: "asc" } }, { toGroup: { name: "asc" } }],
  });

  return paths as GroupMovementPathWithGroups[];
}

export async function getGroupMovementPath(
  pathId: string,
  organisationId: string,
): Promise<GroupMovementPathWithGroups | null> {
  const path = await db.groupMovementPath.findFirst({
    where: { id: pathId, organisationId },
    include: {
      fromGroup: { select: { id: true, name: true, slug: true } },
      toGroup: { select: { id: true, name: true, slug: true } },
    },
  });

  return path as GroupMovementPathWithGroups | null;
}

export async function getActiveGroupPathsForGroup(
  groupId: string,
  organisationId: string,
  scope?: GroupMovementPathScope,
): Promise<GroupMovementPathWithGroups[]> {
  return listGroupMovementPaths(organisationId, {
    groupId,
    activeOnly: true,
    scope,
  });
}