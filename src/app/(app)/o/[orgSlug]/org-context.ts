import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { redirect } from "next/navigation";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";

export async function getOrgContext(orgSlug: string): Promise<OrganisationAccessContext> {
  return resolveOrganisationAccess(orgSlug);
}

export async function requireOrgAdminOrOwner(orgSlug: string): Promise<OrganisationAccessContext> {
  const { resolveOrganisationAdminOrOwner } = await import("@/lib/organisations/organisation-resolver");
  return resolveOrganisationAdminOrOwner(orgSlug);
}

export async function requireOrgOwner(orgSlug: string): Promise<OrganisationAccessContext> {
  const { resolveOrganisationOwner } = await import("@/lib/organisations/organisation-resolver");
  return resolveOrganisationOwner(orgSlug);
}

export { type OrganisationAccessContext };