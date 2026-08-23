/**
 * Worker-side connection auth helpers (SPEC.md §11–§12, §35). Ticket verification itself
 * (`verifyRealtimeTicket`) is shared application protocol code reused from
 * `src/lib/live-match/realtime/realtime-ticket.ts` (SPEC.md §14 — "shared application
 * protocol code should live with the existing domain", not duplicated into the Worker).
 * That module only depends on `jose` and Web Crypto globals, both Workers-compatible, so it
 * is imported directly rather than reimplemented here.
 */

export { verifyRealtimeTicket } from "../../../src/lib/live-match/realtime/realtime-ticket";
export type { LiveMatchRealtimeTicket } from "../../../src/lib/live-match/realtime/realtime-messages";

/** SPEC.md §33 — `MATCHBOARD_APP_ORIGINS` is a comma-separated allowlist. */
export function parseAllowedOrigins(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function isOriginAllowed(origin: string | null, allowed: ReadonlySet<string>): boolean {
  if (!origin) return false;
  return allowed.has(origin);
}

/**
 * SPEC.md §12 step 3 — matchId shape validation before routing to
 * `env.MATCH_SESSIONS.idFromName(matchId)`. Matchboard's Prisma IDs (cuid) are opaque
 * alphanumeric tokens; this is a defensive shape check, not a lookup — the Durable Object
 * itself still requires a valid ticket before trusting anything about the routed match.
 */
const MATCH_ID_SHAPE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidMatchIdShape(matchId: string): boolean {
  return MATCH_ID_SHAPE.test(matchId);
}
