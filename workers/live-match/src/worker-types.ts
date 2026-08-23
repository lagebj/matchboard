/**
 * Cloudflare Worker environment bindings (SPEC.md §14, §33). `LIVE_MATCH_REALTIME_SECRET`
 * is a Worker secret (set via `wrangler secret put`, never in `wrangler.jsonc`) — the same
 * secret Vercel uses to *issue* tickets (SPEC.md §11); the Worker only ever verifies them.
 *
 * Stage 4 ("signed internal persistence API") will add `LIVE_MATCH_INTERNAL_SECRET` and
 * `MATCHBOARD_API_BASE_URL` here once the Worker actually calls back to Vercel — deliberately
 * not declared yet (SPEC.md §40 Stage 3: "No event persistence migration yet").
 */
export interface Env {
  MATCH_SESSIONS: DurableObjectNamespace;
  /** Comma-separated allowlist of Origins permitted to open a realtime WebSocket. */
  MATCHBOARD_APP_ORIGINS: string;
  LIVE_MATCH_REALTIME_SECRET: string;
}
