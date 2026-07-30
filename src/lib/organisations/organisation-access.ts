import type { OrganisationRole } from "@/generated/prisma/client";

export type OrganisationAccessContext = {
  userId: string;
  userEmail: string;
  organisationId: string;
  organisationSlug: string;
  organisationName: string;
  role: OrganisationRole;
  membershipId: string;
  permittedTeamIds: string[];
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

export function requireTeamAccess(ctx: OrganisationAccessContext, teamId: string): void {
  if (ctx.canAccessAllTeams) return;
  if (ctx.permittedTeamIds.includes(teamId)) return;

  throw new OrganisationAccessError("You do not have access to this team.");
}