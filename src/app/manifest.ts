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
 * installed Test app from being mistaken for Production; the maskable icon
 * and a Test-marker icon variant are visual asset work tracked separately
 * (owner-approval gate — see UPCOMING-PACKETS.md packet UX-2.10-01).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") ?? "";
  const isTest = host.startsWith("test.");

  return {
    id: "/today",
    name: isTest ? "Matchboard Test" : "Matchboard",
    short_name: isTest ? "Matchboard Test" : "Matchboard",
    description: "Squad selection and match-round planning for youth football.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#0a0d13",
    theme_color: "#0a0d13",
    icons: [
      { src: "/brand/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "League", url: "/fixtures" },
      { name: "Events", url: "/events" },
    ],
  };
}
