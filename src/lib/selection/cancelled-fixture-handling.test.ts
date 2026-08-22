import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

// Contract test gap identified in current-state-remediation A-020 / platform-integrity-programme
// Phase 14: cancelled fixture handling had zero dedicated selection-engine test coverage.
// AGENTS.md's "Cancelled match rules": cancelled matches are excluded from draft generation,
// plan integrity computation, and finalization.
describe("Cancelled fixture handling (A-020 contract gap)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      rotationPaths: [],
    });

    // Cancel team B's match before generation.
    await testDb.match.update({
      where: { id: fixtureIds.matches["B"] },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: "Test cancellation" },
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("does not generate selections for a cancelled match", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const cancelledMatchResult = result.matchResults.find(
      (r) => r.matchId === fixtureIds.matches["B"],
    );
    expect(cancelledMatchResult).toBeUndefined();

    const selectionsForCancelledMatch = await testDb.selection.findMany({
      where: { matchId: fixtureIds.matches["B"] },
    });
    expect(selectionsForCancelledMatch).toHaveLength(0);
  });

  it("still generates selections normally for the non-cancelled match in the same round", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const activeMatchResult = result.matchResults.find(
      (r) => r.matchId === fixtureIds.matches["A"],
    );
    expect(activeMatchResult).toBeDefined();
    expect(activeMatchResult!.selectedPlayers.length).toBeGreaterThan(0);
  });

  it("excludes the cancelled match from round plan integrity computation", async () => {
    const { computeRoundPlanIntegrity } = await import("@/lib/selection/compute-plan-integrity");
    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const cancelledMatchSignals = integrity.signals.filter(
      (s) => s.matchId === fixtureIds.matches["B"],
    );
    expect(cancelledMatchSignals).toHaveLength(0);
  });
});
