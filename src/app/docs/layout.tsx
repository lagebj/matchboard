import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/docs/source";
import "./docs.css";

/**
 * Public documentation shell (ADR-0103). This layout, and everything under it, is
 * reachable without an authenticated session -- see "/docs" in PUBLIC_ROUTES
 * (src/lib/env.ts). It renders inside the root app layout's <html>/<body>, so no
 * duplicate document shell is created here.
 */
export default function DocsRootLayout({ children }: { children: ReactNode }) {
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
