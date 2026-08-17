import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";

export interface EventLiveSessionInfo {
  id: string;
  eventMatchId: string;
  coachId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
}

export async function startEventLiveSession(eventMatchId: string): Promise<EventLiveSessionInfo> {
  const ctx = await requireActorContext();

  const match = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    select: { id: true, organisationId: true },
  });

  if (!match) {
    throw new Error("Event match not found");
  }

  if (match.organisationId !== ctx.organisationId) {
    throw new Error("Event match not found or access denied");
  }

  const existing = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId },
  });

  if (existing && existing.status === "ACTIVE") {
    return {
      id: existing.id,
      eventMatchId: existing.eventMatchId,
      coachId: existing.coachId,
      status: existing.status,
      startedAt: existing.startedAt,
      endedAt: existing.endedAt,
      lastHeartbeatAt: existing.lastHeartbeatAt,
    };
  }

  if (existing && existing.status === "ENDED") {
    throw new Error("Live session has already ended. Create a new report or resume from post-match.");
  }

  const session = await db.eventLiveMatchSession.create({
    data: {
      eventMatchId,
      coachId: ctx.userId,
      organisationId: ctx.organisationId,
      status: "ACTIVE",
    },
  });

  return {
    id: session.id,
    eventMatchId: session.eventMatchId,
    coachId: session.coachId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
  };
}

export async function getEventActiveSession(eventMatchId: string): Promise<EventLiveSessionInfo | null> {
  const ctx = await requireActorContext();

  const session = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId },
  });

  if (!session || session.status !== "ACTIVE") {
    return null;
  }

  if (session.organisationId !== ctx.organisationId) {
    return null;
  }

  return {
    id: session.id,
    eventMatchId: session.eventMatchId,
    coachId: session.coachId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
  };
}

export async function endEventLiveSession(sessionId: string): Promise<EventLiveSessionInfo> {
  const ctx = await requireActorContext();

  const session = await db.eventLiveMatchSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.organisationId !== ctx.organisationId) {
    throw new Error("Session not found or access denied");
  }

  if (session.status !== "ACTIVE") {
    throw new Error("Session is not active");
  }

  const updated = await db.eventLiveMatchSession.update({
    where: { id: sessionId },
    data: {
      status: "ENDED",
      endedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    eventMatchId: updated.eventMatchId,
    coachId: updated.coachId,
    status: updated.status,
    startedAt: updated.startedAt,
    endedAt: updated.endedAt,
    lastHeartbeatAt: updated.lastHeartbeatAt,
  };
}

export async function heartbeatEventSession(sessionId: string): Promise<void> {
  const ctx = await requireActorContext();

  const session = await db.eventLiveMatchSession.findUnique({
    where: { id: sessionId },
    select: { id: true, organisationId: true },
  });

  if (!session || session.organisationId !== ctx.organisationId) {
    return;
  }

  await db.eventLiveMatchSession.update({
    where: { id: sessionId },
    data: { lastHeartbeatAt: new Date() },
  });
}