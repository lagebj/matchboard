import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { LiveSessionInfo } from "./live-match-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { ensureMatchPlanningBaselineCaptured } from "@/lib/selection/capture-planning-baseline";
import { persistedToClockState, clockStateToPersisted, isForwardClockTransition } from "./session-clock";
import { createInitialClockState } from "./match-clock";
import type { MatchClockState } from "./live-match-types";

type LiveMatchSessionRow = {
  id: string;
  matchId: string;
  coachId: string;
  status: LiveSessionInfo["status"];
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
  clockPeriod: LiveSessionInfo["clock"]["period"];
  clockRunning: boolean;
  clockPeriodStartedAt: Date | null;
  clockElapsedBeforeMs: number;
};

function toLiveSessionInfo(row: LiveMatchSessionRow): LiveSessionInfo {
  return {
    id: row.id,
    matchId: row.matchId,
    coachId: row.coachId,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    lastHeartbeatAt: row.lastHeartbeatAt,
    clock:
      persistedToClockState({
        clockPeriod: row.clockPeriod,
        clockRunning: row.clockRunning,
        clockPeriodStartedAt: row.clockPeriodStartedAt,
        clockElapsedBeforeMs: row.clockElapsedBeforeMs,
      }) ?? createInitialClockState(),
  };
}

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
    return toLiveSessionInfo(existing);
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

  // Live activity starting is the earliest planning boundary (ADR-0109 §2, D4): capture the
  // planned baseline immediately, even if scheduled kickoff has not arrived yet.
  await ensureMatchPlanningBaselineCaptured(matchId, { force: true });

  return toLiveSessionInfo(session);
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

  return toLiveSessionInfo(session);
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

  return toLiveSessionInfo(updated);
}

/**
 * Persist the match clock for an ACTIVE session (ADR-0133 H2). Best-effort — a clock-persist
 * failure must never break event recording; the caller swallows errors. The write is guarded
 * so a stale / reloaded client that briefly holds the fresh `BEFORE` state cannot move the
 * stored period backwards over a running clock.
 */
export async function persistLiveSessionClock(sessionId: string, clock: MatchClockState): Promise<void> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.liveMatchSession.findUnique({
    where: { id: sessionId },
    select: { organisationId: true, status: true, clockPeriod: true },
  });

  if (!session || session.organisationId !== ctx.organisationId || session.status !== "ACTIVE") {
    return;
  }

  if (!isForwardClockTransition(session.clockPeriod, clock.period)) {
    return;
  }

  await db.liveMatchSession.update({
    where: { id: sessionId },
    data: { ...clockStateToPersisted(clock), clockUpdatedAt: new Date() },
  });
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