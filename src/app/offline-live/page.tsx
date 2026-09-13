import type { Metadata } from "next";
import { OfflineLiveShellClient } from "@/components/live-match/offline-live-shell-client";

/**
 * Scoped live-match offline continuation shell (ADR-0138 Bundle 7).
 *
 * A generic, unauthenticated, publicly-fetchable page (see `PUBLIC_ROUTES` in `src/lib/env.ts`)
 * with no tenant/player/match/user data of its own. `public/live-sw.js` caches this exact
 * response once and later serves it, unchanged, as the offline fallback for a navigation request
 * to an already-established live-match route (`/matches/{id}/live`) when the network is
 * genuinely unreachable — the browser's address bar stays on the real match URL throughout.
 * `OfflineLiveShellClient` reads that real URL from `window.location` after mount (never from
 * Next.js route params — this page is never actually navigated to directly) and reconstructs the
 * live-reporting screen from this device's own IndexedDB storage.
 */
export const metadata: Metadata = {
  title: "Matchboard — Live reporting (offline)",
};

export default function OfflineLivePage() {
  return <OfflineLiveShellClient />;
}
