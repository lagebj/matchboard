import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/docs/source";
import "../docs.css";

/**
 * Public documentation shell (ADR-0103). This layout, and everything under it, is
 * reachable without an authenticated session -- see "/docs" in PUBLIC_ROUTES
 * (src/lib/env.ts). It renders inside the root app layout's <html>/<body>, so no
 * duplicate document shell is created here.
 *
 * Lives at the `[[...slug]]` segment (not `docs/layout.tsx`) specifically so it can read
 * `params.slug` -- a layout above a dynamic segment does not receive that segment's params in
 * Next.js's App Router, only a layout at or below it does.
 *
 * `/docs/embed/**` (first slug segment `"embed"`) is a second rendering mode of the exact same
 * canonical content (D8: one content source, never a duplicated copy) for the in-app Help
 * drawer's same-origin <iframe> (help-drawer.tsx). It skips DocsLayout's sidebar/top-nav
 * chrome, which has nowhere useful to navigate to inside a ~440px panel and was pure wasted
 * vertical space stacked on top of the drawer's own header. Still under `/docs/**`, so the
 * existing CSP frame-ancestors / X-Frame-Options / PUBLIC_ROUTES scoping already covers it with
 * no changes needed there.
 */
export default async function DocsRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const isEmbed = slug?.[0] === "embed";

  if (isEmbed) {
    return (
      <RootProvider theme={{ forcedTheme: "dark", enableSystem: false }}>
        {children}
      </RootProvider>
    );
  }

  return (
    <RootProvider theme={{ forcedTheme: "dark", enableSystem: false }}>
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: "Matchboard Docs", url: "/docs" }}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
