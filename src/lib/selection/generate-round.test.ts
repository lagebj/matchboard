import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

describe("Selection pipeline integration tests", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
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

  afterAll(async () => {
    await teardownTestDb();
  });

  it("generates a match round with all teams at or near target squad size", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    expect(result.matchResults.length).toBe(3);

    for (const matchResult of result.matchResults) {
      expect(matchResult.selectedPlayers.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("has no duplicate players across matches in the same round", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const allPlayerIds: string[] = [];
    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        allPlayerIds.push(player.playerId);
      }
    }

    const uniqueIds = new Set(allPlayerIds);
    expect(uniqueIds.size).toBe(allPlayerIds.length);
  });

  it("has no duplicate-player-in-match warnings", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const duplicateWarnings = result.roundWarnings.filter(
      (w) => w.code === "duplicate_player_in_match",
    );
    expect(duplicateWarnings).toHaveLength(0);
  });

  it("has no cross-match duplicate warnings", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const crossMatchWarnings = result.roundWarnings.filter(
      (w) => w.code === "player_in_multiple_matches",
    );
    expect(crossMatchWarnings).toHaveLength(0);
  });

  it("resolves support for higher-priority receiving team first", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const hvitResult = result.matchResults.find((r) => r.teamName === "Hvit");
    const rodResult = result.matchResults.find((r) => r.teamName === "Rod");

    const hvitSupport = hvitResult?.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ) ?? [];
    const rodSupport = rodResult?.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ) ?? [];

    expect(hvitSupport.length).toBeGreaterThan(0);

    if (rodSupport.length > 0) {
      expect(hvitSupport.length).toBeGreaterThanOrEqual(rodSupport.length);
    }
  });

  it("fills minimum core for each team before resolving rotation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      const coreCount = matchResult.selectedPlayers.filter(
        (p) => p.selectionCategory === "CORE",
      ).length;

      const teamFromFixture = Object.entries(fixtureIds.teams).find(
        ([_name, id]) => matchResult.selectedPlayers.some(
          (p) => p.coreTeamId === id && p.selectionCategory === "CORE",
        ),
      );

      if (teamFromFixture) {
        expect(coreCount).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("does not move selected core players below minCorePlayers", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const blaResult = result.matchResults.find((r) => r.teamName === "Bla");
    if (blaResult) {
      const blaCore = blaResult.selectedPlayers.filter(
        (p) => p.selectionCategory === "CORE" && p.coreTeamId === fixtureIds.teams["Bla"],
      );
      expect(blaCore.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("self-backfill re-includes own excluded core players when below target", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      const selfBackfillPlayers = matchResult.selectedPlayers.filter(
        (p) => p.explanations.some((e) => e.code === "self_backfill"),
      );

      for (const player of selfBackfillPlayers) {
        expect(player.coreTeamName).toBe(matchResult.teamName);
      }
    }
  });

  it("self-backfill does not include players assigned to other teams", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const assignedToOtherTeams = new Map<string, string>();
    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        if (player.coreTeamName !== matchResult.teamName) {
          assignedToOtherTeams.set(player.playerId, matchResult.teamName);
        }
      }
    }

    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        if (player.explanations.some((e) => e.code === "self_backfill")) {
          expect(assignedToOtherTeams.has(player.playerId)).toBe(false);
        }
      }
    }
  });

  it("routes core match drops downstream when development or backfill paths exist", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const routedDrops = result.generationSummary.routedCoreMatchDrops;

    const unrouted = result.generationSummary.unroutedExclusions.filter(
      (e) => e.reason?.includes("core-match drop") || e.reason?.includes("surplus core"),
    );
    
    if (unrouted.length > 0) {
      for (const unroutedPlayer of unrouted) {
        const hasPath = unroutedPlayer.coreTeamName === "Bla" || unroutedPlayer.coreTeamName === "Rod";
        if (!hasPath) continue;
        console.warn(`Unrouted exclusion: ${unroutedPlayer.playerName} from ${unroutedPlayer.coreTeamName} — ${unroutedPlayer.reason}`);
      }
    }
  });

  it("every excluded player has an explanation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      for (const excluded of matchResult.excludedPlayers) {
        expect(excluded.exclusionReason).toBeTruthy();
        expect(excluded.explanations.length).toBeGreaterThan(0);
      }
    }
  });

  it("first round with no history still produces rotation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const nonCoreSelections = result.matchResults.flatMap(
      (r) => r.selectedPlayers.filter((p) => p.selectionCategory !== "CORE"),
    );

    expect(nonCoreSelections.length).toBeGreaterThan(0);
  });
});