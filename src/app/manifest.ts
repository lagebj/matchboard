import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Dynamic PWA manifest (Next.js MetadataRoute.Manifest convention). Branches
 * on the request hostname rather than a Vercel project-ID env var, so it
 * doesn't depend on any env var being pre-configured — `matchboard` and
 * `matchboard-test` are separate Vercel projects but this route works
 * identically wherever it's deployed.
 *
 * A visually distinct name/short_name is the code-level half of keeping the
 * installed Test app from being mistaken for Production; a distinct
 * Test-marker home-screen icon was deliberately not added for v1 (owner
 * decision — the name difference plus the in-app Test badge are the
 * distinguishing signals instead; see AGENTS.md's "PWA (installable app)"
 * section).
 *
 * Icons (ADR-0123): android-chrome-{192,512} are the `purpose: "any"` icons
 * (opaque brand-green field, white mark). The `purpose: "maskable"` entries
 * point at dedicated maskable-{192,512} assets whose mark sits inside the
 * centre-80% mask-safe area — the full-bleed android-chrome art has the logo
 * motif running to the edges and clips on circular Android masks.
 *
 * This route and its icons are served publicly (no auth) — see
 * PUBLIC_ROUTES in src/lib/env.ts and ADR-0123 for why.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") ?? "";
  const isTest = host.startsWith("test.");

  return {
    id: "/today",
    lang: "en",
    name: isTest ? "Matchboard Test" : "Matchboard",
    short_name: isTest ? "Matchboard Test" : "Matchboard",
    description: "Squad selection and match-round planning for youth football.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#0a0d13",
    theme_color: "#0a0d13",
    icons: [
      { src: "/brand/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "League", url: "/fixtures" },
      { name: "Events", url: "/events" },
    ],
  };
}
