import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import { finishLiveReporting } from "../finish-live-reporting";

/**
 * ADR-0146 §5/§6/§12 — the one shared `finishLiveReporting` operation. Covers the bundle's
 * non-negotiable cases (AGENT-PROMPT.md Step 10): manual/TIMEOUT parity, a forgotten active
 * period bounded (not several hours of player minutes), and a manual/TIMEOUT race producing
 * exactly one effective transition.
 */

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const MIN = 60 * 1000;

describe("finishLiveReporting — League (ADR-0146)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
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

  async function activeSession(matchId: string, overrides: Partial<{
    clockPeriod: "BEFORE" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FULL_TIME";
    clockRunning: boolean;
    clockPeriodStartedAt: Date | null;
    clockElapsedBeforeMs: number;
    formatNumberOfPeriods: number | null;
    formatPeriodDurationMinutes: number | null;
    formatBreakDurationMinutes: number | null;
  }> = {}) {
    const user = await createTestUser(testDb);
    return testDb.liveMatchSession.create({
      data: {
        matchId,
        coachId: user.id,
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
        clockPeriod: "FULL_TIME",
        clockRunning: false,
        clockElapsedBeforeMs: 0,
        ...overrides,
      },
    });
  }

  function freshMatchId(): Promise<string> {
    return testDb.match
      .findFirstOrThrow({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true } })
      .then((m) => m.id);
  }

  it("TEST-PLAN §12: manual finish with no active period ends the session and creates a normal post-match draft", async () => {
    const matchId = await freshMatchId();
    const session = await activeSession(matchId, { clockPeriod: "FULL_TIME" });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.alreadyCompleted).toBe(false);
    expect(result.activePeriodResolution).toBeNull();
    expect(result.reportId).not.toBeNull();
    expect(result.reportStatus).toBe("DRAFT");

    const endedSession = await testDb.liveMatchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(endedSession.status).toBe("ENDED");
    expect(endedSession.endedAt).not.toBeNull();

    expect(await testDb.matchPeriodTimingResolution.count({ where: { matchId } })).toBe(0);
  });

  it("TEST-PLAN §13: active period within the recovery ceiling resolves to the raw elapsed duration, unclamped", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 36 * MIN);
    await activeSession(matchId, {
      clockPeriod: "SECOND_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      clockElapsedBeforeMs: 0,
      formatNumberOfPeriods: 2,
      formatPeriodDurationMinutes: 30,
      formatBreakDurationMinutes: 5,
    });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.activePeriodResolution?.resolutionSource).toBe("FINISH_LIVE_REPORTING");
    expect(result.activePeriodResolution?.reviewStatus).toBe("NOT_REQUIRED");
    // Allow generous test-runtime slack (real elapsed since periodStartedAt, not exactly 36m).
    expect(result.activePeriodResolution!.resolvedDurationMs).toBeGreaterThanOrEqual(36 * MIN);
    expect(result.activePeriodResolution!.resolvedDurationMs).toBeLessThan(40 * MIN);

    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { matchId, period: "SECOND_HALF" } });
    expect(row.resolutionSource).toBe("FINISH_LIVE_REPORTING");
    expect(row.reviewStatus).toBe("NOT_REQUIRED");
    expect(row.rawElapsedMs).toBeNull();
  });

  it("TEST-PLAN §14: active period beyond the ceiling clamps, preserves raw elapsed, and requires review — never several hours of unbounded time", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 4 * 60 * MIN); // 4 hours ago
    await activeSession(matchId, {
      clockPeriod: "FIRST_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      clockElapsedBeforeMs: 0,
      formatNumberOfPeriods: 2,
      formatPeriodDurationMinutes: 30,
      formatBreakDurationMinutes: 5,
    });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.activePeriodResolution?.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(result.activePeriodResolution?.reviewStatus).toBe("NEEDS_REVIEW");
    expect(result.activePeriodResolution?.resolvedDurationMs).toBe(40 * MIN); // 30m + max(10m, 25%*30m)

    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { matchId, period: "FIRST_HALF" } });
    expect(row.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(row.reviewStatus).toBe("NEEDS_REVIEW");
    expect(row.resolvedDurationMs).toBe(40 * MIN);
    expect(row.rawElapsedMs).toBeGreaterThanOrEqual(4 * 60 * MIN);
  });

  it("TEST-PLAN §15: TIMEOUT finish resolves an above-ceiling active period identically to MANUAL — only trigger/audit metadata differs", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 4 * 60 * MIN);
    await activeSession(matchId, {
      clockPeriod: "FIRST_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      clockElapsedBeforeMs: 0,
      formatNumberOfPeriods: 2,
      formatPeriodDurationMinutes: 30,
      formatBreakDurationMinutes: 5,
    });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "TIMEOUT",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.activePeriodResolution?.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(result.activePeriodResolution?.resolvedDurationMs).toBe(40 * MIN);
    expect(result.reportId).not.toBeNull();

    // No AUTO_CLOSED/TIMED_OUT business state (D12) — the session lands in the exact same ENDED
    // status a manual finish produces.
    const session = await testDb.liveMatchSession.findFirstOrThrow({ where: { matchId } });
    expect(session.status).toBe("ENDED");
  });

  it("TEST-PLAN §16: legacy active-period recovery (no frozen format) uses the 60-minute ceiling, never a guessed football duration", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 90 * MIN);
    await activeSession(matchId, {
      clockPeriod: "FIRST_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      clockElapsedBeforeMs: 0,
      formatNumberOfPeriods: null,
      formatPeriodDurationMinutes: null,
      formatBreakDurationMinutes: null,
    });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.activePeriodResolution?.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(result.activePeriodResolution?.resolvedDurationMs).toBe(60 * MIN);
    expect(result.activePeriodResolution?.reviewStatus).toBe("NEEDS_REVIEW");
  });

  it("TEST-PLAN §23: a repeated finish call on an already-ended session is a safe no-op — no duplicate report, no duplicate resolution row", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 4 * 60 * MIN);
    await activeSession(matchId, {
      clockPeriod: "FIRST_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      formatNumberOfPeriods: 2,
      formatPeriodDurationMinutes: 30,
      formatBreakDurationMinutes: 5,
    });

    const ref = { kind: "LEAGUE_MATCH" as const, matchId, leagueSeasonId: null };
    const first = await finishLiveReporting(ref, "MANUAL", { organisationId: fixtureIds.organisationId });
    expect(first.alreadyCompleted).toBe(false);

    const second = await finishLiveReporting(ref, "TIMEOUT", { organisationId: fixtureIds.organisationId });
    expect(second.alreadyCompleted).toBe(true);
    expect(second.reportId).toBe(first.reportId);

    expect(await testDb.postMatchReport.count({ where: { matchId } })).toBe(1);
    expect(await testDb.matchPeriodTimingResolution.count({ where: { matchId } })).toBe(1);
  });

  it("TEST-PLAN §22: a manual/TIMEOUT race produces exactly one effective transition, one report, one resolution row", async () => {
    const matchId = await freshMatchId();
    const periodStartedAt = new Date(Date.now() - 4 * 60 * MIN);
    await activeSession(matchId, {
      clockPeriod: "FIRST_HALF",
      clockRunning: true,
      clockPeriodStartedAt: periodStartedAt,
      formatNumberOfPeriods: 2,
      formatPeriodDurationMinutes: 30,
      formatBreakDurationMinutes: 5,
    });

    const ref = { kind: "LEAGUE_MATCH" as const, matchId, leagueSeasonId: null };
    const [manual, timeout] = await Promise.all([
      finishLiveReporting(ref, "MANUAL", { organisationId: fixtureIds.organisationId }),
      finishLiveReporting(ref, "TIMEOUT", { organisationId: fixtureIds.organisationId }),
    ]);

    // Exactly one side won the compare-and-set; the other observed completion.
    const completedFlags = [manual.alreadyCompleted, timeout.alreadyCompleted].sort();
    expect(completedFlags).toEqual([false, true]);

    // Both sides must report the same, single, real report.
    expect(manual.reportId).not.toBeNull();
    expect(manual.reportId).toBe(timeout.reportId);

    expect(await testDb.postMatchReport.count({ where: { matchId } })).toBe(1);
    expect(await testDb.matchPeriodTimingResolution.count({ where: { matchId } })).toBe(1);
    expect(await testDb.liveMatchSession.count({ where: { matchId, status: "ENDED" } })).toBe(1);
  });
});

