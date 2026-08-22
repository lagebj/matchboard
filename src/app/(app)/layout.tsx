import { SidebarNav } from "@/components/shell/sidebar-nav";
import { NavigationRail } from "@/components/shell/navigation-rail";
import { TopContextBar } from "@/components/shell/top-context-bar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UserNav } from "@/components/shell/user-nav";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { OrgSlugCookieSetter } from "@/components/shell/org-slug-cookie-setter";
import { getOrgSlugForUser } from "@/lib/auth/resolve-org-slug";
import { resolveOrganisationAccess } from "@/lib/organisations/organisation-resolver";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { headers } from "next/headers";

/**
 * TestEnvironmentBadge — an in-app marker so an installed Test PWA can never
 * be mistaken for Production, even without looking at the home-screen icon
 * (PROGRAMME.md §41). Host-detected server-side, same convention as
 * src/app/manifest.ts. A distinct Test-marker home-screen icon is separate,
 * owner-approval-adjacent asset work (UX-2.10-01) — this badge doesn't wait
 * on that.
 */
function TestEnvironmentBadge() {
  return (
    <span className="shrink-0 rounded-md border border-[var(--warning)]/40 bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--warning)]">
      Test
    </span>
  );
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const isTestEnvironment = host.startsWith("test.");

  const orgSlug = await getOrgSlugForUser();

  if (!orgSlug) {
    // No single resolvable organisation (none, or more than one — ambiguous).
    // Render a minimal shell instead of redirecting: /organisations and
    // /invite/[token] live inside this same (app) group and must stay
    // reachable in this state, or redirecting to them here loops forever.
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center border-b border-[var(--border-soft)] bg-[rgba(10,13,19,0.85)] backdrop-blur-2xl">
          <div className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3">
            <span className="text-sm font-semibold">Matchboard</span>
            {isTestEnvironment && <TestEnvironmentBadge />}
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
        <aside className="sticky top-0 z-30 hidden h-screen w-[var(--rail-width)] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[rgba(8,11,18,0.98)] backdrop-blur-2xl medium:flex expanded:hidden">
          <NavigationRail orgSlug={orgSlug} />
        </aside>
        <aside className="sticky top-0 z-30 hidden h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[rgba(8,11,18,0.98)] backdrop-blur-2xl expanded:flex">
          <SidebarNav orgSlug={orgSlug} />
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center border-b border-[var(--border-soft)] bg-[rgba(10,13,19,0.85)] backdrop-blur-2xl">
            <div className="flex-1 min-w-0">
              <TopContextBar />
            </div>
            {isTestEnvironment && (
              <div className="shrink-0 pr-1">
                <TestEnvironmentBadge />
              </div>
            )}
            <div className="shrink-0 px-3">
              <UserNav />
            </div>
          </header>
          <main className="flex-1 pb-20 medium:pb-0">
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
    // NOTE: runWithTenantOrganisationId sets context for this layout's own
    // queries only. It does NOT propagate to child server components because
    // Next.js App Router renders server components as separate async operations.
    // Child components must call requireActorContext() which sets context via
    // setTenantOrganisationId (enterWith) for the rest of the request.
    return runWithTenantOrganisationId(organisationId, async () => content);
  }

  return content;
}