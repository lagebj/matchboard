import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Same-round uniqueness: players appear in at most one match per round (no double-load)", () => {
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

  it("no player appears in two matches in the same round (controlled double-load removed from generation)", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    // generation no longer assigns a player to two matches in the same round
    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    expect(doubleLoadPlayers.length).toBe(0);

    // same-round uniqueness: each player appears in at most one match
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

  it("no controlled_double_load warnings are generated", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadWarnings = result.roundWarnings.filter(
      (w) => w.code === "controlled_double_load" || w.code === "double_load_exceeded_max" || w.code === "double_load_squad_full",
    );
    expect(doubleLoadWarnings.length).toBe(0);
  });
});

describe("Same-round uniqueness: same-date matches prevent any cross-match assignment", () => {
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

describe("Same-round uniqueness: default rule without allowDoubleLoad", () => {
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

describe("Same-round uniqueness: insufficient rest spacing has no double-load", () => {
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

describe("Same-round uniqueness: non-rotatable player cannot appear outside core team", () => {
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

  it("non-rotatable player only appears in their own team", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);
    const nrPlayer = fixtureIds.players.find((p) => p.coreTeamName === "A")!;

    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        if (p.playerId === nrPlayer.id && p.coreTeamId !== mr.teamId) {
          // Non-rotatable player should not appear outside their core team
          expect(p.coreTeamId).toBe(mr.teamId);
        }
      }
    }
  });
});

describe("Same-round uniqueness: no rotation path means no cross-team movement", () => {
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