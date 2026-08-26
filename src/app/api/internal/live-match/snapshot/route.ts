import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyInternalRequest } from "@/lib/live-match/realtime/internal-auth";
import type { InternalSnapshotResponse } from "@/lib/live-match/realtime/realtime-messages";
import { runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";

/**
 * Internal signed snapshot endpoint (SPEC.md §17, §23, Stage 4) — returns canonical session
 * status and events for Durable Object reconciliation. The endpoint is Stage 4 scope; having
 * the Durable Object actually *call* this to discover HTTP-fallback-written events it never
 * saw is Stage 6's reconciliation work (SPEC.md §23).
 *
 * GET with no body — the HMAC (verifyInternalRequest) signs over an empty raw body string
 * rather than a special-cased query-string scheme, keeping one canonical signing shape shared
 * with the POST endpoint (SPEC.md §18's single `<timestamp>.<rawBody>` input).
 */
export async function GET(request: Request) {
  const verification = await verifyInternalRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }

  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId");
  const sessionId = url.searchParams.get("sessionId");

  if (!matchId || !sessionId) {
    return NextResponse.json({ error: "matchId and sessionId query parameters are required" }, { status: 400 });
  }

  // No user/org actor exists on this path — the caller is the HMAC-verified Worker itself,
  // reconciling canonical state by sessionId/matchId, not any specific organisation's data.
  // ADR-0087: genuinely privileged system operation, explicit and narrow.
  const { session, events } = await runWithSystemPrivilege(
    "internal-live-match-snapshot-reconciliation",
    async () => {
      const session = await db.liveMatchSession.findUnique({
        where: { id: sessionId },
        select: { id: true, matchId: true, status: true },
      });

      if (!session || session.matchId !== matchId) {
        return { session: null, events: [] };
      }

      // SPEC.md §24 — stable tie-breaker: createdAt alone is not guaranteed unique/ordered for
      // events created within the same millisecond, and this ordering feeds directly into
      // realtime reconstruction (Stage 6's reconciliation replays this list to assign versions).
      const events = await db.liveMatchEvent.findMany({
        where: { matchId, sessionId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, clientEventId: true, eventType: true, createdAt: true, playerId: true, secondaryPlayerId: true },
      });

      return { session, events };
    },
  );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const response: InternalSnapshotResponse = {
    session: { sessionId: session.id, matchId: session.matchId, status: session.status },
    events: events.map((event) => ({
      id: event.id,
      clientEventId: event.clientEventId ?? event.id,
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString(),
      playerId: event.playerId ?? undefined,
      secondaryPlayerId: event.secondaryPlayerId ?? undefined,
    })),
  };

  return NextResponse.json(response);
}
