import { NextResponse } from "next/server";
import { recordEventForActor } from "@/lib/live-match/live-match-event-store";
import { verifyInternalRequest } from "@/lib/live-match/realtime/internal-auth";
import type { InternalPersistEventRequest } from "@/lib/live-match/realtime/realtime-messages";
import type { LiveMatchEventType, LiveEventCorrectionType } from "@/lib/live-match/live-match-types";
import { logger } from "@/lib/logger";

/**
 * Internal signed persistence endpoint (SPEC.md §17, Stage 4) — the Durable Object's only path
 * to Neon. Never exposed as an ordinary browser API: no session-cookie/actor-context
 * authentication, HMAC verification (`verifyInternalRequest`) is the only gate. Delegates all
 * domain validation (session exists/active, session/match/org consistency, event-type
 * validation, clientEventId dedup) to `recordEventForActor()` — the same single owning
 * implementation the browser-facing `recordEvent()` wrapper uses (AGENTS.md: "One business
 * operation, one owning implementation, multiple adapters"). This route is exactly that: an
 * adapter that authenticates via HMAC instead of a session, then delegates.
 */
export async function POST(request: Request) {
  const verification = await verifyInternalRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }

  let body: InternalPersistEventRequest;
  try {
    body = JSON.parse(verification.rawBody) as InternalPersistEventRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.matchId ||
    !body.sessionId ||
    !body.organisationId ||
    !body.userId ||
    !body.clientEventId ||
    !body.eventType
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const canonical = await recordEventForActor(
      {
        matchId: body.matchId,
        sessionId: body.sessionId,
        eventType: body.eventType as LiveMatchEventType,
        period: body.period,
        matchSeconds: body.matchSeconds,
        playerId: body.playerId,
        secondaryPlayerId: body.secondaryPlayerId,
        payload: body.payload,
        clientEventId: body.clientEventId,
        correctionType: body.correctionType as LiveEventCorrectionType | undefined,
        correctsEventId: body.correctsEventId,
      },
      { userId: body.userId, organisationId: body.organisationId },
    );

    return NextResponse.json(canonical);
  } catch (error) {
    // SPEC.md §32 — never log full event payloads (may carry fair-play free text) or the
    // request's own signature/secret; the error message and correlation ids are enough to
    // diagnose a rejection without ever needing to log the sensitive body itself.
    logger.error(
      { err: error, requestId: verification.requestId, rpcId: body.rpcId, matchId: body.matchId, sessionId: body.sessionId },
      "[internal:live-match:events] Failed to persist event",
    );
    const message = error instanceof Error ? error.message : "Failed to persist event";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
