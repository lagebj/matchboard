import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { startLiveSession, endLiveSession, getActiveSession, heartbeatSession, persistLiveSessionClock } from "../live-match-session";
import {
  recordEvent,
  recordEventForActor,
  getMatchEvents,
  getRecentEvents,
  LiveMatchSequenceIntegrityError,
} from "../live-match-event-store";
import { validateLiveEventInput, isValidEventType, isGoalEventType, isPeriodTransition } from "../live-match-domain";
import type { LiveMatchEventType } from "@/generated/prisma/client";
import {
  createInitialClockState,
  formatElapsedMs,
  advancePeriod,
  pauseClock,
  resumeClock,
  adjustClock,
  isPlayingPeriod,
  isMatchOver,
  getPeriodNumber,
} from "../match-clock";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ userId: "test-coach", email: "coach@test.com" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;
let matchId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
  auth.updateOrganisationId(fixture.organisationId);
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

describe("Live match session clock persistence (ADR-0133 H2)", () => {
  let clockMatchId: string;

  beforeAll(async () => {
    // A fresh match so this block is independent of the ended session above.
    clockMatchId = Object.values(fixture.matches)[1];
    await startLiveSession(clockMatchId);
  });

  it("defaults to a fresh 'before kickoff' clock", async () => {
    const session = await getActiveSession(clockMatchId);
    expect(session!.clock).toEqual({
      period: "BEFORE",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 0,
    });
  });

  it("round-trips a running clock so a reload rehydrates it", async () => {
    const session = await getActiveSession(clockMatchId);
    const startedAt = new Date("2026-09-09T15:30:00.000Z");
    await persistLiveSessionClock(session!.id, {
      period: "FIRST_HALF",
      running: true,
      startedAt,
      elapsedBeforeStartMs: 0,
    });

    const reloaded = await getActiveSession(clockMatchId);
    expect(reloaded!.clock.period).toBe("FIRST_HALF");
    expect(reloaded!.clock.running).toBe(true);
    expect(reloaded!.clock.startedAt?.getTime()).toBe(startedAt.getTime());
  });

  it("round-trips a paused clock with accumulated elapsed time", async () => {
    const session = await getActiveSession(clockMatchId);
    await persistLiveSessionClock(session!.id, {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 20 * 60 * 1000,
    });

    const reloaded = await getActiveSession(clockMatchId);
    expect(reloaded!.clock).toEqual({
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 20 * 60 * 1000,
    });
  });

  it("refuses to move the persisted period backwards (a stale/reloaded client cannot stomp a running clock)", async () => {
    const session = await getActiveSession(clockMatchId);
    // Currently HALF_TIME. A client that briefly holds the fresh BEFORE state must not win.
    await persistLiveSessionClock(session!.id, {
      period: "BEFORE",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 0,
    });

    const reloaded = await getActiveSession(clockMatchId);
    expect(reloaded!.clock.period).toBe("HALF_TIME");
  });

  it("does not persist a clock for an ENDED session", async () => {
    const session = await getActiveSession(clockMatchId);
    const ended = await endLiveSession(session!.id);
    expect(ended.status).toBe("ENDED");
    // No throw, just a no-op.
    await persistLiveSessionClock(session!.id, {
      period: "SECOND_HALF",
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    });
    const row = await testDb.liveMatchSession.findUniqueOrThrow({ where: { matchId: clockMatchId } });
    expect(row.clockPeriod).toBe("HALF_TIME");
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

describe("recordEventForActor (Stage 4 internal persistence, SPEC.md §19)", () => {
  let sessionId: string;

  beforeAll(async () => {
    await testDb.liveMatchEvent.deleteMany({ where: { matchId } });
    await testDb.liveMatchSession.deleteMany({ where: { matchId } });
    const session = await startLiveSession(matchId);
    sessionId = session.id;
  });

  it("persists an event given an explicit actor, with no requireActorContext() call", async () => {
    // No auth mock manipulation here — this must work purely from the explicit actor param,
    // proving the internal endpoint doesn't need a browser session to reach this code.
    const canonical = await recordEventForActor(
      {
        matchId,
        sessionId,
        eventType: "GOAL_FOR",
        period: "FIRST_HALF",
        matchSeconds: 120,
        playerId: fixture.players[0].id,
        clientEventId: "evt-internal-goal-1",
      },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );

    expect(canonical.id).toBeDefined();
    expect(canonical.clientEventId).toBe("evt-internal-goal-1");
    expect(canonical.eventType).toBe("GOAL_FOR");
    expect(canonical.createdAt).toBeDefined();
  });

  it("is idempotent on duplicate clientEventId — returns the existing canonical event, no second row", async () => {
    const first = await recordEventForActor(
      { matchId, sessionId, eventType: "GOAL_AGAINST", clientEventId: "evt-internal-dup" },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    const second = await recordEventForActor(
      { matchId, sessionId, eventType: "GOAL_AGAINST", clientEventId: "evt-internal-dup" },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );

    expect(second.id).toBe(first.id);
    const rows = await testDb.liveMatchEvent.findMany({ where: { clientEventId: "evt-internal-dup" } });
    expect(rows.length).toBe(1);
  });

  it("rejects an actor whose organisationId does not match the session's organisation", async () => {
    await expect(
      recordEventForActor(
        { matchId, sessionId, eventType: "GOAL_FOR", clientEventId: "evt-internal-wrong-org" },
        { userId: "attacker", organisationId: "some-other-org" },
      ),
    ).rejects.toThrow();
  });

  it("rejects a payload whose matchId does not match the session's actual match", async () => {
    await expect(
      recordEventForActor(
        { matchId: "a-different-match-id", sessionId, eventType: "GOAL_FOR", clientEventId: "evt-internal-wrong-match" },
        { userId: "worker-relayed-user", organisationId: fixture.organisationId },
      ),
    ).rejects.toThrow("Session does not belong to this match");
  });

  it("rejects an inactive/nonexistent session the same way recordEvent() does", async () => {
    await expect(
      recordEventForActor(
        { matchId, sessionId: "nonexistent-session", eventType: "GOAL_FOR", clientEventId: "evt-internal-inactive" },
        { userId: "worker-relayed-user", organisationId: fixture.organisationId },
      ),
    ).rejects.toThrow("Session not found");
  });

  it("recordEvent() (the browser/server-action wrapper) still behaves identically after the refactor", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "MOMENT_MARKED",
      clientEventId: "evt-wrapper-unchanged",
    });
    expect(result.eventId).toBeDefined();
    const row = await testDb.liveMatchEvent.findUnique({ where: { clientEventId: "evt-wrapper-unchanged" } });
    expect(row?.id).toBe(result.eventId);
  });
});

describe("recordEventForActor sequence persistence (ADR-0138, Bundle 2)", () => {
  let sessionId: string;

  beforeAll(async () => {
    await testDb.liveMatchEvent.deleteMany({ where: { matchId } });
    await testDb.liveMatchSession.deleteMany({ where: { matchId } });
    const session = await startLiveSession(matchId);
    sessionId = session.id;
  });

  it("persists the coordinator-assigned sequence and acceptance time", async () => {
    const acceptedAtMs = Date.parse("2026-09-12T12:00:00.000Z");
    const canonical = await recordEventForActor(
      { matchId, sessionId, eventType: "GOAL_FOR", clientEventId: "evt-seq-1", sequence: 1, acceptedAtMs },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    expect(canonical.sequence).toBe(1);
    const row = await testDb.liveMatchEvent.findUnique({ where: { clientEventId: "evt-seq-1" } });
    expect(row?.sequence).toBe(1);
    expect(row?.acceptedAt?.toISOString()).toBe("2026-09-12T12:00:00.000Z");
  });

  it("a row written with no coordinator-assigned sequence (direct-HTTP path, ARR-0045) keeps sequence null", async () => {
    const result = await recordEvent({
      matchId,
      sessionId,
      eventType: "GOAL_AGAINST",
      clientEventId: "evt-seq-no-sequence",
    });
    const row = await testDb.liveMatchEvent.findUnique({ where: { id: result.eventId } });
    expect(row?.sequence).toBeNull();
  });

  it("does not consume a new sequence on a duplicate clientEventId retry", async () => {
    const first = await recordEventForActor(
      { matchId, sessionId, eventType: "MOMENT_MARKED", clientEventId: "evt-seq-retry", sequence: 2, acceptedAtMs: Date.now() },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    const second = await recordEventForActor(
      { matchId, sessionId, eventType: "MOMENT_MARKED", clientEventId: "evt-seq-retry", sequence: 2, acceptedAtMs: Date.now() },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    expect(second.sequence).toBe(first.sequence);
    const rows = await testDb.liveMatchEvent.findMany({ where: { sessionId, sequence: 2 } });
    expect(rows.length).toBe(1);
  });

  it("throws LiveMatchSequenceIntegrityError when a different clientEventId reuses an already-assigned sequence", async () => {
    await recordEventForActor(
      {
        matchId,
        sessionId,
        eventType: "MOMENT_MARKED",
        clientEventId: "evt-seq-collision-a",
        sequence: 3,
        acceptedAtMs: Date.now(),
      },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    await expect(
      recordEventForActor(
        {
          matchId,
          sessionId,
          eventType: "GOAL_FOR",
          clientEventId: "evt-seq-collision-b",
          sequence: 3,
          acceptedAtMs: Date.now(),
        },
        { userId: "worker-relayed-user", organisationId: fixture.organisationId },
      ),
    ).rejects.toThrow(LiveMatchSequenceIntegrityError);
  });

  it("correction fields (correctionType/correctsEventId) round-trip through persistence", async () => {
    const goal = await recordEventForActor(
      {
        matchId,
        sessionId,
        eventType: "GOAL_FOR",
        clientEventId: "evt-seq-goal-to-reverse",
        sequence: 4,
        acceptedAtMs: Date.now(),
      },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    const reversal = await recordEventForActor(
      {
        matchId,
        sessionId,
        eventType: "EVENT_REVERSED",
        clientEventId: "evt-seq-reversal",
        correctionType: "REVERSAL",
        correctsEventId: goal.id,
        sequence: 5,
        acceptedAtMs: Date.now(),
      },
      { userId: "worker-relayed-user", organisationId: fixture.organisationId },
    );
    expect(reversal.correctionType).toBe("REVERSAL");
    expect(reversal.correctsEventId).toBe(goal.id);
  });
});

describe("Live match domain validation", () => {
  it("validates required fields", () => {
    expect(validateLiveEventInput({ matchId: "", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "c1" })).toBe("matchId is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "", eventType: "GOAL_FOR", clientEventId: "c1" })).toBe("sessionId is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "" as LiveMatchEventType, clientEventId: "c1" })).toBe("eventType is required");
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "" })).toBe("clientEventId is required");
  });

  it("validates event type", () => {
    expect(isValidEventType("GOAL_FOR")).toBe(true);
    expect(isValidEventType("INVALID_TYPE")).toBe(false);
  });

  it("requires playerId for certain event types, but not GOAL_FOR (scorer attribution is a separate, optional SCORER_SET event)", () => {
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "GOAL_FOR", clientEventId: "c1" })).toBeNull();
    expect(validateLiveEventInput({ matchId: "m1", sessionId: "s1", eventType: "SCORER_SET", clientEventId: "c1" })).toContain("requires a playerId");
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

    const nowMs = Date.now() + 1;
    clock = pauseClock(clock, nowMs);
    expect(clock.running).toBe(false);
    expect(clock.elapsedBeforeStartMs).toBeGreaterThanOrEqual(0);

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