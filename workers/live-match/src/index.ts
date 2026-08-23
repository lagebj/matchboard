/**
 * Top-level Worker entry (SPEC.md §12, §14). Owns request-level routing/validation only —
 * WebSocket upgrade shape, Origin allowlist, matchId shape — then forwards to the one
 * `MatchSessionObject` for that match. All session/protocol logic lives in
 * `match-session-object.ts`.
 */

import { MatchSessionObject } from "./match-session-object";
import { isOriginAllowed, isValidMatchIdShape, parseAllowedOrigins } from "./auth";
import type { Env } from "./worker-types";

export { MatchSessionObject };

const MATCH_PATH = /^\/matches\/([^/]+)$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const matchId = url.pathname.match(MATCH_PATH)?.[1];

    if (!matchId) {
      return new Response("Not found", { status: 404 });
    }
    if (!isValidMatchIdShape(matchId)) {
      return new Response("Invalid match id", { status: 400 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const allowedOrigins = parseAllowedOrigins(env.MATCHBOARD_APP_ORIGINS);
    if (!isOriginAllowed(request.headers.get("Origin"), allowedOrigins)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    const id = env.MATCH_SESSIONS.idFromName(matchId);
    const stub = env.MATCH_SESSIONS.get(id);
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
