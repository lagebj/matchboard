import type { PrismaClient } from "@/generated/prisma/client";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { AuthorizationError } from "@/lib/auth";
import { organisationFilter, organisationFilterNullable } from "@/lib/tenancy/tenant-filter";
import { setTenantUserId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";

export type OrgFilterMode =
  | { type: "org"; filter: { organisationId: string }; filterNullable: { organisationId: string }; organisationId: string };

export class MultipleMembershipsError extends AuthorizationError {
  constructor(
    message: string,
    public readonly organisations: Array<{ id: string; name: string; slug: string; role: string }>,
  ) {
    super(message);
    this.name = "MultipleMembershipsError";
  }
}

export async function resolveOrgFilterForUser(userId: string, client: PrismaClient = db): Promise<OrgFilterMode> {
  setTenantUserId(userId);

  const memberships = await client.organisationMembership.findMany({
    where: { userId },
    select: {
      organisationId: true,
      role: true,
      expiresAt: true,
      organisation: { select: { id: true, name: true, slug: true, suspendedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  const eligible = memberships.filter((m) => {
    if (m.organisation.suspendedAt !== null) return false;
    if (m.role === "SUPPORT" && m.expiresAt && m.expiresAt < now) return false;
    return true;
  });

  if (eligible.length === 0) {
    throw new AuthorizationError("No active organisation membership");
  }

  if (eligible.length > 1) {
    const orgs = eligible.map((m) => ({
      id: m.organisation.id,
      name: m.organisation.name,
      slug: m.organisation.slug,
      role: m.role,
    }));
    throw new MultipleMembershipsError(
      "You belong to multiple organisations. Please select an organisation.",
      orgs,
    );
  }

  const membership = eligible[0];
  const organisationId = membership.organisationId;
  return {
    type: "org",
    filter: organisationFilter(organisationId),
    filterNullable: organisationFilterNullable(organisationId),
    organisationId,
  };
}

export async function resolveOrgFilterForMachine(
  principalId: string,
  organisationId: string,
  client: PrismaClient = db,
): Promise<OrgFilterMode> {
  const principal = await client.machinePrincipal.findUnique({
    where: { id: principalId },
    select: { id: true, organisationId: true, status: true },
  });

  if (!principal) {
    throw new AuthorizationError("Machine principal not found");
  }

  if (principal.organisationId !== organisationId) {
    throw new AuthorizationError("Machine principal does not belong to this organisation");
  }

  return {
    type: "org",
    filter: organisationFilter(organisationId),
    filterNullable: organisationFilterNullable(organisationId),
    organisationId,
  };
}

export function orgFilterFromContext(ctx: OrganisationAccessContext): OrgFilterMode {
  return {
    type: "org",
    filter: organisationFilter(ctx.organisationId),
    filterNullable: organisationFilterNullable(ctx.organisationId),
    organisationId: ctx.organisationId,
  };
}