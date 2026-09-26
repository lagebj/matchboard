import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, createTestGroup } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

/**
 * ADR-0140 — Event clock persistence parity with League's ADR-0133 H2 contract. This mirrors
 * `live-match-integration.test.ts`'s "Live match session clock persistence" block, exercised
 * against real Event/EventMatch/EventLiveMatchSession fixtures.
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const auth = mockAuthContext({ userId: "test-coach", email: "coach@test.com" });

let db: PrismaClient;
let testOrgId: string;
let testGroupId: string;

async function createEventMatch() {
  const event = await db.event.create({
    data: {
      name: `Event-${Math.random().toString(36).slice(2, 8)}`,
      eventType: "CUP",
      startsAt: new Date("2028-01-01T09:00:00Z"),
      endsAt: new Date("2028-01-01T17:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      organisationId: testOrgId,
      footballGroupId: testGroupId,
    },
  });
  const squad = await db.eventSquad.create({
    data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
  });
  const match = await db.eventMatch.create({
    data: {
      eventId: event.id,
      eventSquadId: squad.id,
      category: "CUP",
      organisationId: testOrgId,
      opponentName: "Opponent",
      startsAt: new Date("2028-01-01T10:00:00Z"),
      status: "SCHEDULED",
    },
  });
  return match.id;
}

describe("Event live-match session clock persistence (ADR-0140 parity with League ADR-0133 H2)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-live-match-session-clock" },
      update: {},
      create: { name: "Test Org Event Live Match Session Clock", slug: "test-org-event-live-match-session-clock" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("a new session maps to the initial BEFORE clock", async () => {
    const { startEventLiveSession } = await import("../event-live-match-session");
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);
    expect(session.clock).toEqual({
      period: "BEFORE",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 0,
    });
  });

  it("round-trips a running clock so a reload rehydrates it", async () => {
    const { startEventLiveSession, getEventActiveSession, persistEventLiveSessionClock } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);
    const startedAt = new Date("2026-09-09T15:30:00.000Z");

    await persistEventLiveSessionClock(session.id, {
      period: "FIRST_HALF",
      running: true,
      startedAt,
      elapsedBeforeStartMs: 0,
    });

    const reloaded = await getEventActiveSession(eventMatchId);
    expect(reloaded!.clock.period).toBe("FIRST_HALF");
    expect(reloaded!.clock.running).toBe(true);
    expect(reloaded!.clock.startedAt?.getTime()).toBe(startedAt.getTime());
  });

  it("round-trips a paused clock with accumulated elapsed time", async () => {
    const { startEventLiveSession, getEventActiveSession, persistEventLiveSessionClock } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);

    await persistEventLiveSessionClock(session.id, {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 20 * 60 * 1000,
    });

    const reloaded = await getEventActiveSession(eventMatchId);
    expect(reloaded!.clock).toEqual({
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 20 * 60 * 1000,
    });
  });

  it("writes a forward period transition", async () => {
    const { startEventLiveSession, getEventActiveSession, persistEventLiveSessionClock } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);

    await persistEventLiveSessionClock(session.id, {
      period: "FIRST_HALF",
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    });
    await persistEventLiveSessionClock(session.id, {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 45 * 60 * 1000,
    });

    const reloaded = await getEventActiveSession(eventMatchId);
    expect(reloaded!.clock.period).toBe("HALF_TIME");
  });

  it("ignores a stale backward period transition (a reloaded client cannot stomp a running clock)", async () => {
    const { startEventLiveSession, getEventActiveSession, persistEventLiveSessionClock } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);

    await persistEventLiveSessionClock(session.id, {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 45 * 60 * 1000,
    });
    // Currently HALF_TIME. A client that briefly holds the fresh BEFORE state must not win.
    await persistEventLiveSessionClock(session.id, {
      period: "BEFORE",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 0,
    });

    const reloaded = await getEventActiveSession(eventMatchId);
    expect(reloaded!.clock.period).toBe("HALF_TIME");
  });

  it("does not persist a clock for an ENDED session", async () => {
    const { startEventLiveSession, endEventLiveSession, persistEventLiveSessionClock } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);
    const ended = await endEventLiveSession(session.id);
    expect(ended.status).toBe("ENDED");

    // No throw, just a no-op.
    await persistEventLiveSessionClock(session.id, {
      period: "SECOND_HALF",
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    });

    const row = await db.eventLiveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.clockPeriod).toBe("BEFORE");
  });

  it("does not persist a clock for a session belonging to a different organisation", async () => {
    const { startEventLiveSession, persistEventLiveSessionClock } = await import("../event-live-match-session");
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);

    const otherOrg = await db.organisation.create({ data: { name: "Other Org", slug: `other-org-${Math.random().toString(36).slice(2, 8)}` } });
    auth.updateOrganisationId(otherOrg.id);

    await persistEventLiveSessionClock(session.id, {
      period: "FIRST_HALF",
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    });

    auth.updateOrganisationId(testOrgId);
    const row = await db.eventLiveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.clockPeriod).toBe("BEFORE");
  });

  it("sets lastClockTransitionAt on every persisted clock transition, never on heartbeat (ADR-0152 §2)", async () => {
    const { startEventLiveSession, persistEventLiveSessionClock, heartbeatEventSession } = await import(
      "../event-live-match-session"
    );
    const eventMatchId = await createEventMatch();
    const session = await startEventLiveSession(eventMatchId);
    const created = await db.eventLiveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(created.lastClockTransitionAt).toBeNull();

    await persistEventLiveSessionClock(session.id, {
      period: "FIRST_HALF",
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    });
    const afterTransition = await db.eventLiveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(afterTransition.lastClockTransitionAt).not.toBeNull();
    const transitionTime = afterTransition.lastClockTransitionAt!.getTime();

    await heartbeatEventSession(session.id);
    const afterHeartbeat = await db.eventLiveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(afterHeartbeat.lastClockTransitionAt?.getTime()).toBe(transitionTime);
  });
});
