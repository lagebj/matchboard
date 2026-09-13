/**
 * ADR-0138 Bundle 7 — identifies a live-match route and extracts its subject id, shared by the
 * offline shell client. Must stay in sync with `public/live-sw.js`'s own `LIVE_ROUTE_PATTERN` —
 * duplicated there rather than imported, since a service worker script cannot import from the
 * app bundle without extra build tooling this repository doesn't otherwise need (the same
 * duplication convention `workers/live-match/src/state.ts` already uses for its own
 * zero-runtime-dependency pure helpers). Update both together.
 */
const LIVE_ROUTE_PATTERN = /\/matches\/([^/]+)\/live\/?$/;

export function isLiveRoute(pathname: string): boolean {
  return LIVE_ROUTE_PATTERN.test(pathname);
}

export function extractLiveRouteSubjectId(pathname: string): string | null {
  const match = LIVE_ROUTE_PATTERN.exec(pathname);
  return match ? match[1] : null;
}
