import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireActorContext,
  requireMutationRole,
  requireMatchGroupAccess,
  requireMatchGroupMutationRole,
} from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import { getLiveMatchRealtimeSecret } from "@/lib/env";
import {
  signRealtimeTicket,
  REALTIME_TICKET_DEFAULT_TTL_SECONDS,
} from "@/lib/live-match/realtime/realtime-ticket";

type TicketMode = "report" | "view";

function parseMode(value: unknown): TicketMode {
  return value === "view" ? "view" : "report";
}

/**
 * Issues a short-lived realtime connection ticket (SPEC.md §11) for a live match session.
 *
 * Two modes, selected by an optional `{ "mode": "report" | "view" }` JSON body (defaults to
 * "report" — the only mode that existed before "Follow live" viewing, so an empty/missing
 * body keeps the original behavior):
 *
 * - `"report"`: the coach actually running the match. Requires org-level mutation role
 *   (`requireMutationRole`) AND group-level `GROUP_COACH` role for the match's group
 *   (`requireMatchGroupMutationRole` — closes a gap where a GROUP_VIEWER-role coach with an
 *   org-mutation-capable role like COACH could otherwise report on a group they were only
 *   granted read-only access to). Capability: `["report"]`.
 * - `"view"`: a second coach following along read-only ("Follow live"). Requires only
 *   group-level access to the match's group (`requireMatchGroupAccess` — `GROUP_COACH` or
 *   `GROUP_VIEWER`, no org-mutation-role requirement, so an org VIEWER/SUPPORT member with
 *   group access can watch). Capability: `["view"]`. The Durable Object
 *   (`workers/live-match/src/match-session-object.ts`) rejects `recordEvent`/`endSession`
 *   from any connection whose capabilities don't include `"report"` — this ticket's
 *   capability is the only thing standing between a viewer and match mutation, so it must
 *   never include `"report"` for this mode.
 *
 * Both modes still require an active `LiveMatchSession` to exist for the match — you can only
 * report on or watch a session that has actually started, per the existing check below. This
 * route never creates or mutates a live session itself — it only vouches for a caller who
 * already has (report) or has permission to observe (view) one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const mode = parseMode((body as { mode?: unknown } | null)?.mode);

  let ctx;
  try {
    ctx = await requireActorContext();
    if (mode === "report") {
      requireMutationRole(ctx);
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await rateLimit("live-match-realtime-ticket", 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many ticket requests. Please wait a moment and try again." }, { status: 429 });
  }

  const { matchId } = await params;

  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { id: true, organisationId: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.organisationId !== ctx.organisationId) {
      return NextResponse.json({ error: "Match not found or access denied." }, { status: 404 });
    }

    const session = await db.liveMatchSession.findUnique({
      where: { matchId },
      select: { id: true, organisationId: true, status: true },
    });

    if (!session || session.organisationId !== ctx.organisationId) {
      return NextResponse.json({ error: "No live session exists for this match." }, { status: 404 });
    }
    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Live session has ended." }, { status: 409 });
    }

    if (mode === "report") {
      await requireMatchGroupMutationRole(ctx, matchId);
    } else {
      await requireMatchGroupAccess(ctx, matchId);
    }

    const secret = getLiveMatchRealtimeSecret();
    const ticket = await signRealtimeTicket(
      {
        userId: ctx.userId,
        organisationId: ctx.organisationId,
        matchId: match.id,
        sessionId: session.id,
        // Capability drives server-side mutation enforcement in the Durable Object
        // (match-session-object.ts) — a "view" ticket must never include "report".
        capabilities: mode === "report" ? ["report"] : ["view"],
      },
      secret,
    );

    return NextResponse.json({ ticket, expiresIn: REALTIME_TICKET_DEFAULT_TTL_SECONDS });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
