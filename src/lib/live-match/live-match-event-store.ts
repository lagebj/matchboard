import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { runWithTenantOrganisationId, setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { LiveMatchEventType, LiveEventCorrectionType, MatchPeriod } from "./live-match-types";
import { MATCH_PERIOD_ORDER } from "./live-match-types";
import type { LiveEventInput, LiveEventSummary } from "./live-match-types";
import { validateLiveEventInput } from "./live-match-domain";
import type { CanonicalLiveEvent } from "./realtime/realtime-messages";

/**
 * A rejection `recordEventForActor` throws intentionally, for a request that is invalid on
 * its own terms and will never succeed no matter how many times it's retried (session
 * missing/inactive, session/match/org mismatch, failed domain validation). Distinct from an
 * unexpected error (Prisma/network failure) so `/api/internal/live-match/events` (Stage 4)
 * can return a different status for each, and the Durable Object's outbox (Stage 6,
 * `classifyPersistenceFailure` in `workers/live-match/src/state.ts`) can tell "never retry
 * this" apart from "this is transient, keep retrying" using nothing more than the HTTP status
 * it already gets back.
 */
export class LiveMatchDomainError extends Error {}

/**
 * live-match-realtime-programme SPEC.md §19 — the actor-scoped core of event persistence,
 * split out of `recordEvent()` so the internal signed persistence endpoint
 * (`/api/internal/live-match/events`, Stage 4) can call it with an explicit,
 * already-authenticated `actor` instead of resolving one from a session cookie via
 * `requireActorContext()`. `recordEvent()` below is now a thin wrapper preserving the exact
 * original browser/server-action behavior — same checks, same errors, same return shape.
 *
 * Every check this function performs (session exists/active, session belongs to the claimed
 * match, session's organisation matches the actor's) is independent of *how* the actor was
 * authenticated — the internal endpoint still must not skip any of it just because the caller
 * arrived via a signed Worker request rather than a browser session (SPEC.md §19: "internal
 * realtime endpoint may call recordEventForActor only after... match/session/org consistency
 * validation").
 */
export async function recordEventForActor(
  input: LiveEventInput,
  actor: { userId: string; organisationId: string },
): Promise<CanonicalLiveEvent> {
  // Scoped by the caller's already-authenticated organisationId (ADR-0087) — trusted whether
  // `actor` came from a browser session (`recordEvent()` below, via `requireActorContext()`) or
  // from the HMAC-verified internal Worker endpoint (`/api/internal/live-match/events`, which
  // resolves its own actor before calling this function). This makes every RLS-scoped query
  // below auto-scoped by the tenantRLS extension, not just protected by the manual
  // `session.organisationId !== actor.organisationId` check.
  return runWithTenantOrganisationId(actor.organisationId, async () => {
    const session = await db.liveMatchSession.findUnique({
      where: { id: input.sessionId },
      select: { id: true, status: true, matchId: true, organisationId: true },
    });

    if (!session) {
      throw new LiveMatchDomainError("Session not found");
    }

    if (session.status !== "ACTIVE") {
      throw new LiveMatchDomainError("Session is not active");
    }

    if (session.matchId !== input.matchId) {
      throw new LiveMatchDomainError("Session does not belong to this match");
    }

    if (session.organisationId !== actor.organisationId) {
      throw new LiveMatchDomainError("Session not found or access denied");
    }

    const validationError = validateLiveEventInput(input);
    if (validationError) {
      throw new LiveMatchDomainError(validationError);
    }

    if (input.clientEventId) {
      // Idempotency (SPEC.md §20 step 7, §35): the realtime broadcast side-channel added in the
      // "Follow live" PR sends the same clientEventId the HTTP path already persisted, and the
      // HTTP call always completes first (recordLiveEventAction awaits before the broadcast is
      // even attempted) — this dedup path is what makes it safe for both to eventually reach
      // recordEventForActor for the same event without creating a duplicate canonical row.
      const existing = await db.liveMatchEvent.findUnique({
        where: { clientEventId: input.clientEventId },
        select: { id: true, clientEventId: true, eventType: true, createdAt: true },
      });
      if (existing) {
        return {
          id: existing.id,
          clientEventId: existing.clientEventId ?? input.clientEventId,
          eventType: existing.eventType,
          createdAt: existing.createdAt.toISOString(),
          playerId: input.playerId ?? undefined,
          secondaryPlayerId: input.secondaryPlayerId ?? undefined,
        };
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

    return {
      id: event.id,
      clientEventId: input.clientEventId,
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString(),
      playerId: input.playerId ?? undefined,
      secondaryPlayerId: input.secondaryPlayerId ?? undefined,
    };
  });
}

export async function recordEvent(input: LiveEventInput): Promise<{ eventId: string }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const canonical = await recordEventForActor(input, {
    userId: ctx.userId,
    organisationId: ctx.organisationId,
  });
  return { eventId: canonical.id };
}

export async function getMatchEvents(matchId: string): Promise<LiveEventSummary[]> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const events = await db.liveMatchEvent.findMany({
    where: { matchId, organisationId: ctx.organisationId },
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
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const events = await db.liveMatchEvent.findMany({
    where: { matchId, organisationId: ctx.organisationId },
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