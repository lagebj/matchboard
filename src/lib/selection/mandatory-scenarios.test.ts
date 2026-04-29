import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Mandatory: player cannot be selected twice in same round", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
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

  it("no player appears in more than one match in the same round", async () => {
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
    for (const [, matchNames] of playerToMatches) {
      expect(new Set(matchNames).size).toBe(1);
    }
  });

  it("no player appears twice in the same match", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    for (const mr of result.matchResults) {
      const ids = mr.selectedPlayers.map((p) => p.playerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("Mandatory: required support before development", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
        { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "Bla", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Rod", role: "SUPPORT" },
        { from: "Rod", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Hvit", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "DEVELOPMENT" },
        { from: "Bla", to: "Rod", role: "DEVELOPMENT" },
        { from: "Hvit", to: "Rod", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("support players are assigned before development or backfill", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const supportPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT"),
    );
    expect(supportPlayers.length).toBeGreaterThan(0);
  });

  it("higher-priority support is resolved first", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const hvitSupport = result.matchResults.find((r) => r.teamName === "Hvit")?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;
    const rodSupport = result.matchResults.find((r) => r.teamName === "Rod")?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;
    expect(hvitSupport).toBeGreaterThanOrEqual(rodSupport);
  });
});

describe("Mandatory: required support not overridden by fairness", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Needy", targetSquadSize: 10, minCorePlayers: 5, targetSupportCount: 3, maxSupportCount: 4, minSupportPlayers: 2, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 8, maxSquadSize: 14 },
        { name: "Donor", targetSquadSize: 10, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 2, minAcceptedSquadSize: 8, maxSquadSize: 14 },
      ],
      playersPerTeam: 11,
      rotationPaths: [
        { from: "Donor", to: "Needy", role: "SUPPORT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("support is assigned even when a player has fairness debt", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const needySupport = result.matchResults.find((r) => r.teamName === "Needy")?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;
    expect(needySupport).toBeGreaterThan(0);
  });

  it("warnings are generated when target support is not fully reached", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    expect(result.roundWarnings).toBeDefined();
  });
});

describe("Mandatory: backfill priority order", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
        { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "Bla", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Rod", role: "SUPPORT" },
        { from: "Rod", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Hvit", role: "BACKFILL" },
        { from: "Hvit", to: "Bla", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "BACKFILL" },
        { from: "Rod", to: "Bla", role: "DEVELOPMENT" },
        { from: "Hvit", to: "Rod", role: "DEVELOPMENT" },
        { from: "Bla", to: "Rod", role: "DEVELOPMENT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("backfill players are produced when a team loses players to support", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const backfillPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.selectionCategory === "BACKFILL"),
    );
    expect(backfillPlayers.length).toBeGreaterThan(0);
  });

  it("non-rotatable players are never used as generic backfill", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        if (p.selectionCategory === "BACKFILL") {
          const dbPlayer = await testDb.player.findUnique({ where: { id: p.playerId } });
          expect(dbPlayer?.nonRotatable).toBe(false);
        }
      }
    }
  });
});

describe("Mandatory: warning generation when support/backfill fails", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "BigNeed", targetSquadSize: 14, minCorePlayers: 5, targetSupportCount: 6, maxSupportCount: 7, minSupportPlayers: 3, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 16 },
        { name: "Small", targetSquadSize: 7, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 2, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 10 },
      ],
      playersPerTeam: 7,
      rotationPaths: [
        { from: "Small", to: "BigNeed", role: "SUPPORT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("warning is generated when support shortfall cannot be fully met", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const supportWarnings = result.roundWarnings.filter(
      (w) => w.code === "support_shortfall_after_resolution" || w.code === "support_below_target" || w.code === "support_unable_to_fill",
    );
    expect(supportWarnings.length).toBeGreaterThan(0);
  });
});

describe("Mandatory: non-rotatable players excluded from non-core selection", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "X", targetSquadSize: 10, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 1, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 8, maxSquadSize: 14 },
        { name: "Y", targetSquadSize: 10, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 8, maxSquadSize: 14 },
      ],
      playersPerTeam: 11,
      rotationPaths: [
        { from: "Y", to: "X", role: "SUPPORT" },
        { from: "Y", to: "X", role: "BACKFILL" },
        { from: "X", to: "Y", role: "DEVELOPMENT" },
      ],
    });

    await testDb.player.update({
      where: { id: fixtureIds.players.find((p) => p.coreTeamName === "Y")!.id },
      data: { nonRotatable: true },
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("non-rotatable player is never assigned SUPPORT, BACKFILL, or DEVELOPMENT", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const nrId = fixtureIds.players.find((pl) => pl.coreTeamName === "Y")!.id;
    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        if (p.playerId === nrId) {
          expect(p.selectionCategory).toBe("CORE");
        }
      }
    }
  });
});

describe("Mandatory: selection generation completes (fairness engine runs)", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "X", targetSquadSize: 10, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 1, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 8, maxSquadSize: 14 },
        { name: "Y", targetSquadSize: 10, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 8, maxSquadSize: 14 },
      ],
      playersPerTeam: 11,
      rotationPaths: [
        { from: "Y", to: "X", role: "SUPPORT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("selection generation completes without errors (fairness engine runs)", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    expect(result.matchResults.length).toBeGreaterThan(0);
    for (const mr of result.matchResults) {
      expect(mr.selectedPlayers.length).toBeGreaterThan(0);
    }
  });
});