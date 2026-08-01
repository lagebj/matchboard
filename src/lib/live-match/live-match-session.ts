import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import type { LiveSessionInfo } from "./live-match-types";

export async function startLiveSession(matchId: string): Promise<LiveSessionInfo> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, organisationId: true },
  });

  if (!match) {
    throw new Error("Match not found");
  }

  if (orgFilter.type === "org" && match.organisationId !== orgFilter.organisationId) {
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
      coachId: coach.id ?? "",
      organisationId: orgFilter.type === "org" ? orgFilter.organisationId : null,
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
  await requireCoachAccess();

  const session = await db.liveMatchSession.findUnique({
    where: { matchId },
  });

  if (!session || session.status !== "ACTIVE") {
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
  await requireCoachAccess();

  const session = await db.liveMatchSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
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
  await db.liveMatchSession.update({
    where: { id: sessionId },
    data: { lastHeartbeatAt: new Date() },
  });
}