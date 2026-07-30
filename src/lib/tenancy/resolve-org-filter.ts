import type { PrismaClient } from "@/generated/prisma/client";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { organisationFilter, organisationFilterNullable } from "@/lib/tenancy/tenant-filter";
import { db } from "@/lib/db";

export type OrgFilterMode =
  | { type: "org"; filter: { organisationId: string }; filterNullable: { organisationId: string | null }; organisationId: string }
  | { type: "unscoped"; filter: {}; filterNullable: {} };

export async function resolveOrgFilterForUser(userId: string, client: PrismaClient = db): Promise<OrgFilterMode> {
  const membership = await client.organisationMembership.findFirst({
    where: { userId },
    select: { organisationId: true },
  });

  if (!membership) {
    return { type: "unscoped", filter: {}, filterNullable: {} };
  }

  const organisationId = membership.organisationId;
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