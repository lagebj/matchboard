import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopContextBar } from "@/components/shell/top-context-bar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UserNav } from "@/components/shell/user-nav";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { resolveOrgSlugForLayout } from "@/lib/auth/resolve-org-slug";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSlug = await resolveOrgSlugForLayout();

  return (
    <OrgSlugProvider orgSlug={orgSlug}>
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
}