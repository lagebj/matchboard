import type { GroupAccessRole, OrganisationRole } from "@/generated/prisma/client";
import { AuthorizationError } from "@/lib/auth";
import { db } from "@/lib/db";

const GROUP_MUTATION_ROLES: GroupAccessRole[] = ["GROUP_COACH"];
const GROUP_VIEWER_ROLES: GroupAccessRole[] = ["GROUP_COACH", "GROUP_VIEWER"];

const ORG_IMPLICIT_ACCESS_ROLES: OrganisationRole[] = ["OWNER", "ADMIN"];

export type GroupAccessEntry = {
  footballGroupId: string;
  role: GroupAccessRole;
};

export type GroupActorContext = {
  userId: string;
  email: string;
  membershipId: string;
  organisationId: string;
  organisationSlug: string;
  orgRole: OrganisationRole;
  footballGroupId: string;
  groupRole: GroupAccessRole;
  accessibleGroupIds: string[];
  groupAccesses: GroupAccessEntry[];
};

export async function resolveGroupContext(
  organisationId: string,
  groupSlugOrId: string,
  membershipId: string,
  orgRole: OrganisationRole,
): Promise<GroupActorContext> {
  const group = await db.footballGroup.findFirst({
    where: {
      organisationId,
      isActive: true,
      OR: [
        { id: groupSlugOrId },
        { slug: groupSlugOrId },
      ],
    },
    select: { id: true },
  });

  if (!group) {
    throw new AuthorizationError(
      `Group "${groupSlugOrId}" not found or not accessible in this organisation.`,
    );
  }

  if (ORG_IMPLICIT_ACCESS_ROLES.includes(orgRole)) {
    const allGroups = await db.footballGroup.findMany({
      where: { organisationId, isActive: true },
      select: { id: true },
    });
    return {
      userId: "",
      email: "",
      membershipId,
      organisationId,
      organisationSlug: "",
      orgRole,
      footballGroupId: group.id,
      groupRole: "GROUP_COACH",
      accessibleGroupIds: allGroups.map((g) => g.id),
      groupAccesses: allGroups.map((g) => ({
        footballGroupId: g.id,
        role: "GROUP_COACH" as GroupAccessRole,
      })),
    };
  }

  const groupAccesses = await db.groupAccess.findMany({
    where: { membershipId },
    select: { footballGroupId: true, role: true },
  });

  const accessForGroup = groupAccesses.find(
    (ga) => ga.footballGroupId === group.id,
  );

  if (!accessForGroup) {
    throw new AuthorizationError(
      "You do not have access to this group.",
    );
  }

  return {
    userId: "",
    email: "",
    membershipId,
    organisationId,
    organisationSlug: "",
    orgRole,
    footballGroupId: group.id,
    groupRole: accessForGroup.role,
    accessibleGroupIds: groupAccesses.map((ga) => ga.footballGroupId),
    groupAccesses: groupAccesses.map((ga) => ({
      footballGroupId: ga.footballGroupId,
      role: ga.role,
    })),
  };
}

export function requireGroupAccess(
  ctx: GroupActorContext,
  groupId: string,
): void {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(ctx.orgRole)) return;
  if (ctx.accessibleGroupIds.includes(groupId)) return;
  throw new AuthorizationError("You do not have access to this group.");
}

export function requireGroupMutationRole(
  ctx: GroupActorContext,
): void {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(ctx.orgRole)) return;
  if (!GROUP_MUTATION_ROLES.includes(ctx.groupRole)) {
    throw new AuthorizationError(
      `Role ${ctx.groupRole} cannot perform this action. Required: GROUP_COACH or OWNER/ADMIN.`,
    );
  }
}

export function hasGroupAccess(
  ctx: GroupActorContext,
  groupId: string,
): boolean {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(ctx.orgRole)) return true;
  return ctx.accessibleGroupIds.includes(groupId);
}

export function canMutateGroup(ctx: GroupActorContext): boolean {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(ctx.orgRole)) return true;
  return GROUP_MUTATION_ROLES.includes(ctx.groupRole);
}

export function canViewGroup(ctx: GroupActorContext): boolean {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(ctx.orgRole)) return true;
  return GROUP_VIEWER_ROLES.includes(ctx.groupRole);
}

// Callers (requireActorContext()'s two branches) must have already established tenant
// AsyncLocalStorage context for `organisationId` via setTenantOrganisationId() before calling
// this — do not wrap these queries in their own withTenantContext()/runWithTenantOrganisationId()
// scope here. A prior version did exactly that (one scoped run() per branch), which combined with
// the caller's later setTenantOrganisationId() call to reproduce a genuine Node.js
// AsyncLocalStorage defect: enterWith() called in a continuation that has already passed through
// one or more earlier run() exits silently fails to persist under concurrent request load (proven
// empirically — not a hypothesis — 100% reproducible with >=2 sequential run() calls followed by
// enterWith() under Promise.all concurrency, 0% with either alone). See ARR-0029 "Bug 2b".
export async function getEffectiveGroupAccess(
  membershipId: string,
  organisationId: string,
  orgRole: OrganisationRole,
): Promise<GroupAccessEntry[]> {
  if (ORG_IMPLICIT_ACCESS_ROLES.includes(orgRole)) {
    const allGroups = await db.footballGroup.findMany({
      where: { organisationId, isActive: true },
      select: { id: true },
    });
    return allGroups.map((g) => ({
      footballGroupId: g.id,
      role: "GROUP_COACH" as GroupAccessRole,
    }));
  }

  if (orgRole === "SUPPORT") {
    const allGroups = await db.footballGroup.findMany({
      where: { organisationId, isActive: true },
      select: { id: true },
    });
    return allGroups.map((g) => ({
      footballGroupId: g.id,
      role: "GROUP_VIEWER" as GroupAccessRole,
    }));
  }

  const groupAccesses = await db.groupAccess.findMany({
    where: { membershipId },
    select: { footballGroupId: true, role: true },
  });

  return groupAccesses.map((ga) => ({
    footballGroupId: ga.footballGroupId,
    role: ga.role,
  }));
}