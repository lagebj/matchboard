import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { startLiveSession, endLiveSession, getActiveSession, heartbeatSession } from "../live-match-session";
import { recordEvent, getMatchEvents, getRecentEvents } from "../live-match-event-store";
import { validateLiveEventInput, isValidEventType, isGoalEventType, isPeriodTransition } from "../live-match-domain";
import {
  createInitialClockState,
  getElapsedMs,
  formatElapsedMs,
  advancePeriod,
  pauseClock,
  resumeClock,
  adjustClock,
  isPlayingPeriod,
  isMatchOver,
  getPeriodNumber,
} from "../match-clock";

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "coach@test.com" }),
}));

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;
let matchId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
  matchId = Object.values(fixture.matches)[0];
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Live match session lifecycle", () => {
  it("starts a session for a match", async () => {
    const session = await startLiveSession(matchId);
    expect(session).toBeDefined();
    expect(session.matchId).toBe(matchId);
    expect(session.status).toBe("ACTIVE");
    expect(session.coachId).toBe("test-coach");
  });

  it("returns existing active session on repeated start", async () => {
    const session1 = await startLiveSession(matchId);
    const session2 = await startLiveSession(matchId);
    expect(session1.id).toBe(session2.id);
  });

  it("gets active session for a match", async () => {
    const session = await getActiveSession(matchId);
    expect(session).toBeDefined();
    expect(session!.status).toBe("ACTIVE");
  });

  it("returns null for a match with no active session", async () => {
    const session = await getActiveSession("nonexistent-match");
    expect(session).toBeNull();
  });

  it("updates heartbeat", async () => {
    const session = await getActiveSession(matchId);
    expect(session).toBeDefined();
    await heartbeatSession(session!.id);
    const updated = await getActiveSession(matchId);
    expect(updated).toBeDefined();
    expect(updated!.lastHeartbeatAt).not.toBeNull();
  });

  it("ends a session", async () => {
    const session = await getActiveSession(matchId);
    expect(session).toBeDefined();
    const ended = await endLiveSession(session!.id);
    expect(ended.status).toBe("ENDED");
    expect(ended.endedAt).not.toBeNull();
  });

  it("throws when ending a non-active session", async () => {
    const session = await getActiveSession(matchId);
    expect(session).toBeNull();
    await expect(endLiveSession("nonexistent-session")).rejects.toThrow();
  });
});

describe("Live match event recording", () => {
  let sessionId: string;

  beforeAll(async () => {
    await testDb.liveMatchEvent.deleteMany({ where: { matchId } });
    await testDb.liveMatchSession.deleteMany({ where: { matchId } });
    const session = await startLiveSession(matchId);
    sessionId = session.id;
  });

  it("records a goal for event", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "GOAL_FOR",
      period: "FIRST_HALF",
      matchSeconds: 300000,
      playerId: fixture.players[0].id,
      clientEventId: "evt-goal-1",
    });
    expect(result.eventId).toBeDefined();
  });

  it("rejects duplicate clientEventId (idempotency)", async () => {
    const result1 = await recordEvent({
      matchId,
      sessionId,
      eventType: "GOAL_AGAINST",
      period: "FIRST_HALF",
      matchSeconds: 600000,
      clientEventId: "evt-dup-test",
    });
    const result2 = await recordEvent({
      matchId,
      sessionId,
      eventType: "GOAL_AGAINST",
      period: "FIRST_HALF",
      matchSeconds: 600000,
      clientEventId: "evt-dup-test",
    });
    expect(result1.eventId).toBe(result2.eventId);
  });

  it("records a rotation event", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "ROTATION_OUT",
      playerId: fixture.players[0].id,
      clientEventId: "evt-rot-out-1",
    });
    expect(result.eventId).toBeDefined();
  });

  it("records a fair play positive event", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "FAIR_PLAY_POSITIVE",
      playerId: fixture.players[1]?.id ?? fixture.players[0].id,
      clientEventId: "evt-fp-pos-1",
    });
    expect(result.eventId).toBeDefined();
  });

  it("records a marked moment event", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "MOMENT_MARKED",
      clientEventId: "evt-moment-1",
    });
    expect(result.eventId).toBeDefined();
  });

  it("rejects event for inactive session", async () => {
    await expect(
      recordEvent({
        matchId,
        sessionId: "nonexistent-session",
        eventType: "GOAL_FOR",
        clientEventId: "evt-inactive-1",
      }),
    ).rejects.toThrow();
  });

  it("retrieves match events", async () => {
    const events = await getMatchEvents(matchId);
    expect(events.length).toBeGreaterThanOrEqual(4);
  });

  it("retrieves recent events with limit", async () => {
    const events = await getRecentEvents(matchId, 3);
    expect(events.length).toBeLessThanOrEqual(3);
  });
});

