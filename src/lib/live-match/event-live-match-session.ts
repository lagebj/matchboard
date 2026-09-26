import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { persistedToClockState, clockStateToPersisted, isForwardClockTransition } from "./session-clock";
import { createInitialClockState } from "./match-clock";
import type { MatchClockState, MatchPeriod } from "./live-match-types";
import type { MatchFormatDefinition } from "./match-format";
import { resolveEventMatchFormatSnapshot } from "./format-snapshot";
import { snapshotToFormat } from "./resolve-live-period-config";

export interface EventLiveSessionInfo {
  id: string;
  eventMatchId: string;
  coachId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
  clock: MatchClockState;
  /** ADR-0146: the session's own frozen format snapshot, complete-or-null (League parity). */
  format: MatchFormatDefinition | null;
}

type EventLiveMatchSessionRow = {
  id: string;
  eventMatchId: string;
  coachId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
  clockPeriod: MatchPeriod;
  clockRunning: boolean;
  clockPeriodStartedAt: Date | null;
  clockElapsedBeforeMs: number;
  formatNumberOfPeriods: number | null;
  formatPeriodDurationMinutes: number | null;
  formatBreakDurationMinutes: number | null;
};

// Mirrors League's `toLiveSessionInfo` (`live-match-session.ts`) — one mapper shared by every
// return path below, so the clock is never manually rebuilt per call site.
function toEventLiveSessionInfo(row: EventLiveMatchSessionRow): EventLiveSessionInfo {
  return {
    id: row.id,
    eventMatchId: row.eventMatchId,
    coachId: row.coachId,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    lastHeartbeatAt: row.lastHeartbeatAt,
    format: snapshotToFormat(row),
    clock:
      persistedToClockState({
        clockPeriod: row.clockPeriod,
        clockRunning: row.clockRunning,
        clockPeriodStartedAt: row.clockPeriodStartedAt,
        clockElapsedBeforeMs: row.clockElapsedBeforeMs,
      }) ?? createInitialClockState(),
  };
}

export async function startEventLiveSession(eventMatchId: string): Promise<EventLiveSessionInfo> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

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
    return toEventLiveSessionInfo(existing);
  }

  if (existing && existing.status === "ENDED") {
    throw new Error("Live session has already ended. Create a new report or resume from post-match.");
  }

  // Effective match-format freeze (ADR-0146 §1) — see the identical League comment in
  // live-match-session.ts's startLiveSession().
  const formatSnapshot = await resolveEventMatchFormatSnapshot(eventMatchId);

  const session = await db.eventLiveMatchSession.create({
    data: {
      eventMatchId,
      coachId: ctx.userId,
      organisationId: ctx.organisationId,
      status: "ACTIVE",
      ...formatSnapshot,
    },
  });

  return toEventLiveSessionInfo(session);
}

export async function getEventActiveSession(eventMatchId: string): Promise<EventLiveSessionInfo | null> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId },
  });

  if (!session || session.status !== "ACTIVE") {
    return null;
  }

  if (session.organisationId !== ctx.organisationId) {
    return null;
  }

  return toEventLiveSessionInfo(session);
}

export async function endEventLiveSession(sessionId: string): Promise<EventLiveSessionInfo> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

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

  return toEventLiveSessionInfo(updated);
}

/**
 * Persist the Event live-match clock for an ACTIVE session — identical semantics to League's
 * `persistLiveSessionClock` (ADR-0133 H2 / ADR-0140 parity). Best-effort: a clock-persist
 * failure must never break event recording. Guarded so a stale/reloaded client cannot move the
 * stored period backwards over a running clock.
 *
 * ADR-0152 §2 — same `lastClockTransitionAt` semantics as League: set on every transition this
 * function persists, never on heartbeat or event recording.
 */
export async function persistEventLiveSessionClock(sessionId: string, clock: MatchClockState): Promise<void> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const session = await db.eventLiveMatchSession.findUnique({
    where: { id: sessionId },
    select: { organisationId: true, status: true, clockPeriod: true },
  });

  if (!session || session.organisationId !== ctx.organisationId || session.status !== "ACTIVE") {
    return;
  }

  if (!isForwardClockTransition(session.clockPeriod, clock.period)) {
    return;
  }

  const now = new Date();
  await db.eventLiveMatchSession.update({
    where: { id: sessionId },
    data: { ...clockStateToPersisted(clock), clockUpdatedAt: now, lastClockTransitionAt: now },
  });
}

export async function heartbeatEventSession(sessionId: string): Promise<void> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

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