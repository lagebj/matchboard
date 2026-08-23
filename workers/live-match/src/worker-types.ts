/**
 * Cloudflare Worker environment bindings (SPEC.md §14, §33). `LIVE_MATCH_REALTIME_SECRET`
 * and `LIVE_MATCH_INTERNAL_SECRET` are both Worker secrets (set via `wrangler secret put` —
 * the deploy workflow does this automatically for `LIVE_MATCH_INTERNAL_SECRET` on every
 * deploy, see `.github/workflows/deploy-live-match-worker.yml`; `LIVE_MATCH_REALTIME_SECRET`
 * remains a one-time manual step). `LIVE_MATCH_REALTIME_SECRET` is the same secret Vercel
 * uses to *issue* tickets (SPEC.md §11) — the Worker only ever verifies them.
 * `LIVE_MATCH_INTERNAL_SECRET` is the separate secret (SPEC.md §18) the Worker uses to *sign*
 * outbound persistence requests to `MATCHBOARD_API_BASE_URL`; Vercel verifies them.
 */
export interface Env {
  MATCH_SESSIONS: DurableObjectNamespace;
  /** Comma-separated allowlist of Origins permitted to open a realtime WebSocket. */
  MATCHBOARD_APP_ORIGINS: string;
  LIVE_MATCH_REALTIME_SECRET: string;
  LIVE_MATCH_INTERNAL_SECRET: string;
  /** Base URL of the Vercel app this Worker signs persistence requests to (SPEC.md §17). */
  MATCHBOARD_API_BASE_URL: string;
}
