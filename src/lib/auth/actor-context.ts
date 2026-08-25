import type { OrganisationRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { requireCoachAccess, AuthorizationError } from "@/lib/auth";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { resolveOrgFilterForUser, MultipleMembershipsError, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getOrgSlugFromCookie } from "@/lib/auth/org-slug-cookie";
import { getEffectiveGroupAccess, type GroupAccessEntry } from "@/lib/auth/group-context";
import { setTenantOrganisationId, setTenantUserId } from "@/lib/tenancy/tenant-async-storage";
import { setCorrelationId } from "@/lib/logging/correlation-context";
import { db } from "@/lib/db";

export type ActorContext = {
  userId: string;
  email: string;
  membershipId: string;
  organisationId: string;
  organisationSlug: string;
  role: OrganisationRole;
  accessibleGroupIds: string[];
  groupAccesses: GroupAccessEntry[];
  orgFilter: OrgFilterMode;
};

export async function requireActorContext(
  organisationSlug?: string,
): Promise<ActorContext> {
  const coach = await requireCoachAccess();
  const userId = coach.id ?? "";
  const email = coach.email ?? "";

  setCorrelationId(crypto.randomUUID());
  setTenantUserId(userId);

  const resolvedSlug = organisationSlug ?? await getOrgSlugFromCookie();

  if (resolvedSlug) {
    const access = await resolveOrganisationAccess(resolvedSlug);
    const slugOrgFilter: OrgFilterMode = {
      type: "org",
      filter: { organisationId: access.organisationId },
      filterNullable: { organisationId: access.organisationId },
      organisationId: access.organisationId,
    };
    setTenantOrganisationId(access.organisationId);
    return {
      userId: access.userId,
      email,
      membershipId: access.membershipId,
      organisationId: access.organisationId,
      organisationSlug: access.organisationSlug,
      role: access.role,
      accessibleGroupIds: access.accessibleGroupIds,
      groupAccesses: access.groupAccesses,
      orgFilter: slugOrgFilter,
    };
  }

  const orgFilter = await resolveOrgFilterForUser(userId);
  if (orgFilter.type !== "org") {
    throw new AuthorizationError("No active organisation membership");
  }

  // Set context once, here, before the membership check — correctly scopes every query below
  // (including inside getEffectiveGroupAccess()) for the *rest of this function's own
  // execution*. It does NOT, and structurally cannot, persist for this function's caller once
  // requireActorContext() returns — see ARR-0029 "Bug 3" and the tenantRLS extension's
  // explicit-where-organisationId fallback in src/lib/db.ts, which is what actually protects
  // callers.
  setTenantOrganisationId(orgFilter.organisationId);

  const membership = await db.organisationMembership.findFirst({
    where: { userId, organisationId: orgFilter.organisationId },
    select: { id: true, role: true, organisationId: true },
  });

  if (!membership) {
    throw new AuthorizationError("No active organisation membership");
  }

  const organisation = await db.organisation.findUnique({
    where: { id: membership.organisationId },
    select: { slug: true },
  });

  if (!organisation) {
    throw new AuthorizationError("Organisation not found");
  }

  const groupAccesses = await getEffectiveGroupAccess(
    membership.id,
    membership.organisationId,
    membership.role,
  );

  return {
    userId,
    email,
    membershipId: membership.id,
    organisationId: membership.organisationId,
    organisationSlug: organisation.slug,
    role: membership.role,
    accessibleGroupIds: groupAccesses.map((ga) => ga.footballGroupId),
    groupAccesses,
    orgFilter,
  };
}

export { MultipleMembershipsError };

/**
 * Page/server-action variant of requireActorContext(): identical behavior, except an ambiguous
 * or missing organisation context (MultipleMembershipsError, or the "No active organisation
 * membership" case for a zero-membership user) redirects to /organisations instead of throwing
 * uncaught to the generic error boundary. Only the two canonical entry points (`(app)/page.tsx`,
 * `(app)/today/page.tsx` via resolveOrgSlugForLayout()) previously handled this gracefully;
 * every other protected page/action crashed. Never use this from an API route handler — those
 * must return a JSON error response, not trigger a browser redirect (see ADR-0082).
 */
export async function requirePageActorContext(
  organisationSlug?: string,
): Promise<ActorContext> {
  try {
    return await requireActorContext(organisationSlug);
  } catch (error) {
    if (error instanceof MultipleMembershipsError) {
      redirect("/organisations");
    }
    if (
      error instanceof AuthorizationError &&
      error.message === "No active organisation membership"
    ) {
      redirect("/organisations");
    }
    throw error;
  }
}

const MUTATION_ROLES: OrganisationRole[] = ["OWNER", "ADMIN", "COACH"];
const ADMIN_ROLES: OrganisationRole[] = ["OWNER", "ADMIN"];
const OWNER_ROLES: OrganisationRole[] = ["OWNER"];

export function requireMutationRole(ctx: ActorContext): void {
  if (!MUTATION_ROLES.includes(ctx.role)) {
    throw new AuthorizationError(
      `Role ${ctx.role} cannot perform this action. Required: ${MUTATION_ROLES.join(" or ")}.`,
    );
  }
}

export function requireAdminRole(ctx: ActorContext): void {
  if (!ADMIN_ROLES.includes(ctx.role)) {
    throw new AuthorizationError(
      `Role ${ctx.role} cannot perform this action. Required: ${ADMIN_ROLES.join(" or ")}.`,
    );
  }
}

export function requireOwnerRole(ctx: ActorContext): void {
  if (!OWNER_ROLES.includes(ctx.role)) {
    throw new AuthorizationError(
      `Role ${ctx.role} cannot perform this action. Required: ${OWNER_ROLES.join(" or ")}.`,
    );
  }
}

export function canMutate(ctx: ActorContext): boolean {
  return MUTATION_ROLES.includes(ctx.role);
}

export function canAdmin(ctx: ActorContext): boolean {
  return ADMIN_ROLES.includes(ctx.role);
}

export function canOwn(ctx: ActorContext): boolean {
  return OWNER_ROLES.includes(ctx.role);
}

export async function hasTeamGroupAccess(ctx: ActorContext, teamId: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(ctx.role)) return true;

  const team = await db.team.findFirst({
    where: { id: teamId, ...ctx.orgFilter.filter },
    select: { footballGroupId: true },
  });

  if (!team) return false;
  return ctx.accessibleGroupIds.includes(team.footballGroupId);
}


