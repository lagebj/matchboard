import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { requireCoachAccess } from "@/lib/auth";
import type { LiveMatchEventType, LiveEventCorrectionType, MatchPeriod } from "./live-match-types";
import { MATCH_PERIOD_ORDER } from "./live-match-types";
import type { LiveEventInput, LiveEventSummary } from "./live-match-types";
import { validateLiveEventInput } from "./live-match-domain";

export async function recordEvent(input: LiveEventInput): Promise<{ eventId: string }> {
  const ctx = await requireActorContext();

  const session = await db.liveMatchSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, status: true, matchId: true, organisationId: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "ACTIVE") {
    throw new Error("Session is not active");
  }

  if (session.matchId !== input.matchId) {
    throw new Error("Session does not belong to this match");
  }

  if (ctx.orgFilter.type === "org" && session.organisationId !== ctx.organisationId) {
    throw new Error("Session not found or access denied");
  }

  const validationError = validateLiveEventInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  if (input.clientEventId) {
    const existing = await db.liveMatchEvent.findUnique({
      where: { clientEventId: input.clientEventId },
      select: { id: true },
    });
    if (existing) {
      return { eventId: existing.id };
    }
  }

  const event = await db.liveMatchEvent.create({
    data: {
      matchId: input.matchId,
      sessionId: input.sessionId,
      eventType: input.eventType as LiveMatchEventType,
      period: input.period ? MATCH_PERIOD_ORDER.indexOf(input.period) : undefined,
      matchSeconds: input.matchSeconds,
      wallClockTime: new Date(),
      playerId: input.playerId,
      secondaryPlayerId: input.secondaryPlayerId,
      payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : undefined,
      correctionType: input.correctionType as LiveEventCorrectionType | undefined,
      correctsEventId: input.correctsEventId,
      clientEventId: input.clientEventId,
      organisationId: session.organisationId,
    },
  });

  return { eventId: event.id };
}

export async function getMatchEvents(matchId: string): Promise<LiveEventSummary[]> {
  await requireCoachAccess();

  const events = await db.liveMatchEvent.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventType: true,
      period: true,
      matchSeconds: true,
      wallClockTime: true,
      playerId: true,
      secondaryPlayerId: true,
      correctionType: true,
      correctsEventId: true,
    },
  });

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType as LiveMatchEventType,
    period: e.period as MatchPeriod | null,
    matchSeconds: e.matchSeconds,
    wallClockTime: e.wallClockTime,
    playerId: e.playerId,
    secondaryPlayerId: e.secondaryPlayerId,
    isCorrected: e.correctionType === "CORRECTION",
    isReversed: e.correctionType === "REVERSAL",
  }));
}

export async function getRecentEvents(
  matchId: string,
  limit: number = 10,
): Promise<LiveEventSummary[]> {
  await requireCoachAccess();

  const events = await db.liveMatchEvent.findMany({
    where: { matchId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      period: true,
      matchSeconds: true,
      wallClockTime: true,
      playerId: true,
      secondaryPlayerId: true,
      correctionType: true,
      correctsEventId: true,
    },
  });

  return events.reverse().map((e) => ({
    id: e.id,
    eventType: e.eventType as LiveMatchEventType,
    period: e.period as MatchPeriod | null,
    matchSeconds: e.matchSeconds,
    wallClockTime: e.wallClockTime,
    playerId: e.playerId,
    secondaryPlayerId: e.secondaryPlayerId,
    isCorrected: e.correctionType === "CORRECTION",
    isReversed: e.correctionType === "REVERSAL",
  }));
}