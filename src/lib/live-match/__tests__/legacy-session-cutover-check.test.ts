import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";

/**
 * ADR-0138 Bundle 9 (OBSERVABILITY_RECOVERY_ROLLOUT.md §8's cutover checklist).
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let db: PrismaClient;
let fixture: TestFixtureIds;

describe("checkActiveLegacySessions (ADR-0138 Bundle 9)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("reports cutoverSafe when no active session has unsequenced events", async () => {
    const matchId = Object.values(fixture.matches)[0];
    const session = await db.liveMatchSession.create({
      data: { matchId, organisationId: fixture.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
        sequence: 1,
      },
    });

    const { checkActiveLegacySessions } = await import("../legacy-session-cutover-check");
    const result = await checkActiveLegacySessions();

    expect(result.legacySessions.find((s) => s.sessionId === session.id)).toBeUndefined();
  });

  it("flags an active session with at least one unsequenced (legacy) event", async () => {
    const matchId = Object.values(fixture.matches)[1];
    const session = await db.liveMatchSession.create({
      data: { matchId, organisationId: fixture.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
        sequence: null,
      },
    });

    const { checkActiveLegacySessions } = await import("../legacy-session-cutover-check");
    const result = await checkActiveLegacySessions();

    const flagged = result.legacySessions.find((s) => s.sessionId === session.id);
    expect(flagged).toEqual({ subjectType: "LEAGUE", sessionId: session.id, matchId, unsequencedEventCount: 1 });
    expect(result.cutoverSafe).toBe(false);
  });

  it("does not flag an ENDED session even with unsequenced events", async () => {
    const matchId = Object.values(fixture.matches)[2];
    const session = await db.liveMatchSession.create({
      data: { matchId, organisationId: fixture.organisationId, coachId: "test-coach", status: "ENDED" },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
        sequence: null,
      },
    });

    const { checkActiveLegacySessions } = await import("../legacy-session-cutover-check");
    const result = await checkActiveLegacySessions();

    expect(result.legacySessions.find((s) => s.sessionId === session.id)).toBeUndefined();
  });
});