describe("Live match domain validation", () => {
  it("validates required fields", () => {
    expect(validateLiveEventInput({ matchId: "", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "c1" })).toBe("matchId is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "", eventType: "GOAL_FOR", clientEventId: "c1" })).toBe("sessionId is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "" as any, clientEventId: "c1" })).toBe("eventType is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "" })).toBe("clientEventId is required");
  });

  it("validates event type", () => {
    expect(isValidEventType("GOAL_FOR")).toBe(true);
    expect(isValidEventType("INVALID_TYPE")).toBe(false);
  });

  it("requires playerId for certain event types", () => {
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "c1" })).toContain("requires a playerId");
  });

  it("classifies event types correctly", () => {
    expect(isGoalEventType("GOAL_FOR")).toBe(true);
    expect(isGoalEventType("GOAL_AGAINST")).toBe(true);
    expect(isGoalEventType("MOMENT_MARKED")).toBe(false);

    expect(isPeriodTransition("MATCH_START")).toBe(true);
    expect(isPeriodTransition("GOAL_FOR")).toBe(false);
  });
});

describe("Match clock", () => {
  it("creates initial state in BEFORE period", () => {
    const clock = createInitialClockState();
    expect(clock.period).toBe("BEFORE");
    expect(clock.running).toBe(false);
    expect(clock.elapsedBeforeStartMs).toBe(0);
  });

  it("advances through periods in order", () => {
    let clock = createInitialClockState();
    clock = advancePeriod(clock);
    expect(clock.period).toBe("FIRST_HALF");
    expect(clock.running).toBe(true);

    clock = advancePeriod(clock);
    expect(clock.period).toBe("HALF_TIME");
    expect(clock.running).toBe(false);

    clock = advancePeriod(clock);
    expect(clock.period).toBe("SECOND_HALF");
    expect(clock.running).toBe(true);
  });

  it("pauses and resumes correctly", () => {
    let clock = createInitialClockState();
    clock = advancePeriod(clock);
    expect(clock.running).toBe(true);

    const nowMs = Date.now();
    clock = pauseClock(clock, nowMs);
    expect(clock.running).toBe(false);
    expect(clock.elapsedBeforeStartMs).toBeGreaterThan(0);

    clock = resumeClock(clock);
    expect(clock.running).toBe(true);
  });

  it("adjusts clock time", () => {
    const clock = { ...createInitialClockState(), elapsedBeforeStartMs: 10000 };
    const adjusted = adjustClock(clock, -5000);
    expect(adjusted.elapsedBeforeStartMs).toBe(5000);
  });

  it("formats elapsed time correctly", () => {
    expect(formatElapsedMs(0)).toBe("0:00");
    expect(formatElapsedMs(65000)).toBe("1:05");
    expect(formatElapsedMs(1500000)).toBe("25:00");
  });

  it("identifies playing periods", () => {
    expect(isPlayingPeriod("FIRST_HALF")).toBe(true);
    expect(isPlayingPeriod("SECOND_HALF")).toBe(true);
    expect(isPlayingPeriod("HALF_TIME")).toBe(false);
    expect(isPlayingPeriod("BEFORE")).toBe(false);
  });

  it("identifies match over", () => {
    expect(isMatchOver("FULL_TIME")).toBe(true);
    expect(isMatchOver("FIRST_HALF")).toBe(false);
  });

  it("gets period numbers", () => {
    expect(getPeriodNumber("BEFORE")).toBe(0);
    expect(getPeriodNumber("FIRST_HALF")).toBe(1);
    expect(getPeriodNumber("FULL_TIME")).toBe(7);
  });
});