import { db } from "@/lib/db";
import { requireCoachAccess, AuthorizationError } from "@/lib/auth";
import { logAccessDenied } from "@/lib/security/audit-log";
import { canAccessAllTeams, canInviteRole, canManageRole, canCreateTeam, canManageMemberships, canDeleteOrganisation, canTransferOwnership } from "@/lib/organisations/organisation-domain";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import type { OrganisationRole } from "@/generated/prisma/client";
import { getEffectiveGroupAccess } from "@/lib/auth/group-context";

class OrganisationNotFoundError extends AuthorizationError {
  constructor(message: string) {
    super(message);
    this.name = "OrganisationNotFoundError";
  }
}

class OrganisationMembershipError extends AuthorizationError {
  constructor(message: string) {
    super(message);
    this.name = "OrganisationMembershipError";
  }
}

class OrganisationSuspendedError extends AuthorizationError {
  constructor(message: string) {
    super(message);
    this.name = "OrganisationSuspendedError";
  }
}

type OrgRow = { id: string; name: string; slug: string };
type MembershipRow = {
  id: string;
  userId: string;
  organisationId: string;
  role: OrganisationRole;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function resolveOrganisationAccess(
  slug: string,
): Promise<OrganisationAccessContext> {
  const coach = await requireCoachAccess();
  const coachId: string = coach.id ?? "";
  const coachEmail: string = coach.email ?? "unknown";

  const org = await db.organisation.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, suspendedAt: true },
  }) as OrgRow & { suspendedAt: Date | null } | null;

  if (!org) {
    logAccessDenied(coachEmail, `organisation:${slug}`, "not_found");
    throw new OrganisationNotFoundError("Organisation not found.");
  }

  if (org.suspendedAt) {
    logAccessDenied(coachEmail, `organisation:${org.slug}`, "suspended");
    throw new OrganisationSuspendedError("This organisation is suspended.");
  }

  const membership = await db.organisationMembership.findUnique({
    where: { userId_organisationId: { userId: coachId, organisationId: org.id } },
  }) as MembershipRow | null;

  if (!membership) {
    logAccessDenied(coachEmail, `organisation:${org.slug}`, "no_membership");
    throw new OrganisationMembershipError("You are not a member of this organisation.");
  }

  if (membership.role === "SUPPORT" && membership.expiresAt && membership.expiresAt < new Date()) {
    logAccessDenied(coachEmail, `organisation:${org.slug}`, "support_expired");
    throw new OrganisationMembershipError("SUPPORT access has expired.");
  }

  const role: OrganisationRole = membership.role;

  const groupAccesses = await getEffectiveGroupAccess(membership.id, org.id, role);
  const accessibleGroupIds: string[] = groupAccesses.map((ga) => ga.footballGroupId);

  return {
    userId: coachId,
    userEmail: coachEmail,
    organisationId: org.id,
    organisationSlug: org.slug,
    organisationName: org.name,
    role,
    membershipId: membership.id,
    accessibleGroupIds,
    groupAccesses,
    canAccessAllTeams: canAccessAllTeams(role),
    canCreateTeam: canCreateTeam(role),
    canManageMemberships: canManageMemberships(role),
    canInviteRole: (targetRole: OrganisationRole) => canInviteRole(role, targetRole),
    canManageRole: (targetRole: OrganisationRole) => canManageRole(role, targetRole),
    canDeleteOrganisation: canDeleteOrganisation(role),
    canTransferOwnership: canTransferOwnership(role),
  };
}

export async function resolveOrganisationAdminOrOwner(slug: string): Promise<OrganisationAccessContext> {
  const ctx = await resolveOrganisationAccess(slug);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    logAccessDenied(ctx.userEmail, `organisation:${ctx.organisationSlug}`, `role_${ctx.role}_requires_admin_or_owner`);
    throw new OrganisationMembershipError("Owner or Admin role required.");
  }
  return ctx;
}

export async function resolveOrganisationOwner(slug: string): Promise<OrganisationAccessContext> {
  const ctx = await resolveOrganisationAccess(slug);
  if (ctx.role !== "OWNER") {
    logAccessDenied(ctx.userEmail, `organisation:${ctx.organisationSlug}`, `role_${ctx.role}_requires_owner`);
    throw new OrganisationMembershipError("Owner role required.");
  }
  return ctx;
}