export async function requirePlayerGroupAccess(
  ctx: ActorContext,
  playerId: string,
): Promise<string | null> {
  if (ADMIN_ROLES.includes(ctx.role)) return null;

  const player = await db.player.findFirst({
    where: {
      id: playerId,
      removedAt: null,
      organisationId: ctx.organisationId,
    },
    select: { coreTeamId: true },
  });

  if (!player) {
    throw new AuthorizationError("Player not found or access denied.");
  }

  if (!player.coreTeamId) return null;

  const team = await db.team.findFirst({
    where: { id: player.coreTeamId },
    select: { footballGroupId: true },
  });

  if (!team) {
    throw new AuthorizationError("Player not found or access denied.");
  }

  if (!ctx.accessibleGroupIds.includes(team.footballGroupId)) {
    throw new AuthorizationError("You do not have access to this player's team.");
  }

  return player.coreTeamId;
}

export async function requireMatchGroupAccess(
  ctx: ActorContext,
  matchId: string,
): Promise<string | null> {
  if (ADMIN_ROLES.includes(ctx.role)) return null;

  const match = await db.match.findFirst({
    where: {
      id: matchId,
      ...ctx.orgFilter.filter,
    },
    select: { teamId: true },
  });

  if (!match) {
    throw new AuthorizationError("Match not found or access denied.");
  }

  if (!match.teamId) return null;

  const team = await db.team.findFirst({
    where: { id: match.teamId },
    select: { footballGroupId: true },
  });

  if (!team) {
    throw new AuthorizationError("Match not found or access denied.");
  }

  if (!ctx.accessibleGroupIds.includes(team.footballGroupId)) {
    throw new AuthorizationError("You do not have access to this match's team.");
  }

  return match.teamId;
}

