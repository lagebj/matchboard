import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { organisationFilter, organisationFilterNullable, requireOrganisationId } from "@/lib/tenancy/tenant-filter";

export type OrgContext = {
  organisationId: string;
  filter: { organisationId: string };
  filterNullable: { organisationId: string | null };
  ctx: OrganisationAccessContext;
};

export function createOrgContext(ctx: OrganisationAccessContext): OrgContext {
  const organisationId = requireOrganisationId(ctx);
  return {
    organisationId,
    filter: organisationFilter(organisationId),
    filterNullable: organisationFilterNullable(organisationId),
    ctx,
  };
}