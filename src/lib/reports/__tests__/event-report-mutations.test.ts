import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { completeEventReport } from "@/lib/reports/event-report-mutations";
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

  it("completes a report with resolved attendance, resolves opponent identity, and runs post-match learning without throwing", async () => {
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