/**
 * Group-role-aware variant of `requireMatchGroupAccess()`. That function only checks whether
 * the caller has *any* `GroupAccess` row for the match's group (`GROUP_COACH` or
 * `GROUP_VIEWER` both pass) — it never distinguishes the two roles, because until the
 * "Follow live" viewer capability existed, every group-scoped operation in this codebase was
 * a mutation, and the org-level `requireMutationRole()` check was assumed to be the only role
 * gate needed. That assumption was wrong: a membership with org role COACH (a mutation role)
 * but only `GROUP_VIEWER` access to a specific group could still start/record/end live match
 * sessions for that group, because `requireMatchGroupAccess()` never checked the group-level
 * role. This closes that gap — call it alongside `requireMatchGroupAccess()`, not instead of
 * it, for any action that mutates a live match session.
 */
export async function requireMatchGroupMutationRole(
  ctx: ActorContext,
  matchId: string,
): Promise<void> {
  if (ADMIN_ROLES.includes(ctx.role)) return;

  const match = await db.match.findFirst({
    where: {
      id: matchId,
      ...ctx.orgFilter.filter,
    },
    select: { teamId: true },
  });

  if (!match) {
    throw new AuthorizationError("Match not found or access denied.");
  }

  if (!match.teamId) return;

  const team = await db.team.findFirst({
    where: { id: match.teamId },
    select: { footballGroupId: true },
  });

  if (!team) {
    throw new AuthorizationError("Match not found or access denied.");
  }

  const access = ctx.groupAccesses.find((ga) => ga.footballGroupId === team.footballGroupId);
  if (!access || access.role !== "GROUP_COACH") {
    throw new AuthorizationError(
      "You have view-only access to this match's group and cannot report on it.",
    );
  }
}

export function hasGroupAccess(ctx: ActorContext, groupId: string): boolean {
  if (ADMIN_ROLES.includes(ctx.role)) return true;
  return ctx.accessibleGroupIds.includes(groupId);
}

export function requireGroupAccessFromContext(ctx: ActorContext, groupId: string): void {
  if (ADMIN_ROLES.includes(ctx.role)) return;
  if (ctx.accessibleGroupIds.includes(groupId)) return;
  throw new AuthorizationError("You do not have access to this group.");
}

export async function requireTeamGroupAccess(
  ctx: ActorContext,
  teamId: string,
): Promise<string | null> {
  if (ADMIN_ROLES.includes(ctx.role)) return null;

  const team = await db.team.findFirst({
    where: {
      id: teamId,
      ...ctx.orgFilter.filter,
    },
    select: { id: true, footballGroupId: true },
  });

  if (!team) {
    throw new AuthorizationError("Team not found or access denied.");
  }

  if (!ctx.accessibleGroupIds.includes(team.footballGroupId)) {
    throw new AuthorizationError("You do not have access to this team.");
  }

  return team.footballGroupId;
}

export function teamFilterFromContext(ctx: ActorContext): { footballGroupId: { in: string[] } } | null {
  if (ADMIN_ROLES.includes(ctx.role)) return null;
  if (ctx.accessibleGroupIds.length === 0) return { footballGroupId: { in: [] } };
  return { footballGroupId: { in: ctx.accessibleGroupIds } };
}

export function groupFilterFromContext(ctx: ActorContext): { footballGroupId: { in: string[] } } | null {
  if (ADMIN_ROLES.includes(ctx.role)) return null;
  if (ctx.accessibleGroupIds.length === 0) return { footballGroupId: { in: [] } };
  return { footballGroupId: { in: ctx.accessibleGroupIds } };
}

export function teamOrGroupFilter(ctx: ActorContext): { footballGroupId: { in: string[] } } | null {
  if (ADMIN_ROLES.includes(ctx.role)) return null;
  if (ctx.accessibleGroupIds.length === 0) return { footballGroupId: { in: [] } };
  return { footballGroupId: { in: ctx.accessibleGroupIds } };
}