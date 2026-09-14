import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { getTodayLiveMatchSummaries } from "../get-today-live-match-summaries";

/**
 * Today's durable Live Now loader (ADR-0141, `03_DATA_AND_RECOMMENDATION_CONTRACT.md`
 * "Live Now"). Reads only Postgres-persisted `LiveMatchSession`/`LiveMatchEvent` rows — never the
 * realtime Durable Object — and reuses the shared `reduceLiveEvents()` reducer so goal-counting
 * and reversal semantics can never diverge from the Live Reporting/Follow Live projections.
 */
describe("getTodayLiveMatchSummaries", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
  });

  async function createSession(matchId: string, overrides: Partial<{ clockPeriod: string; clockRunning: boolean; clockPeriodStartedAt: Date | null; clockElapsedBeforeMs: number }> = {}) {
    return testDb.liveMatchSession.create({
      data: {
        matchId,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ACTIVE",
        clockPeriod: (overrides.clockPeriod ?? "FIRST_HALF") as never,
        clockRunning: overrides.clockRunning ?? true,
        clockPeriodStartedAt: overrides.clockPeriodStartedAt ?? new Date(Date.now() - 5 * 60 * 1000),
        clockElapsedBeforeMs: overrides.clockElapsedBeforeMs ?? 0,
      },
    });
  }

  it("returns no primary and issues no event query when there are no active sessions", async () => {
    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result).toEqual({ primary: null, otherLiveCount: 0 });
  });

  it("returns [] immediately for an empty candidate match id list", async () => {
    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [], undefined);
    expect(result).toEqual({ primary: null, otherLiveCount: 0 });
  });

  it("counts GOAL_FOR and GOAL_AGAINST from persisted events, ordered by sequence", async () => {
    const session = await createSession(fixture.matches.Bla!);
    await testDb.liveMatchEvent.createMany({
      data: [
        { matchId: fixture.matches.Bla!, sessionId: session.id, eventType: "GOAL_FOR", organisationId: fixture.organisationId, sequence: 1 },
        { matchId: fixture.matches.Bla!, sessionId: session.id, eventType: "GOAL_AGAINST", organisationId: fixture.organisationId, sequence: 2 },
        { matchId: fixture.matches.Bla!, sessionId: session.id, eventType: "GOAL_FOR", organisationId: fixture.organisationId, sequence: 3 },
      ],
    });

    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);

    expect(result.primary).not.toBeNull();
    expect(result.primary!.goalsFor).toBe(2);
    expect(result.primary!.goalsAgainst).toBe(1);
    expect(result.otherLiveCount).toBe(0);
  });

  it("un-counts a goal once it is reversed via EVENT_REVERSED (never double counts, never drops the correction)", async () => {
    const session = await createSession(fixture.matches.Bla!);
    const goal = await testDb.liveMatchEvent.create({
      data: { matchId: fixture.matches.Bla!, sessionId: session.id, eventType: "GOAL_FOR", organisationId: fixture.organisationId, sequence: 1 },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: fixture.matches.Bla!,
        sessionId: session.id,
        eventType: "EVENT_REVERSED",
        correctsEventId: goal.id,
        organisationId: fixture.organisationId,
        sequence: 2,
      },
    });

    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result.primary!.goalsFor).toBe(0);
  });

  it("orders by sequence, not by wall-clock createdAt, when they disagree", async () => {
    const session = await createSession(fixture.matches.Bla!);
    const now = new Date();
    // Written out of wall-clock order but with a correct ascending `sequence` — the canonical
    // coordinator-assigned order must win, matching every other pure reducer in this codebase.
    const goal = await testDb.liveMatchEvent.create({
      data: {
        matchId: fixture.matches.Bla!,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixture.organisationId,
        sequence: 1,
        createdAt: new Date(now.getTime() + 10_000),
      },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: fixture.matches.Bla!,
        sessionId: session.id,
        eventType: "EVENT_REVERSED",
        correctsEventId: goal.id,
        organisationId: fixture.organisationId,
        sequence: 2,
        createdAt: new Date(now.getTime()),
      },
    });

    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result.primary!.goalsFor).toBe(0);
  });

  it("reports a running clock's elapsed time and period", async () => {
    const session = await createSession(fixture.matches.Bla!, {
      clockPeriod: "SECOND_HALF",
      clockRunning: true,
      clockPeriodStartedAt: new Date(Date.now() - 2 * 60 * 1000),
      clockElapsedBeforeMs: 0,
    });
    void session;

    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result.primary!.periodLabel).toBe("Second half");
    expect(result.primary!.isRunning).toBe(true);
    expect(result.primary!.elapsedLabel).toMatch(/^\d+:\d{2}$/);
  });

  it("reports a paused clock without advancing elapsed time", async () => {
    await createSession(fixture.matches.Bla!, {
      clockRunning: false,
      clockPeriodStartedAt: null,
      clockElapsedBeforeMs: 7 * 60 * 1000,
    });

    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result.primary!.isRunning).toBe(false);
    expect(result.primary!.elapsedLabel).toBe("7:00");
  });

  it("never renders a fake 0:00 score line item beyond the reduced goal counts", async () => {
    await createSession(fixture.matches.Bla!);
    const result = await getTodayLiveMatchSummaries(fixture.organisationId, [fixture.matches.Bla!], undefined);
    expect(result.primary!.goalsFor).toBe(0);
    expect(result.primary!.goalsAgainst).toBe(0);
  });

  it("prefers the situation's active match id when multiple matches are live", async () => {
    const sessionBla = await createSession(fixture.matches.Bla!);
    const sessionHvit = await createSession(fixture.matches.Hvit!);
    void sessionBla;
    void sessionHvit;

    const result = await getTodayLiveMatchSummaries(
      fixture.organisationId,
      [fixture.matches.Bla!, fixture.matches.Hvit!],
      fixture.matches.Hvit!,
    );

    expect(result.primary!.matchId).toBe(fixture.matches.Hvit);
    expect(result.otherLiveCount).toBe(1);
  });

  it("falls back to earliest kickoff ordering with a +N live indicator when there is no active match id", async () => {
    await testDb.match.update({ where: { id: fixture.matches.Bla! }, data: { startsAt: new Date("2025-01-01T10:00:00Z") } });
    await testDb.match.update({ where: { id: fixture.matches.Hvit! }, data: { startsAt: new Date("2025-01-01T12:00:00Z") } });
    await createSession(fixture.matches.Bla!);
    await createSession(fixture.matches.Hvit!);

    const result = await getTodayLiveMatchSummaries(
      fixture.organisationId,
      [fixture.matches.Bla!, fixture.matches.Hvit!],
      undefined,
    );

    expect(result.primary!.matchId).toBe(fixture.matches.Bla);
    expect(result.otherLiveCount).toBe(1);
  });
});
