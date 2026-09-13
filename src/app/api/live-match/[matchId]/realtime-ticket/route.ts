import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireActorContext,
  requireMutationRole,
  requireMatchGroupAccess,
  requireMatchGroupMutationRole,
  requireGroupAccessFromContext,
} from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import { getLiveMatchRealtimeSecret } from "@/lib/env";
import {
  signRealtimeTicket,
  REALTIME_TICKET_DEFAULT_TTL_SECONDS,
} from "@/lib/live-match/realtime/realtime-ticket";
import { getLeaguePeriodConfig, getTotalPeriodDurationMs } from "@/lib/live-match/period-config";

type TicketMode = "report" | "view";
type SubjectType = "LEAGUE" | "EVENT";

function parseMode(value: unknown): TicketMode {
  return value === "view" ? "view" : "report";
}

/** ADR-0138 Bundle 8 — defaults to `"LEAGUE"` so every pre-existing caller (which never sent
 * this field at all) keeps its exact original behavior. */
function parseSubjectType(value: unknown): SubjectType {
  return value === "EVENT" ? "EVENT" : "LEAGUE";
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
  const subjectType = parseSubjectType((body as { subjectType?: unknown } | null)?.subjectType);

  let ctx;
  try {
    ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
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
    if (subjectType === "EVENT") {
      // ADR-0138 Bundle 8 — Event parity. "report" mode deliberately matches Event's own
      // existing authorization pattern everywhere else in this codebase (org-level
      // `requireMutationRole` only, checked unconditionally above, no group-level check) rather
      // than inventing a stricter check League happens to have and Event does not — see
      // ARR-0048 for that pre-existing, separate asymmetry, recorded rather than silently fixed
      // here (out of scope for "wire Event into the coordinator"). "view" mode (Follow Live,
      // Bundle 8 work item 7) is a genuinely new, additive capability with no prior Event
      // precedent to match — it reuses the exact same group-access model League's own Follow
      // Live already established (`requireGroupAccessFromContext`, GROUP_COACH or
      // GROUP_VIEWER on the Event's own `footballGroupId`), since that is this specific
      // feature's own design, not a change to Event's existing mutation-authorization pattern.
      const eventMatch = await db.eventMatch.findUnique({
        where: { id: matchId },
        select: { id: true, organisationId: true, event: { select: { footballGroupId: true } } },
      });

      if (!eventMatch) {
        return NextResponse.json({ error: "Event match not found" }, { status: 404 });
      }
      if (eventMatch.organisationId !== ctx.organisationId) {
        return NextResponse.json({ error: "Event match not found or access denied." }, { status: 404 });
      }

      if (mode === "view") {
        try {
          requireGroupAccessFromContext(ctx, eventMatch.event.footballGroupId);
        } catch {
          return NextResponse.json({ error: "You do not have access to follow this event match live." }, { status: 403 });
        }
      }

      const session = await db.eventLiveMatchSession.findUnique({
        where: { eventMatchId: matchId },
        select: { id: true, organisationId: true, status: true },
      });

      if (!session || session.organisationId !== ctx.organisationId) {
        return NextResponse.json({ error: "No live session exists for this event match." }, { status: 404 });
      }
      if (session.status !== "ACTIVE") {
        return NextResponse.json({ error: "Live session has ended." }, { status: 409 });
      }

      const secret = getLiveMatchRealtimeSecret();
      const ticket = await signRealtimeTicket(
        {
          userId: ctx.userId,
          organisationId: ctx.organisationId,
          matchId: eventMatch.id,
          sessionId: session.id,
          capabilities: mode === "report" ? ["report"] : ["view"],
          // No shared duration-resolution exists for Event yet (see
          // `LiveMatchRealtimeTicket.expectedEndAt`'s own doc comment) — the object falls back
          // to inactivity-only expiry, exactly as already documented.
          expectedEndAt: null,
          subjectType: "EVENT",
        },
        secret,
      );

      return NextResponse.json({ ticket, expiresIn: REALTIME_TICKET_DEFAULT_TTL_SECONDS });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { id: true, organisationId: true, startsAt: true, matchType: true },
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

    // Durable Object finite-lifecycle expiry (see LiveMatchRealtimeTicket.expectedEndAt's doc
    // comment) — kickoff + this match's regulation-time duration. Deliberately the same fixed
    // config `getLeaguePeriodConfig`/`getTotalPeriodDurationMs` already use elsewhere for League
    // matches, not a new duration source. Guarded defensively (missing startsAt, or a null
    // total) so a lifecycle-hardening detail can never fail ticket issuance itself — an
    // unresolvable expectedEndAt just means the object falls back to inactivity-only expiry.
    let expectedEndAt: number | null = null;
    if (match.startsAt) {
      const totalDurationMs = getTotalPeriodDurationMs(getLeaguePeriodConfig(match.matchType));
      expectedEndAt = totalDurationMs != null ? new Date(match.startsAt).getTime() + totalDurationMs : null;
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
        expectedEndAt,
        subjectType: "LEAGUE",
      },
      secret,
    );

    return NextResponse.json({ ticket, expiresIn: REALTIME_TICKET_DEFAULT_TTL_SECONDS });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
