import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Controlled double-load: allowed when all guard conditions met", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-28T10:00:00Z"),
        B: new Date("2025-04-29T10:00:00Z"),
      },
      rotationPaths: [
        { from: "A", to: "B", role: "SUPPORT", allowDoubleLoad: true, minRestSpacingHours: 12 },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("player can be selected for both matches when double-load is enabled and matches are on different dates", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBeGreaterThan(0);
  });

  it("double-load selection has the correct role from rotation path", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    for (const p of doubleLoadPlayers) {
      expect(p.selectionCategory).toBe("SUPPORT");
      expect(p.controlledDoubleLoad).toBe(true);
      expect(p.explanations.some((e) => e.code === "controlled_double_load")).toBe(true);
    }
  });
});

describe("Controlled double-load: rejected when matches are on the same date", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-28T10:00:00Z"),
        B: new Date("2025-04-28T14:00:00Z"),
      },
      rotationPaths: [
        { from: "A", to: "B", role: "SUPPORT", allowDoubleLoad: true, minRestSpacingHours: 4 },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no double-load selections when matches are on the same date", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBe(0);
  });
});

describe("Controlled double-load: rejected when not explicitly enabled", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-28T10:00:00Z"),
        B: new Date("2025-04-29T10:00:00Z"),
      },
      rotationPaths: [
        { from: "A", to: "B", role: "SUPPORT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no double-load selections when allowDoubleLoad is not set", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBe(0);
  });

  it("same-round uniqueness applies as the default rule", async () => {
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
});

describe("Controlled double-load: rejected when rest spacing is not met", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-29T18:00:00Z"),
        B: new Date("2025-04-30T06:00:00Z"),
      },
      rotationPaths: [
        { from: "A", to: "B", role: "SUPPORT", allowDoubleLoad: true, minRestSpacingHours: 24 },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no double-load selections when rest spacing is insufficient (12h < 24h required)", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBe(0);
  });
});

describe("Controlled double-load: non-rotatable player cannot be double-loaded outside core team", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-28T10:00:00Z"),
        B: new Date("2025-04-29T10:00:00Z"),
      },
      rotationPaths: [
        { from: "A", to: "B", role: "SUPPORT", allowDoubleLoad: true, minRestSpacingHours: 12 },
      ],
    });

    const nonRotatablePlayer = fixtureIds.players.find((p) => p.coreTeamName === "A");
    if (nonRotatablePlayer) {
      await testDb.player.update({
        where: { id: nonRotatablePlayer.id },
        data: { nonRotatable: true },
      });
    }
  });
  afterAll(async () => { await teardownTestDb(); });

  it("non-rotatable player is never double-loaded outside core team", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const nrPlayer = fixtureIds.players.find((p) => p.coreTeamName === "A")!;

    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        if (p.playerId === nrPlayer.id && p.controlledDoubleLoad === true) {
          expect(p.controlledDoubleLoad).not.toBe(true);
        }
      }
    }
  });
});

describe("Controlled double-load: cannot bypass rotation path validation", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      matchDates: {
        A: new Date("2025-04-28T10:00:00Z"),
        B: new Date("2025-04-29T10:00:00Z"),
      },
      rotationPaths: [],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no double-load selections when no rotation path exists", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBe(0);
  });
});