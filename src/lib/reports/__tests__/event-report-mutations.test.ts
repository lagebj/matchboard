import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { completeEventReport, seedEventReportFromLiveSession } from "@/lib/reports/event-report-mutations";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

/**
 * ARR-0030 resolution criteria: the completion transition's invariants (cannot complete
 * with unknown attendance, cannot mutate a locked report) are asserted against the shared
 * `completeEventReport()` domain implementation, not per-action duplicated assertions.
 */
describe("completeEventReport (ARR-0030 resolution)", () => {
  let fixtureIds: TestFixtureIds;
  let orgFilter: OrgFilterMode;
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 3 });
    orgFilter = {
      type: "org",
      filter: { organisationId: fixtureIds.organisationId },
      filterNullable: { organisationId: fixtureIds.organisationId },
      organisationId: fixtureIds.organisationId,
    };

    const event = await testDb.event.create({
      data: {
        name: "Completion Test Event",
        eventType: "CUP",
        startsAt: new Date("2025-05-20"),
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

  async function buildEventMatchWithReport(opts: { attendance: "PRESENT" | "UNKNOWN"; status?: "DRAFT" | "LOCKED" }) {
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: `Opponent ${Math.random().toString(36).slice(2, 8)}`,
        startsAt: new Date("2025-05-20T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });
    const report = await testDb.eventPostMatchReport.create({
      data: {
        eventMatchId: eventMatch.id,
        status: opts.status ?? "DRAFT",
        ourScore: 2,
        opponentScore: 1,
        organisationId: fixtureIds.organisationId,
        ...(opts.status === "LOCKED" ? { completedAt: new Date() } : {}),
      },
    });
    for (const p of fixtureIds.players.slice(0, 2)) {
      await testDb.eventPostMatchPlayer.create({
        data: {
          reportId: report.id,
          playerId: p.id,
          attendanceStatus: opts.attendance,
          organisationId: fixtureIds.organisationId,
        },
      });
    }
    return { eventMatch, report };
  }

  it("refuses to complete a report with unknown attendance", async () => {
    const { report } = await buildEventMatchWithReport({ attendance: "UNKNOWN" });

    const result = await completeEventReport(report.id, orgFilter);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/unknown attendance/i);

    const stillDraft = await testDb.eventPostMatchReport.findUnique({ where: { id: report.id } });
    expect(stillDraft!.status).toBe("DRAFT");
  });

  it("completes a report, resolves opponent identity, and records an observable post-match learning run", async () => {
    const { report, eventMatch } = await buildEventMatchWithReport({ attendance: "PRESENT" });

    const result = await completeEventReport(report.id, orgFilter);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.eventMatchId).toBe(eventMatch.id);

    const locked = await testDb.eventPostMatchReport.findUnique({ where: { id: report.id } });
    expect(locked!.status).toBe("LOCKED");
    expect(locked!.completedAt).not.toBeNull();

    const resolvedMatch = await testDb.eventMatch.findUnique({ where: { id: eventMatch.id }, select: { opponentTeamId: true } });
    expect(resolvedMatch!.opponentTeamId).not.toBeNull();

    // ADR-0127: learning outcome is returned AND persisted as an observable run.
    expect(result.learning).toBeDefined();
    const run = await testDb.postMatchLearningRun.findFirst({
      where: { eventMatchId: eventMatch.id },
      orderBy: { runAt: "desc" },
    });
    expect(run).not.toBeNull();
    expect(run!.trigger).toBe("REPORT_COMPLETION");
    expect(run!.matchId).toBeNull();
    expect(["APPLIED", "SKIPPED", "FAILED"]).toContain(run!.overallOutcome);
    expect(run!.steps).toEqual(result.learning);
  });

  it("refuses to complete a report that is already LOCKED", async () => {
    const { report } = await buildEventMatchWithReport({ attendance: "PRESENT", status: "LOCKED" });

    const result = await completeEventReport(report.id, orgFilter);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/DRAFT or REPORTED/i);
  });

  it("returns an error for a non-existent report", async () => {
    const result = await completeEventReport("does-not-exist", orgFilter);
    expect(result.success).toBe(false);
  });
});

/**
 * ADR-0138 Bundle 9 evidence-consumer audit: a reversed goal/scorer/assist event is a
 * *separate* row (`correctionType: "REVERSAL"`, `correctsEventId` pointing at the original) —
 * the original keeps `correctionType: null` forever. Before this fix,
 * `seedEventReportFromLiveSession()`'s own query excluded only the reversal marker row itself,
 * never the original goal it targeted, so a reversed goal was still counted in the seeded
 * report — the same class of bug League's own `seedReportFromLiveSession()` already fixed
 * (ADR-0133 H1 follow-up), found here independently since Event had no equivalent test at all.
 */
describe("seedEventReportFromLiveSession (ADR-0138 Bundle 9 reversal regression)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("excludes a reversed goal from the seeded report's score and goal events", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Reversal Seed Event",
        eventType: "CUP",
        startsAt: new Date("2025-05-21"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Reversal Squad", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const player = fixtureIds.players[0]!;
    await testDb.eventSquadPlayer.create({
      data: { eventId: event.id, eventSquadId: squad.id, playerId: player.id, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Reversal Seed Opponent",
        startsAt: new Date("2025-05-21T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const session = await testDb.eventLiveMatchSession.create({
      data: { eventMatchId: eventMatch.id, organisationId: fixtureIds.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    const goal = await testDb.eventLiveMatchEvent.create({
      data: {
        eventMatchId: eventMatch.id,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        playerId: player.id,
        organisationId: fixtureIds.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });
    await testDb.eventLiveMatchEvent.create({
      data: {
        eventMatchId: eventMatch.id,
        sessionId: session.id,
        eventType: "EVENT_REVERSED",
        correctionType: "REVERSAL",
        correctsEventId: goal.id,
        organisationId: fixtureIds.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });
    // A second, non-reversed goal proves the exclusion is targeted, not a blanket "no goals".
    await testDb.eventLiveMatchEvent.create({
      data: {
        eventMatchId: eventMatch.id,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        playerId: player.id,
        organisationId: fixtureIds.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });

    const result = await seedEventReportFromLiveSession(eventMatch.id, fixtureIds.organisationId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const report = await testDb.eventPostMatchReport.findUnique({ where: { id: result.reportId } });
    expect(report!.ourScore).toBe(1);
  });
});
