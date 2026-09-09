import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// ADR-0127: post-match learning is non-blocking derived work — a forced step failure must NOT
// fail report completion, but it MUST be recorded as an observable FAILED PostMatchLearningRun.
// `runPostMatchLearning` imports this module dynamically; a partial mock still intercepts it.
vi.mock("@/lib/opponents/sporting-level-recording", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/opponents/sporting-level-recording")>();
  return {
    ...actual,
    recordOpponentSportingEvidenceForRef: vi.fn().mockRejectedValue(new Error("forced opponent-evidence failure")),
  };
});

import { completeEventReport } from "@/lib/reports/event-report-mutations";

describe("report completion survives a forced post-match learning failure (ADR-0127)", () => {
  let testDb: PrismaClient;
  let fixture: TestFixtureIds;
  let orgFilter: OrgFilterMode;
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
    const event = await testDb.event.create({
      data: {
        name: "Learning Failure Event",
        eventType: "CUP",
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixture.footballGroupId,
        organisationId: fixture.organisationId,
      },
    });
    eventId = event.id;
    const squad = await testDb.eventSquad.create({
      data: { eventId, name: "Squad", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
    });
    squadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("completes the report LOCKED, returns learning, and records a FAILED run", async () => {
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "Forced-Failure Opponent",
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        organisationId: fixture.organisationId,
      },
    });
    const report = await testDb.eventPostMatchReport.create({
      data: {
        eventMatchId: eventMatch.id,
        status: "DRAFT",
        ourScore: 1,
        opponentScore: 0,
        organisationId: fixture.organisationId,
      },
    });
    for (const p of fixture.players.slice(0, 2)) {
      await testDb.eventPostMatchPlayer.create({
        data: { reportId: report.id, playerId: p.id, attendanceStatus: "PRESENT", organisationId: fixture.organisationId },
      });
    }

    const result = await completeEventReport(report.id, orgFilter);

    // Report completion is NOT blocked by the learning failure.
    expect(result.success).toBe(true);
    if (!result.success) return;
    const locked = await testDb.eventPostMatchReport.findUnique({ where: { id: report.id } });
    expect(locked!.status).toBe("LOCKED");
    expect(locked!.completedAt).not.toBeNull();

    // The failure is authoritative and observable.
    expect(result.learning?.opponent.status).toBe("FAILED");
    expect(result.learning?.opponent.reason).toMatch(/forced opponent-evidence failure/);

    const run = await testDb.postMatchLearningRun.findFirst({
      where: { eventMatchId: eventMatch.id },
      orderBy: { runAt: "desc" },
    });
    expect(run).not.toBeNull();
    expect(run!.overallOutcome).toBe("FAILED");
    const steps = run!.steps as Record<string, { status: string; reason?: string }>;
    expect(steps.opponent.status).toBe("FAILED");
    // Other steps still ran — one failure does not abort the pipeline.
    expect(steps.actualTimeline.status).not.toBe("FAILED");
  });
});
