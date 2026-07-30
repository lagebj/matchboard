import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";

export type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";

export async function getOrganisationContext(slug: string): Promise<OrganisationAccessContext> {
  return resolveOrganisationAccess(slug);
}

export function requireOrganisationId(ctx: OrganisationAccessContext): string {
  return ctx.organisationId;
}

export function organisationFilter(organisationId: string): { organisationId: string } {
  return { organisationId };
}

export function organisationFilterNullable(organisationId: string): { organisationId: string | null } {
  return { organisationId };
}