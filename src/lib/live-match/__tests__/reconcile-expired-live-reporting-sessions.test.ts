import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import { reconcileExpiredLiveReportingSessions } from "../reconcile-expired-live-reporting-sessions";

/**
 * ADR-0146 §7 — the server-side reconciler, end-to-end against a real test DB and the real
 * `finishLiveReporting`. TEST-PLAN §21: runs with no client interaction. Failure-isolation
 * (§24) is covered separately in
 * `reconcile-expired-live-reporting-sessions-failure-isolation.test.ts` with mocked
 * dependencies — a real DB and a mocked `db` cannot coexist as two conflicting top-level
 * `vi.mock("@/lib/db")` calls in one file.
 */

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const MIN = 60 * 1000;

describe("reconcileExpiredLiveReportingSessions — real finishLiveReporting (end-to-end)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.matchPeriodTimingResolution.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
  });

  async function session(matchId: string, startedAt: Date) {
    const user = await createTestUser(testDb);
    return testDb.liveMatchSession.create({
      data: {
        matchId,
        coachId: user.id,
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
        startedAt,
        clockPeriod: "FULL_TIME",
        clockRunning: false,
        clockElapsedBeforeMs: 0,
      },
    });
  }

  async function freshMatchId(): Promise<string> {
    const match = await testDb.match.findFirstOrThrow({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true } });
    return match.id;
  }

  it("TEST-PLAN §21: finishes a session that has been ACTIVE for >= 270 minutes, with no client interaction", async () => {
    const matchId = await freshMatchId();
    const expiredSession = await session(matchId, new Date(Date.now() - 271 * MIN));

    const outcome = await reconcileExpiredLiveReportingSessions();

    expect(outcome.finished).toContainEqual({ subjectType: "LEAGUE", sessionId: expiredSession.id, matchId });
    expect(outcome.failed).toEqual([]);

    const ended = await testDb.liveMatchSession.findUniqueOrThrow({ where: { id: expiredSession.id } });
    expect(ended.status).toBe("ENDED");
    expect(await testDb.postMatchReport.count({ where: { matchId } })).toBe(1);
  });

  it("TEST-PLAN §10: is eligible at exactly the 270-minute boundary, not yet eligible one second before it", async () => {
    const matchId = await freshMatchId();
    const notYetEligible = await session(matchId, new Date(Date.now() - (270 * MIN - 1000)));

    const before = await reconcileExpiredLiveReportingSessions();
    expect(before.finished.find((f) => f.sessionId === notYetEligible.id)).toBeUndefined();
    expect((await testDb.liveMatchSession.findUniqueOrThrow({ where: { id: notYetEligible.id } })).status).toBe("ACTIVE");

    // Advance the same session's startedAt to exactly 270 minutes ago (database second-level
    // precision, not a brittle sub-millisecond assertion) and confirm it is now eligible.
    await testDb.liveMatchSession.update({ where: { id: notYetEligible.id }, data: { startedAt: new Date(Date.now() - 270 * MIN) } });
    const atBoundary = await reconcileExpiredLiveReportingSessions();
    expect(atBoundary.finished).toContainEqual({ subjectType: "LEAGUE", sessionId: notYetEligible.id, matchId });
  });

  it("does not touch a session that has not yet reached the 270-minute threshold", async () => {
    const matchId = await freshMatchId();
    const freshSession = await session(matchId, new Date(Date.now() - 10 * MIN));

    const outcome = await reconcileExpiredLiveReportingSessions();

    expect(outcome.finished.find((f) => f.sessionId === freshSession.id)).toBeUndefined();
    const unchanged = await testDb.liveMatchSession.findUniqueOrThrow({ where: { id: freshSession.id } });
    expect(unchanged.status).toBe("ACTIVE");
  });

  it("TEST-PLAN §23: reconciling an already-ended session again is a safe no-op", async () => {
    const matchId = await freshMatchId();
    await session(matchId, new Date(Date.now() - 271 * MIN));

    const first = await reconcileExpiredLiveReportingSessions();
    expect(first.finished.length).toBe(1);

    // The session is now ENDED -- no longer eligible, so a second run finds nothing to do.
    const second = await reconcileExpiredLiveReportingSessions();
    expect(second.finished).toEqual([]);
    expect(second.failed).toEqual([]);
    expect(await testDb.postMatchReport.count({ where: { matchId } })).toBe(1);
  });
});
