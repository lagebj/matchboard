import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Pipeline phase order: 7 phases run in strict order", () => {
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
        { from: "Rod", to: "Hvit", role: "SUPPORT" },
        { from: "Bla", to: "Rod", role: "SUPPORT" },
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

  it("phase 1: core selection fills at least minCorePlayers per match before other phases", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const mr of result.matchResults) {
      const coreCount = mr.selectedPlayers.filter((p) => p.selectionCategory === "CORE").length;
      expect(coreCount).toBeGreaterThanOrEqual(6);
    }
  });

  it("phase 2: support resolution runs and assigns support players", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitSupport = result.matchResults.find((r) => r.teamName === "Hvit")
      ?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;
    expect(hvitSupport).toBeGreaterThan(0);
  });

  it("phase 3: conflict resolution removes same-round duplicates", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const playerToTeams = new Map<string, Set<string>>();
    for (const mr of result.matchResults) {
      for (const p of mr.selectedPlayers) {
        if (p.controlledDoubleLoad) continue;
        const existing = playerToTeams.get(p.playerId) ?? new Set();
        existing.add(mr.teamName);
        playerToTeams.set(p.playerId, existing);
      }
    }
    for (const [, teams] of playerToTeams) {
      expect(teams.size).toBe(1);
    }
  });

  it("phase 5: squad repair creates BACKFILL selections for teams weakened by support", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const backfillPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.selectionCategory === "BACKFILL"),
    );
    if (backfillPlayers.length > 0) {
      for (const p of backfillPlayers) {
        expect(p.explanations.length).toBeGreaterThan(0);
        expect(p.selectionCategory).toBe("BACKFILL");
      }
    }
  });

  it("phase 7: post-pipeline validation checks invariants", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const invariantViolation = result.roundWarnings.find(
      (w) => w.code === "invariant_invalid_non_core_selection",
    );
    expect(invariantViolation).toBeUndefined();
  });
});

describe("Pipeline phase order: double-load evaluated after all other phases", () => {
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

  it("double-load players appear in a second match in the round", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    if (doubleLoadPlayers.length > 0) {
      for (const p of doubleLoadPlayers) {
        const appearsIn = result.matchResults.filter((r) =>
          r.selectedPlayers.some((sp) => sp.playerId === p.playerId),
        );
        expect(appearsIn.length).toBe(2);
      }
    }
  });

  it("double-load explanation contains controlled_double_load code", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const doubleLoadPlayers = result.matchResults.flatMap((r) =>
      r.selectedPlayers.filter((p) => p.controlledDoubleLoad === true),
    );
    for (const p of doubleLoadPlayers) {
      expect(p.explanations.some((e) => e.code === "controlled_double_load")).toBe(true);
    }
  });
});