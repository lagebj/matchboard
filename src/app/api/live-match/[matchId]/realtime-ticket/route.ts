import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import { getLiveMatchRealtimeSecret } from "@/lib/env";
import {
  signRealtimeTicket,
  REALTIME_TICKET_DEFAULT_TTL_SECONDS,
} from "@/lib/live-match/realtime/realtime-ticket";

/**
 * Issues a short-lived realtime connection ticket (SPEC.md §11) for a live match session.
 * Reuses the exact same authorization path as other live-match mutations
 * (`requireActorContext()`, `requireMutationRole()`, direct organisationId ownership check —
 * see `src/lib/live-match/live-match-session.ts`'s `startLiveSession()`), plus confirms an
 * active live session exists for this match before issuing a ticket. This route never
 * creates or mutates a live session itself — it only vouches for a caller who already has
 * one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  let ctx;
  try {
    ctx = await requireActorContext();
    requireMutationRole(ctx);
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

    const secret = getLiveMatchRealtimeSecret();
    const ticket = await signRealtimeTicket(
      {
        userId: ctx.userId,
        organisationId: ctx.organisationId,
        matchId: match.id,
        sessionId: session.id,
        // Minimal for Stage 2 — refined once Stage 3+ actually branches behaviour on
        // capability values (SPEC.md §5.1/§5.2's method set is the same for every
        // authenticated connection today, so a single capability is honest, not a guess).
        capabilities: ["report"],
      },
      secret,
    );

    return NextResponse.json({ ticket, expiresIn: REALTIME_TICKET_DEFAULT_TTL_SECONDS });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
