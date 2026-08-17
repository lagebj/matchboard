import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { LiveMatchEventType, LiveEventCorrectionType, MatchPeriod } from "@/generated/prisma/client";
import type { LiveEventSummary } from "./live-match-types";

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
}

export async function recordEventEvent(input: EventLiveEventInput) {
  const ctx = await requireActorContext();

  const match = await db.eventMatch.findFirst({
    where: { id: input.eventMatchId, event: ctx.orgFilter.filter },
    select: { id: true, organisationId: true },
  });

  if (!match) {
    throw new Error("Event match not found or access denied");
  }

  if (input.clientEventId) {
    const existing = await db.eventLiveMatchEvent.findFirst({
      where: { clientEventId: input.clientEventId, ...ctx.orgFilter.filter },
    });
    if (existing) return existing;
  }

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
      organisationId: ctx.organisationId,
    },
  });

  return event;
}

export async function getEventMatchEvents(eventMatchId: string) {
  const ctx = await requireActorContext();

  const events = await db.eventLiveMatchEvent.findMany({
    where: { eventMatchId, organisationId: ctx.organisationId },
    orderBy: { createdAt: "asc" },
  });

  return events.map(toSummary);
}

export async function getRecentEventEvents(eventMatchId: string, limit = 10) {
  const ctx = await requireActorContext();

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
  };
}