export type OrganisationAccessContext = import("@/lib/organisations/organisation-access").OrganisationAccessContext;

export function requireOrganisationId(ctx: OrganisationAccessContext): string {
  return ctx.organisationId;
}

export function organisationFilter(organisationId: string): { organisationId: string } {
  return { organisationId };
}

export function organisationFilterNullable(organisationId: string): { organisationId: string | null } {
  return { organisationId };
}