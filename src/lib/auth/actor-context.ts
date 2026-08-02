import type { OrganisationRole } from "@/generated/prisma/client";
import { requireCoachAccess, AuthorizationError } from "@/lib/auth";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type ActorContext = {
  userId: string;
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
    membershipId: membership.id,
    organisationId: membership.organisationId,
    organisationSlug: organisation.slug,
    role: membership.role,
    delegatedTeamIds: teamAccesses.map((ta) => ta.teamId),
    orgFilter,
  };
}