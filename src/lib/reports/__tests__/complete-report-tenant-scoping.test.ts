// Regression coverage for a hardening fix: completeReport()'s post-match-learning step used to
// re-derive actor context mid-function via `await import("@/lib/auth/actor-context");
// requireActorContext()` instead of trusting the already-loaded report's own `organisationId`.
// That re-derivation depends on a live request/cookie session being available -- if completeReport
// is ever invoked from a context with no such session, requireActorContext() throws, the
// surrounding try/catch silently swallows it (per ADR-0104, post-match learning must never block
// report completion), and evidence rebuild silently never runs. There was no way to observe this
// failure short of reading logs.
//
// This test deliberately does NOT mock @/lib/auth/actor-context, @/auth, or next/headers at all --
// unlike every other action test in this codebase (which routes through mockAuthContext()) -- to
// prove completeReport() no longer needs any of that machinery. It also does NOT mock @/lib/db,
// exercising the REAL extended `db` export so ADR-0087's fail-closed tenantRLS extension is
// actually in play, matching src/lib/__tests__/db-tenant-fail-closed.test.ts's approach.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import { createTestOrganisation } from "@/test/support/factories";

const mockResolveOpponent = vi.fn().mockResolvedValue(null);
const mockBuildLeagueMatchRef = vi.fn();
const mockRunPostMatchLearning = vi.fn();

vi.mock("@/lib/opponents/resolve-opponent", () => ({
  resolveOpponentOnReportCompletion: mockResolveOpponent,
}));

vi.mock("@/lib/evidence/adapters/league-evidence-adapter", () => ({
  buildLeagueMatchRef: mockBuildLeagueMatchRef,
}));

vi.mock("@/lib/evidence/post-match-learning", () => ({
  runPostMatchLearning: mockRunPostMatchLearning,
}));

describe("completeReport: tenant scoping without a live actor context (ADR-0087)", () => {
  let testDb: PrismaClient;
  let db: PrismaClient;
  let completeReport: typeof import("../report-mutations").completeReport;

  let orgAId: string;
  let orgBId: string;

  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    testDb = await setupTestDb();

    // Exercise the real extended client, matching db-tenant-fail-closed.test.ts.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const dbModule = await import("@/lib/db");
    db = dbModule.db;
    ({ completeReport } = await import("../report-mutations"));
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(testDb);
    vi.clearAllMocks();
    mockResolveOpponent.mockResolvedValue(null);
    mockBuildLeagueMatchRef.mockImplementation(async (matchId: string) => ({
      kind: "LEAGUE_MATCH" as const,
      matchId,
      leagueSeasonId: null,
    }));
    mockRunPostMatchLearning.mockResolvedValue({
      actualTimeline: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
      opponent: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
      players: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
      combinations: { status: "SKIPPED", reason: "NOT_ATTEMPTED" },
    });

    const orgA = await createTestOrganisation(testDb);
    orgAId = orgA.id;
    const orgB = await createTestOrganisation(testDb);
    orgBId = orgB.id;
  });

  it("completes a DRAFT report and runs post-match learning with no session/actor context available at all", async () => {
    const report = await testDb.postMatchReport.create({
      data: { matchId: `match-${Date.now()}`, status: "DRAFT", organisationId: orgAId },
    });

    const result = await completeReport(report.id, "coach@example.com", {
      type: "org",
      filter: { organisationId: orgAId },
      filterNullable: { organisationId: orgAId },
      organisationId: orgAId,
    });

    expect(result.success).toBe(true);

    const updated = await db.postMatchReport.findFirst({
      where: { id: report.id, organisationId: orgAId },
    });
    expect(updated?.status).toBe("LOCKED");
    expect(updated?.completedBy).toBe("coach@example.com");

    // The actual proof this fix matters: post-match learning genuinely ran, scoped to the
    // report's own organisation -- not silently swallowed by a requireActorContext() failure.
    expect(mockBuildLeagueMatchRef).toHaveBeenCalledWith(report.matchId);
    expect(mockRunPostMatchLearning).toHaveBeenCalledTimes(1);
    const [, learningOrgFilter] = mockRunPostMatchLearning.mock.calls[0];
    expect(learningOrgFilter.organisationId).toBe(orgAId);
  });

  it("still rejects the same underlying report query with no trusted organisation context", async () => {
    const report = await testDb.postMatchReport.create({
      data: { matchId: `match-${Date.now()}`, status: "DRAFT", organisationId: orgAId },
    });

    await expect(
      db.postMatchReport.findFirst({ where: { id: report.id } }),
    ).rejects.toThrow("Refusing unscoped query");
  });

  it("denies completing another organisation's report when an orgFilter is supplied (cross-tenant access)", async () => {
    const report = await testDb.postMatchReport.create({
      data: { matchId: `match-${Date.now()}`, status: "DRAFT", organisationId: orgBId },
    });

    const result = await completeReport(report.id, "coach@example.com", {
      type: "org",
      filter: { organisationId: orgAId },
      filterNullable: { organisationId: orgAId },
      organisationId: orgAId,
    });

    expect(result.success).toBe(false);
    expect(mockRunPostMatchLearning).not.toHaveBeenCalled();

    const untouched = await db.postMatchReport.findFirst({
      where: { id: report.id, organisationId: orgBId },
    });
    expect(untouched?.status).toBe("DRAFT");
  });
});
