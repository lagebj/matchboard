import type { OrganisationRole } from "@/generated/prisma/client";
import { requireCoachAccess, AuthorizationError } from "@/lib/auth";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { resolveOrgFilterForUser, type OrgFilterMode, type MultipleMembershipsError } from "@/lib/tenancy/resolve-org-filter";

export type ActorContext = {
  userId: string;
  email: string;
  membershipId: string;
  organisationId: string;
  organisationSlug: string;
  role: OrganisationRole;
  delegatedTeamIds: string[] | null;
  orgFilter: OrgFilterMode;
};

export async function requireActorContext(
  organisationSlug?: string,
): Promise<ActorContext> {
  const coach = await requireCoachAccess();
  const userId = coach.id ?? "";
  const email = coach.email ?? "";

  if (organisationSlug) {
    const access = await resolveOrganisationAccess(organisationSlug);
    const slugOrgFilter: OrgFilterMode = {
      type: "org",
      filter: { organisationId: access.organisationId },
      filterNullable: { organisationId: access.organisationId },
      organisationId: access.organisationId,
    };
    return {
      userId: access.userId,
      email,
      membershipId: access.membershipId,
      organisationId: access.organisationId,
      organisationSlug: access.organisationSlug,
      role: access.role,
      delegatedTeamIds: access.permittedTeamIds ?? null,
      orgFilter: slugOrgFilter,
    };
  }

  const orgFilter = await resolveOrgFilterForUser(userId);
  if (orgFilter.type !== "org") {
    throw new AuthorizationError("No active organisation membership");
  }

  const db = (await import("@/lib/db")).db;
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

  const teamAccesses = await db.teamAccess.findMany({
    where: { membershipId: membership.id },
    select: { teamId: true },
  });

  return {
    userId,
    email,
    membershipId: membership.id,
    organisationId: membership.organisationId,
    organisationSlug: organisation.slug,
    role: membership.role,
    delegatedTeamIds: teamAccesses.map((ta) => ta.teamId),
    orgFilter,
  };
}

export { MultipleMembershipsError };

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

export function hasTeamAccess(ctx: ActorContext, teamId: string): boolean {
  if (ADMIN_ROLES.includes(ctx.role)) return true;
  if (ctx.delegatedTeamIds === null) return true;
  return ctx.delegatedTeamIds.includes(teamId);
}

export function requireTeamAccess(ctx: ActorContext, teamId: string): void {
  if (ADMIN_ROLES.includes(ctx.role)) return;
  if (ctx.delegatedTeamIds === null) return;
  if (!ctx.delegatedTeamIds.includes(teamId)) {
    throw new AuthorizationError("You do not have access to this team.");
  }
}

export async function requirePlayerTeamAccess(
  ctx: ActorContext,
  playerId: string,
): Promise<string | null> {
  if (ADMIN_ROLES.includes(ctx.role)) return null;
  if (ctx.delegatedTeamIds === null) return null;

  const { db } = await import("@/lib/db");
  const player = await db.player.findFirst({
    where: {
      id: playerId,
      removedAt: null,
      ...(ctx.orgFilter.type === "org"
        ? { organisationId: ctx.orgFilter.organisationId }
        : {}),
    },
    select: { coreTeamId: true },
  });

  if (!player) {
    throw new AuthorizationError("Player not found or access denied.");
  }

  if (player.coreTeamId && !ctx.delegatedTeamIds.includes(player.coreTeamId)) {
    throw new AuthorizationError("You do not have access to this player's team.");
  }

  return player.coreTeamId;
}