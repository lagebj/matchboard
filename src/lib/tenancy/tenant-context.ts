import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";

export type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
export { organisationFilter, organisationFilterNullable, requireOrganisationId } from "./tenant-filter";
export { isValidOrganisationId, withTenantContext } from "./tenant-client";

export async function getOrganisationContext(slug: string): Promise<OrganisationAccessContext> {
  return resolveOrganisationAccess(slug);
}