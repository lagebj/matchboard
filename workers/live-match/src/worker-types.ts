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
  /**
   * Vercel's "Protection Bypass for Automation" secret for the `matchboard` project
   * (ADR-0153). Only set on the `test` Worker environment — `test.matchboard.football` sits on
   * a non-Production Custom Environment, which Vercel's SSO Deployment Protection does NOT
   * exempt the way it exempts a project's Production domain (confirmed live), so a server-to-
   * server call from this Worker to `MATCHBOARD_API_BASE_URL` gets rejected by Vercel's own
   * edge (401) before ever reaching the app's HMAC verification, unless this header is sent.
   * `app.matchboard.football` (production) IS exempted, so the production Worker environment
   * deliberately has no such secret and `internal-client.ts` sends no header when it's unset.
   */
  VERCEL_AUTOMATION_BYPASS_SECRET?: string;
}
