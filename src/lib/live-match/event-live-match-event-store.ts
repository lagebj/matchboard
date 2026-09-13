import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { Prisma } from "@/generated/prisma/client";
import type { LiveMatchEventType, LiveEventCorrectionType, MatchPeriod } from "@/generated/prisma/client";
import type { LiveEventSummary } from "./live-match-types";
import { runWithTenantOrganisationId, setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { derivePositionChangeFromPayload } from "./live-match-domain";
import type { CanonicalLiveEvent } from "./realtime/realtime-messages";
import { LiveMatchDomainError, LiveMatchSequenceIntegrityError, uniqueConstraintTarget } from "./live-match-event-store";

export interface EventLiveEventInput {
  eventMatchId: string;
  sessionId: string;
  eventType: LiveMatchEventType;
  period?: MatchPeriod;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  clientEventId: string;
  correctionType?: LiveEventCorrectionType;
  correctsEventId?: string;
  /** ADR-0138 (Bundle 2) schema/type parity with League's `LiveEventInput`. Always populated
   * from Bundle 8 onward — every write goes through the Durable Object coordinator
   * (`recordEventForActorEvent` below), which always has a coordinator-assigned sequence. */
  sequence?: number;
  acceptedAtMs?: number;
  clientCapturedAtMs?: number;
  originClientId?: string;
}

/**
 * ADR-0138 Bundle 8 — the Event equivalent of `live-match-event-store.ts`'s League actor-scoped
 * recorder, mirroring it exactly (session-active check, `clientEventId`
 * idempotency, sequence-collision handling) but against `db.eventLiveMatchEvent`/
 * `db.eventLiveMatchSession` — kept as a genuinely separate, explicit function rather than a
 * shared generic, per D19's own allowance ("League and Event may keep separate Prisma
 * tables/adapters if that remains simpler") and matching this file's own pre-existing
 * parallel-to-League convention. This is the function the internal HMAC-only persistence
 * endpoint (`/api/internal/live-match/events`) calls for an Event-subject request, closing
 * ARR-0046's "Event has zero coordinator involvement" finding — the same coordinator (Durable
 * Object) now assigns and threads a real `sequence` for Event matches too, not just League.
 */
export async function recordEventForActorEvent(
  input: EventLiveEventInput,
  actor: { userId: string; organisationId: string },
): Promise<CanonicalLiveEvent> {
  return runWithTenantOrganisationId(actor.organisationId, async () => {
    const session = await db.eventLiveMatchSession.findUnique({
      where: { id: input.sessionId },
      select: { id: true, status: true, eventMatchId: true, organisationId: true },
    });

    if (!session) {
      throw new LiveMatchDomainError("Session not found");
    }
    if (session.status !== "ACTIVE") {
      throw new LiveMatchDomainError("Session is not active");
    }
    if (session.eventMatchId !== input.eventMatchId) {
      throw new LiveMatchDomainError("Session does not belong to this event match");
    }
    if (session.organisationId !== actor.organisationId) {
      throw new LiveMatchDomainError("Session not found or access denied");
    }

    if (input.clientEventId) {
      const existing = await db.eventLiveMatchEvent.findUnique({
        where: { clientEventId: input.clientEventId },
        select: { id: true, clientEventId: true, eventType: true, createdAt: true, sequence: true, correctionType: true, correctsEventId: true },
      });
      if (existing) return toCanonicalLiveEventForEvent(existing, input);
    }

    try {
      const event = await db.eventLiveMatchEvent.create({
        data: {
          eventMatchId: input.eventMatchId,
          sessionId: input.sessionId,
          eventType: input.eventType,
          period: input.period ?? null,
          matchSeconds: input.matchSeconds ?? null,
          playerId: input.playerId ?? null,
          secondaryPlayerId: input.secondaryPlayerId ?? null,
          payload: input.payload ? (input.payload as unknown as object) : undefined,
          correctionType: input.correctionType ?? null,
          correctsEventId: input.correctsEventId ?? null,
          clientEventId: input.clientEventId ?? null,
          organisationId: session.organisationId,
          sequence: input.sequence,
          acceptedAt: input.acceptedAtMs != null ? new Date(input.acceptedAtMs) : undefined,
          clientCapturedAt: input.clientCapturedAtMs != null ? new Date(input.clientCapturedAtMs) : undefined,
          originClientId: input.originClientId,
        },
      });
      return toCanonicalLiveEventForEvent(event, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = uniqueConstraintTarget(error);

        if (target.includes("clientEventId") && input.clientEventId) {
          const existing = await db.eventLiveMatchEvent.findUnique({
            where: { clientEventId: input.clientEventId },
            select: { id: true, clientEventId: true, eventType: true, createdAt: true, sequence: true, correctionType: true, correctsEventId: true },
          });
          if (existing) return toCanonicalLiveEventForEvent(existing, input);
        }

        if (target.includes("sequence") && input.sequence != null) {
          throw new LiveMatchSequenceIntegrityError(
            `Sequence ${input.sequence} is already assigned to a different event in session ${input.sessionId}`,
          );
        }
      }
      throw error;
    }
  });
}

function toCanonicalLiveEventForEvent(
  event: {
    id: string;
    clientEventId: string | null;
    eventType: string;
    createdAt: Date;
    sequence: number | null;
    correctionType: LiveEventCorrectionType | null;
    correctsEventId: string | null;
  },
  input: EventLiveEventInput,
): CanonicalLiveEvent {
  return {
    id: event.id,
    clientEventId: event.clientEventId ?? input.clientEventId,
    eventType: event.eventType,
    createdAt: event.createdAt.toISOString(),
    playerId: input.playerId ?? undefined,
    secondaryPlayerId: input.secondaryPlayerId ?? undefined,
    period: input.period ?? undefined,
    matchSeconds: input.matchSeconds ?? undefined,
    positionChange: derivePositionChangeFromPayload(event.eventType, input.payload),
    sequence: event.sequence,
    correctionType: event.correctionType as CanonicalLiveEvent["correctionType"],
    correctsEventId: event.correctsEventId,
    capturedAtClientMs: input.clientCapturedAtMs,
  };
}

export async function getEventMatchEvents(eventMatchId: string) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const events = await db.eventLiveMatchEvent.findMany({
    where: { eventMatchId, organisationId: ctx.organisationId },
    orderBy: { createdAt: "asc" },
  });

  return events.map(toSummary);
}

export async function getRecentEventEvents(eventMatchId: string, limit = 10) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const events = await db.eventLiveMatchEvent.findMany({
    where: { eventMatchId, organisationId: ctx.organisationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.reverse().map(toSummary);
}

function toSummary(event: {
  id: string;
  eventType: LiveMatchEventType;
  period: MatchPeriod | null;
  matchSeconds: number | null;
  wallClockTime: Date | null;
  playerId: string | null;
  secondaryPlayerId: string | null;
  correctionType: LiveEventCorrectionType | null;
  correctsEventId: string | null;
  payload?: Prisma.JsonValue | null;
}): LiveEventSummary {
  return {
    id: event.id,
    eventType: event.eventType,
    period: event.period,
    matchSeconds: event.matchSeconds,
    wallClockTime: event.wallClockTime,
    playerId: event.playerId,
    secondaryPlayerId: event.secondaryPlayerId,
    isCorrected: event.correctionType === "CORRECTION",
    isReversed: event.correctionType === "REVERSAL",
    correctsEventId: event.correctsEventId ?? null,
    positionChange: derivePositionChangeFromPayload(event.eventType, event.payload),
  };
}