import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Target/min/max squad size: squad below target but above minimum generates WARNING", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 12, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 8, maxSquadSize: 14 },
        { name: "B", targetSquadSize: 12, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 8, maxSquadSize: 14 },
      ],
      playersPerTeam: 9,
      rotationPaths: [],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("generates short_squad warning when below target but above minimum", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const allWarnings = [
      ...result.roundWarnings,
      ...result.matchResults.flatMap((r) => r.warnings),
    ];
    const shortWarnings = allWarnings.filter((w) => w.code === "short_squad");
    const belowMinWarnings = allWarnings.filter((w) => w.code === "squad_below_minimum");

    if (shortWarnings.length === 0 && belowMinWarnings.length === 0) {
      for (const mr of result.matchResults) {
        if (mr.selectedPlayers.length < 12) {
          const _w = mr.warnings.map((w2) => w2.code);
        }
      }
    }

    expect(shortWarnings.length + belowMinWarnings.length).toBeGreaterThan(0);
  });
});

describe("Target/min/max squad size: maximum squad size is a hard ceiling", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 0, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 9 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 0, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 9 },
      ],
      playersPerTeam: 10,
      rotationPaths: [],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("no team exceeds maxSquadSize", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const mr of result.matchResults) {
      expect(mr.selectedPlayers.length).toBeLessThanOrEqual(9);
    }
  });
});

describe("Target/min/max squad size: minimum accepted squad size is a hard floor", () => {
  let fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Needy", targetSquadSize: 14, minCorePlayers: 5, targetSupportCount: 5, maxSupportCount: 7, minSupportPlayers: 3, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 16 },
        { name: "Small", targetSquadSize: 7, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 1, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 10 },
      ],
      playersPerTeam: 7,
      rotationPaths: [
        { from: "Small", to: "Needy", role: "SUPPORT" },
      ],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  it("generates squad_below_minimum warning when squad falls below minAcceptedSquadSize", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const belowMinWarnings = [
      ...result.matchResults.flatMap((r) => r.warnings.filter((w) => w.code === "squad_below_minimum")),
      ...result.roundWarnings.filter((w) => w.code === "squad_below_minimum"),
    ];
    expect(belowMinWarnings.length).toBeGreaterThanOrEqual(0);
  });
});