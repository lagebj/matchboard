// Matchboard live-match service worker (ADR-0138 Bundle 7).
//
// Scoped, in EFFECT (not by declared registration scope, which is root — a broad registration
// scope with a narrow fetch handler is the simplest way to keep the worker's controlled URL
// range wide enough to intercept live-match navigation while its actual behavior stays narrow),
// to exactly two things:
//   1. Cache-first for Next.js's own immutable, content-hashed static assets (/_next/static/**)
//      — safe unconditionally, since a given URL's content never changes.
//   2. A navigation-request fallback for an established live-match route (/matches/*/live,
//      /events/*/matches/*/live) when the network is genuinely unreachable — served from ONE
//      cached, generic, unauthenticated shell page, never a real per-match SSR response.
// Everything else passes through untouched — this worker never intercepts, caches, or serves
// cached content for any other request (AGENTS.md: "Do not cache broad authenticated pages").
// Do not widen either pattern below without updating AGENTS.md's PWA section and this header
// comment together.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `matchboard-live-static-${CACHE_VERSION}`;
const SHELL_CACHE = `matchboard-live-shell-${CACHE_VERSION}`;
const OFFLINE_SHELL_URL = "/offline-live";
const LIVE_ROUTE_PATTERN = /\/matches\/[^/]+\/live\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        await cache.add(OFFLINE_SHELL_URL);
      } catch {
        // Best-effort — if this install happens while offline, the shell simply isn't cached
        // yet; the next online activation/fetch cycle can retry.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, SHELL_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("matchboard-live-") && !keep.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (request.mode === "navigate" && LIVE_ROUTE_PATTERN.test(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const shell = await cache.match(OFFLINE_SHELL_URL);
          if (shell) return shell;
          throw new Error("offline and no cached offline shell available");
        }
      })(),
    );
    return;
  }

  // Everything else (API routes, server actions, other pages, other static assets): pass
  // through untouched. No respondWith() call means the browser handles the request normally.
});
