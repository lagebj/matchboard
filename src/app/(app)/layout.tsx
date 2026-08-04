import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopContextBar } from "@/components/shell/top-context-bar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UserNav } from "@/components/shell/user-nav";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { OrgSlugCookieSetter } from "@/components/shell/org-slug-cookie-setter";
import { getOrgSlugForUser } from "@/lib/auth/resolve-org-slug";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSlug = await getOrgSlugForUser();

  if (!orgSlug) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center border-b border-[var(--border-soft)] bg-[rgba(10,13,19,0.85)] backdrop-blur-2xl">
          <div className="flex-1 min-w-0 px-4 py-3">
            <span className="text-sm font-semibold">Matchboard</span>
          </div>
          <div className="shrink-0 px-3">
            <UserNav />
          </div>
        </header>
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    );
  }

  let organisationId: string | undefined;
  try {
    const access = await resolveOrganisationAccess(orgSlug);
    organisationId = access.organisationId;
  } catch {
    // Continue without tenant context; page will handle auth errors
  }

  const content = (
    <OrgSlugProvider orgSlug={orgSlug}>
      <OrgSlugCookieSetter orgSlug={orgSlug} />
      <div className="app-shell flex min-h-full">
        <aside className="sticky top-0 z-30 hidden h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[rgba(8,11,18,0.98)] backdrop-blur-2xl lg:flex">
          <SidebarNav orgSlug={orgSlug} />
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center border-b border-[var(--border-soft)] bg-[rgba(10,13,19,0.85)] backdrop-blur-2xl">
            <div className="flex-1 min-w-0">
              <TopContextBar />
            </div>
            <div className="shrink-0 px-3">
              <UserNav />
            </div>
          </header>
          <main className="flex-1 pb-20 lg:pb-0">
            <div className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6">
              {children}
            </div>
          </main>
        </div>
        <MobileNav orgSlug={orgSlug} />
      </div>
    </OrgSlugProvider>
  );

  if (organisationId) {
    return runWithTenantOrganisationId(organisationId, async () => content);
  }

  return content;
}