describe("finishLiveReporting — Event (ADR-0146 §13 'League and Event parity')", () => {
  let fixtureIds: TestFixtureIds;
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });

    const event = await testDb.event.create({
      data: {
        name: "finishLiveReporting Event parity",
        eventType: "TOURNAMENT",
        startsAt: new Date("2025-04-01"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    eventId = event.id;
    const squad = await testDb.eventSquad.create({
      data: { eventId, name: "Squad", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    squadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("resolves an above-ceiling active period identically to League — same formula, same shared module (D5/§13)", async () => {
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "finishLiveReporting parity opponent",
        startsAt: new Date("2025-04-15T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });
    const user = await createTestUser(testDb);
    await testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId: eventMatch.id,
        coachId: user.id,
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
        clockPeriod: "FIRST_HALF",
        clockRunning: true,
        clockPeriodStartedAt: new Date(Date.now() - 4 * 60 * MIN),
        clockElapsedBeforeMs: 0,
        formatNumberOfPeriods: 2,
        formatPeriodDurationMinutes: 30,
        formatBreakDurationMinutes: 5,
      },
    });

    const result = await finishLiveReporting(
      { kind: "EVENT_MATCH", eventMatchId: eventMatch.id, eventId, evidenceLeagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );

    expect(result.alreadyCompleted).toBe(false);
    expect(result.activePeriodResolution?.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(result.activePeriodResolution?.resolvedDurationMs).toBe(40 * MIN);
    expect(result.reportId).not.toBeNull();

    const session = await testDb.eventLiveMatchSession.findFirstOrThrow({ where: { eventMatchId: eventMatch.id } });
    expect(session.status).toBe("ENDED");
    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { eventMatchId: eventMatch.id, period: "FIRST_HALF" } });
    expect(row.reviewStatus).toBe("NEEDS_REVIEW");
  });
});
