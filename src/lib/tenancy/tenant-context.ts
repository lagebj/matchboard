import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { organisationFilter, organisationFilterNullable, requireOrganisationId } from "./tenant-filter";

export type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
export { organisationFilter, organisationFilterNullable, requireOrganisationId } from "./tenant-filter";

export async function getOrganisationContext(slug: string): Promise<OrganisationAccessContext> {
  return resolveOrganisationAccess(slug);
}