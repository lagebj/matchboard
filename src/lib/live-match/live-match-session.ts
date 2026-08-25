import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { LiveSessionInfo } from "./live-match-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function startLiveSession(matchId: string): Promise<LiveSessionInfo> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, organisationId: true },
  });

  if (!match) {
    throw new Error("Match not found");
  }

  if (match.organisationId !== ctx.organisationId) {
    throw new Error("Match not found or access denied");
  }

  const existing = await db.liveMatchSession.findUnique({
    where: { matchId },
  });

  if (existing && existing.status === "ACTIVE") {
    return {
      id: existing.id,
      matchId: existing.matchId,
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

  const session = await db.liveMatchSession.create({
    data: {
      matchId,
      coachId: ctx.userId,
      organisationId: ctx.organisationId,
      status: "ACTIVE",
    },
  });

  return {
    id: session.id,
    matchId: session.matchId,
    coachId: session.coachId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
  };
}

export async function getActiveSession(matchId: string): Promise<LiveSessionInfo | null> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.liveMatchSession.findUnique({
    where: { matchId },
  });

  if (!session || session.status !== "ACTIVE") {
    return null;
  }

  if (session.organisationId !== ctx.organisationId) {
    return null;
  }

  return {
    id: session.id,
    matchId: session.matchId,
    coachId: session.coachId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
  };
}

export async function endLiveSession(sessionId: string): Promise<LiveSessionInfo> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.liveMatchSession.findUnique({
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

  const updated = await db.liveMatchSession.update({
    where: { id: sessionId },
    data: {
      status: "ENDED",
      endedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    matchId: updated.matchId,
    coachId: updated.coachId,
    status: updated.status,
    startedAt: updated.startedAt,
    endedAt: updated.endedAt,
    lastHeartbeatAt: updated.lastHeartbeatAt,
  };
}

export async function heartbeatSession(sessionId: string): Promise<void> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.liveMatchSession.findUnique({
    where: { id: sessionId },
    select: { id: true, organisationId: true },
  });

  if (!session || session.organisationId !== ctx.organisationId) {
    return;
  }

  await db.liveMatchSession.update({
    where: { id: sessionId },
    data: { lastHeartbeatAt: new Date() },
  });
}