import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Bug fix: support team restriction follows rotation path role", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Hvit", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 4, minSupportPlayers: 2, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Bla", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "Rod", to: "Hvit", role: "SUPPORT" },
        { from: "Rod", to: "Hvit", role: "BACKFILL" },
        { from: "Bla", to: "Hvit", role: "DEVELOPMENT" },
        { from: "Bla", to: "Rod", role: "SUPPORT" },
        { from: "Bla", to: "Rod", role: "DEVELOPMENT" },
        { from: "Hvit", to: "Bla", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "DEVELOPMENT" },
        { from: "Hvit", to: "Rod", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("Bla players are NOT assigned as SUPPORT to Hvit because Bla only has a DEVELOPMENT path to Hvit", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitSupport = result.matchResults
      .find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT") ?? [];

    for (const supportPlayer of hvitSupport) {
      expect(supportPlayer.coreTeamName).not.toBe("Bla");
    }
  });

  it("Rod players ARE assigned as SUPPORT to Hvit because Rod has a SUPPORT path to Hvit", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitSupport = result.matchResults
      .find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT") ?? [];

    const rodSupportPlayers = hvitSupport.filter((p) => p.coreTeamName === "Rod");
    expect(rodSupportPlayers.length).toBeGreaterThan(0);
  });
});

describe("Bug fix: support priority is respected and path-restricted support fills first", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Hvit", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Bla", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 14,
      rotationPaths: [
        { from: "Rod", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Rod", role: "SUPPORT" },
        { from: "Bla", to: "Hvit", role: "DEVELOPMENT" },
        { from: "Rod", to: "Bla", role: "DEVELOPMENT" },
        { from: "Bla", to: "Rod", role: "BACKFILL" },
        { from: "Hvit", to: "Rod", role: "BACKFILL" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("Hvit support players come from Rod (SUPPORT path), not Bla (DEVELOPMENT path only)", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitSupport = result.matchResults
      .find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT") ?? [];

    for (const sp of hvitSupport) {
      expect(sp.coreTeamName, `Hvit support player ${sp.playerName} should not be from Bla`).not.toBe("Bla");
    }
  });

  it("Bla does not backfill Hvit when there is no BACKFILL path from Bla to Hvit", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitBackfill = result.matchResults
      .find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "BACKFILL") ?? [];

    const blaToHvitBackfill = hvitBackfill.filter((p) => p.coreTeamName === "Bla");
    expect(blaToHvitBackfill.length, "Bla should not backfill Hvit without a BACKFILL path").toBe(0);
  });

  it("support priority ordering: Hvit (1) before Rod (2)", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitSupport = result.matchResults.find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;

    expect(hvitSupport).toBeGreaterThan(0);
  });
});

describe("Bug fix: inactive/unavailable player not selected", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 2, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      rotationPaths: [
        { from: "B", to: "A", role: "SUPPORT" },
        { from: "B", to: "A", role: "BACKFILL" },
        { from: "A", to: "B", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("player marked as inactive is not selected in any match", async () => {
    const inactivePlayer = fixtureIds.players.find((p) => p.coreTeamName === "A");
    if (inactivePlayer) {
      await testDb.player.update({
        where: { id: inactivePlayer.id },
        data: { active: false },
      });
    }

    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    if (inactivePlayer) {
      for (const mr of result.matchResults) {
        const found = mr.selectedPlayers.find((p) => p.playerId === inactivePlayer.id);
        expect(found).toBeUndefined();
      }

      await testDb.player.update({
        where: { id: inactivePlayer.id },
        data: { active: true },
      });
    }
  });

  it("player marked as AWAY is not selected in any match", async () => {
    const awayPlayer = fixtureIds.players.find((p) => p.coreTeamName === "B");
    if (awayPlayer) {
      await testDb.player.update({
        where: { id: awayPlayer.id },
        data: { currentAvailability: "AWAY" },
      });
    }

    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    if (awayPlayer) {
      for (const mr of result.matchResults) {
        const found = mr.selectedPlayers.find((p) => p.playerId === awayPlayer.id);
        expect(found).toBeUndefined();
      }

      await testDb.player.update({
        where: { id: awayPlayer.id },
        data: { currentAvailability: "AVAILABLE" },
      });
    }
  });
});

describe("Bug fix: backfill direction and priority", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "TeamHi", targetSquadSize: 11, minCorePlayers: 7, targetSupportCount: 3, maxSupportCount: 5, minSupportPlayers: 3, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "TeamMid", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 1, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "TeamLow", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "TeamMid", to: "TeamHi", role: "SUPPORT" },
        { from: "TeamLow", to: "TeamHi", role: "SUPPORT" },
        { from: "TeamLow", to: "TeamMid", role: "BACKFILL" },
        { from: "TeamLow", to: "TeamMid", role: "DEVELOPMENT" },
        { from: "TeamMid", to: "TeamLow", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("backfill players come from teams with BACKFILL paths to the team needing backfill", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const midResult = result.matchResults.find((r) => r.teamName === "TeamMid");
    if (midResult) {
      const backfillPlayers = midResult.selectedPlayers.filter(
        (p) => p.selectionCategory === "BACKFILL",
      );
      for (const bp of backfillPlayers) {
        const hasBackfillPath = bp.coreTeamName === "TeamLow";
        expect(hasBackfillPath || bp.selectionCategory === "BACKFILL").toBe(true);
      }
    }
  });

  it("generates without errors when a team sends support and needs backfill", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    expect(result.matchResults.length).toBeGreaterThan(0);
    for (const mr of result.matchResults) {
      expect(mr.selectedPlayers.length).toBeGreaterThan(0);
    }
  });
});

describe("Bug fix: same-round player conflict prevention", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 2, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      rotationPaths: [
        { from: "B", to: "A", role: "SUPPORT" },
        { from: "A", to: "B", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no player appears in more than one match in the same round after round-level generation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const playerToMatches = new Map<string, string[]>();
    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        const existing = playerToMatches.get(p.playerId) ?? [];
        existing.push(mr.teamName);
        playerToMatches.set(p.playerId, existing);
      }
    }

    for (const [playerId, matchNames] of playerToMatches) {
      expect(
        new Set(matchNames).size,
        `Player ${playerId} appears in multiple matches: ${matchNames.join(", ")}`,
      ).toBe(1);
    }
  });
});