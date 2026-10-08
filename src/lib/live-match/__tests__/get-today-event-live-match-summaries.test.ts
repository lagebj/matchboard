import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestEvent, createTestEventSquad } from "@/test/support/factories";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getTodayEventLiveMatchSummaries } from "../get-today-event-live-match-summaries";

let testDb: PrismaClient;
let fixture: TestFixtureIds;
let eventId: string;
let eventSquadId: string;

/**
 * Issue #686 / ADR-0158 slice 3 — Event equivalent of `get-today-live-match-summaries.test.ts`.
 * Reads only durable Postgres `EventLiveMatchSession`/`EventLiveMatchEvent` rows, reuses the
 * shared `reduceLiveEvents()` reducer, and -- unlike League -- must count goals even though
 * `EventLiveMatchEvent.sequence` is always null (ARR-0046).
 */
describe("getTodayEventLiveMatchSummaries", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId);
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    eventId = event.id;
    eventSquadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.eventLiveMatchEvent.deleteMany({});
    await testDb.eventLiveMatchSession.deleteMany({});
  });

  async function createMatch(opponentName: string) {
    return testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId,
        category: "CUP",
        organisationId: fixture.organisationId,
        opponentName,
        startsAt: new Date("2028-03-01T10:00:00Z"),
        status: "SCHEDULED",
      },
    });
  }

  async function createSession(eventMatchId: string, overrides: Partial<{ clockPeriod: string; clockRunning: boolean }> = {}) {
    return testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ACTIVE",
        clockPeriod: (overrides.clockPeriod ?? "FIRST_HALF") as never,
        clockRunning: overrides.clockRunning ?? true,
        clockPeriodStartedAt: new Date(Date.now() - 5 * 60 * 1000),
        clockElapsedBeforeMs: 0,
        formatNumberOfPeriods: 2,
        formatPeriodDurationMinutes: 25,
        formatBreakDurationMinutes: 5,
      },
    });
  }

  it("returns no primary when there are no ACTIVE Event sessions for the org", async () => {
    const result = await getTodayEventLiveMatchSummaries(fixture.organisationId, undefined);
    expect(result).toEqual({ primary: null, otherLiveCount: 0 });
  });

  it("counts GOAL_FOR/GOAL_AGAINST despite sequence always being null (ARR-0046)", async () => {
    const match = await createMatch("Goal Counting FC");
    const session = await createSession(match.id);
    await testDb.eventLiveMatchEvent.createMany({
      data: [
        { eventMatchId: match.id, sessionId: session.id, eventType: "GOAL_FOR", organisationId: fixture.organisationId, period: "FIRST_HALF", matchSeconds: 60_000 },
        { eventMatchId: match.id, sessionId: session.id, eventType: "GOAL_AGAINST", organisationId: fixture.organisationId, period: "FIRST_HALF", matchSeconds: 120_000 },
        { eventMatchId: match.id, sessionId: session.id, eventType: "GOAL_FOR", organisationId: fixture.organisationId, period: "FIRST_HALF", matchSeconds: 180_000 },
      ],
    });

    const result = await getTodayEventLiveMatchSummaries(fixture.organisationId, undefined);

    expect(result.primary).not.toBeNull();
    expect(result.primary!.goalsFor).toBe(2);
    expect(result.primary!.goalsAgainst).toBe(1);
    expect(result.primary!.kind).toBe("EVENT");
    expect(result.primary!.eventId).toBe(eventId);
    expect(result.primary!.matchId).toBe(match.id);
  });

  it("resolves a real primaryAction from the frozen format snapshot, not a bare boolean", async () => {
    const match = await createMatch("Resolver FC");
    await createSession(match.id, { clockPeriod: "FIRST_HALF", clockRunning: true });

    const result = await getTodayEventLiveMatchSummaries(fixture.organisationId, undefined);

    expect(result.primary!.primaryAction).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
  });

  it("ignores an ENDED session", async () => {
    const match = await createMatch("Ended FC");
    await testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId: match.id,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ENDED",
        clockPeriod: "FULL_TIME",
        clockRunning: false,
      },
    });

    const result = await getTodayEventLiveMatchSummaries(fixture.organisationId, undefined);
    const forThisMatch = result.primary?.matchId === match.id;
    expect(forThisMatch).toBe(false);
  });

  it("prefers the situational active match over an earlier kickoff when multiple are live", async () => {
    const earlier = await createMatch("Earlier FC");
    await createSession(earlier.id);
    const later = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId,
        category: "CUP",
        organisationId: fixture.organisationId,
        opponentName: "Later FC",
        startsAt: new Date("2028-03-01T12:00:00Z"),
        status: "SCHEDULED",
      },
    });
    await createSession(later.id);

    const result = await getTodayEventLiveMatchSummaries(fixture.organisationId, later.id);

    expect(result.primary!.matchId).toBe(later.id);
    expect(result.otherLiveCount).toBe(1);
  });
});
