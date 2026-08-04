import type { OrganisationRole } from "@/generated/prisma/client";
import type { GroupAccessEntry } from "@/lib/auth/group-context";

export type OrganisationAccessContext = {
  userId: string;
  userEmail: string;
  organisationId: string;
  organisationSlug: string;
  organisationName: string;
  role: OrganisationRole;
  membershipId: string;
  accessibleGroupIds: string[];
  groupAccesses: GroupAccessEntry[];
  canAccessAllTeams: boolean;
  canCreateTeam: boolean;
  canManageMemberships: boolean;
  canInviteRole: (targetRole: OrganisationRole) => boolean;
  canManageRole: (targetRole: OrganisationRole) => boolean;
  canDeleteOrganisation: boolean;
  canTransferOwnership: boolean;
};

export class OrganisationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganisationAccessError";
  }
}

export function requireRole(ctx: OrganisationAccessContext, ...allowedRoles: OrganisationRole[]): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new OrganisationAccessError(
      `Role ${ctx.role} is not authorised. Required: ${allowedRoles.join(" or ")}.`,
    );
  }
}

export async function requireTeamAccess(ctx: OrganisationAccessContext, teamId: string): Promise<void> {
  if (ctx.canAccessAllTeams) return;

  const { db } = await import("@/lib/db");
  const team = await db.team.findFirst({
    where: { id: teamId, organisationId: ctx.organisationId },
    select: { footballGroupId: true },
  });

  if (!team || !ctx.accessibleGroupIds.includes(team.footballGroupId)) {
    throw new OrganisationAccessError("You do not have access to this team.");
  }
}