import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

// Contract test gap identified in current-state-remediation A-020 / platform-integrity-programme
// Phase 14: "support priority ordering with invalid paths" had no dedicated coverage.
// AGENTS.md's RotationPath authority rule: "No configured path means no non-core automatic
// selection" and "Invalid path eligibility is a hard eligibility problem, not a ranking problem"
// — a higher support-priority team with no valid rotation path must not block support from
// reaching a lower-priority team that DOES have one.
describe("Support priority ordering with invalid paths (A-020 contract gap)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        // Priority 1 (resolved first) but has NO valid support path from any donor team.
        { name: "HighPriorityNoPath", targetSquadSize: 14, minCorePlayers: 6, targetSupportCount: 3, maxSupportCount: 4, minSupportPlayers: 3, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 16 },
        // Priority 2 (resolved second) but HAS a valid support path from Donor.
        { name: "LowerPriorityWithPath", targetSquadSize: 14, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 16 },
        { name: "Donor", targetSquadSize: 8, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 0, minAcceptedSquadSize: 5, maxSquadSize: 12 },
      ],
      playersPerTeam: 8,
      // Deliberately no path from Donor (or anyone) to HighPriorityNoPath.
      rotationPaths: [
        { from: "Donor", to: "LowerPriorityWithPath", role: "SUPPORT" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("does not receive support FROM ANOTHER TEAM for the higher-priority team when it has no valid path", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const highPriorityTeam = await testDb.team.findFirst({ where: { name: "HighPriorityNoPath" } });
    const highPriorityResult = result.matchResults.find(
      (r) => r.teamName === "HighPriorityNoPath",
    );
    // selectionCategory === "SUPPORT" also covers self_squad_repair (a team's own player
    // re-included to meet target size) — that's a different mechanic from receiving a
    // player sent FROM another team, which is what "no valid path" should actually block.
    const externalSupportPlayers = highPriorityResult?.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT" && p.coreTeamId !== highPriorityTeam?.id,
    ) ?? [];
    expect(externalSupportPlayers).toHaveLength(0);
  });

  it("still assigns support to the lower-priority team that has a valid path", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const lowerPriorityResult = result.matchResults.find(
      (r) => r.teamName === "LowerPriorityWithPath",
    );
    const supportPlayers = lowerPriorityResult?.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ) ?? [];
    expect(supportPlayers.length).toBeGreaterThan(0);
    // Every support player assigned must actually come from the Donor team (the only
    // team with a configured path) — never from HighPriorityNoPath, which has no
    // outgoing path to anyone.
    const highPriorityTeamId = (await testDb.team.findFirst({ where: { name: "HighPriorityNoPath" } }))?.id;
    for (const p of supportPlayers) {
      expect(p.coreTeamId).not.toBe(highPriorityTeamId);
    }
  });

  it("generates a plan integrity signal for the unmet support need on the invalid-path team", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    await generateMatchRound(fixtureIds.matchRoundId);

    const { computeRoundPlanIntegrity } = await import("@/lib/selection/compute-plan-integrity");
    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const highPriorityTeam = await testDb.team.findFirst({ where: { name: "HighPriorityNoPath" } });
    const relevantSignals = integrity.signals.filter((s) => s.teamId === highPriorityTeam?.id);
    const relevantNotes = integrity.planningNotes.filter((n) => n.teamId === highPriorityTeam?.id);
    // Below-minimum or a planning note about unmet support is expected — the key contract
    // is that the engine does not silently pretend the team's support need was satisfied.
    expect(relevantSignals.length + relevantNotes.length).toBeGreaterThan(0);
  });
});
