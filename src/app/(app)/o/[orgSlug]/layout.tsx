import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { OrgSlugCookieSetter } from "@/components/shell/org-slug-cookie-setter";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function OrgLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}>) {
  const { orgSlug } = await params;
  let organisationId: string | undefined;

  try {
    const access = await resolveOrganisationAccess(orgSlug);
    organisationId = access.organisationId;
  } catch {
    // If org resolution fails, continue without tenant context
    // The page will handle auth errors
  }

  const content = (
    <OrgSlugProvider orgSlug={orgSlug}>
      <OrgSlugCookieSetter orgSlug={orgSlug} />
      {children}
    </OrgSlugProvider>
  );

  if (organisationId) {
    return runWithTenantOrganisationId(organisationId, async () => content);
  }

  return content;
}