/**
 * Registers the scoped live-match service worker (ADR-0138 Bundle 7). Called only from
 * `LiveMatchClient` itself — never eagerly for the whole app — so a service worker is only ever
 * present on a device that has actually opened live reporting at least once. No-ops safely when
 * service workers aren't supported (older browsers, some in-app webviews) or when running under
 * a base URL this repository doesn't control (never register against `matchboard-test`'s
 * production sibling by accident — same-origin registration only, which `register()` already
 * enforces implicitly since the script path is relative).
 */
export function registerLiveServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/live-sw.js").catch((error) => {
    console.warn("[live-match] service worker registration failed (non-fatal):", error instanceof Error ? error.message : String(error));
  });
}
