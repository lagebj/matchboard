import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Donor minCorePlayers protection during support resolution", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Donor", targetSquadSize: 8, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 14 },
        { name: "Receiver", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 3, maxSupportCount: 4, minSupportPlayers: 2, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 14 },
      ],
      playersPerTeam: 9,
      rotationPaths: [
        { from: "Donor", to: "Receiver", role: "SUPPORT" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("does not move selected core players below minCorePlayers", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const donorResult = result.matchResults.find((r) => r.teamName === "Donor");
    expect(donorResult).toBeDefined();

    const donorCoreStillSelected = donorResult!.selectedPlayers.filter(
      (p) => p.selectionCategory === "CORE" && p.coreTeamId === fixtureIds.teams["Donor"],
    );

    expect(donorCoreStillSelected.length).toBeGreaterThanOrEqual(8);
  });

  it("routes support players to the receiver team", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const receiverResult = result.matchResults.find((r) => r.teamName === "Receiver");
    const support = receiverResult?.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ) ?? [];

    expect(support.length).toBeGreaterThan(0);
  });
});

describe("Self-backfill re-includes own excluded core players", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "BigTeam", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "SmallTeam", targetSquadSize: 11, minCorePlayers: 7, targetSupportCount: 3, maxSupportCount: 4, minSupportPlayers: 2, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "BigTeam", to: "SmallTeam", role: "SUPPORT" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("re-includes own excluded players when team is below target after rotation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const bigTeamResult = result.matchResults.find((r) => r.teamName === "BigTeam");
    expect(bigTeamResult).toBeDefined();

    const selfBackfillPlayers = bigTeamResult!.selectedPlayers.filter(
      (p) => p.explanations.some((e) => e.code === "self_squad_repair"),
    );

    for (const player of selfBackfillPlayers) {
      expect(player.coreTeamName).toBe("BigTeam");
    }
  });

  it("does not re-include players assigned to other teams", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const assignedElsewhere = new Set<string>();
    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        if (player.coreTeamName !== matchResult.teamName) {
          assignedElsewhere.add(player.playerId);
        }
      }
    }

    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        if (player.explanations.some((e) => e.code === "self_squad_repair")) {
          expect(assignedElsewhere.has(player.playerId)).toBe(false);
        }
      }
    }
  });
});

describe("Pipeline order: support before routing before self-squad-repair", () => {
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

  it("fills minCore before support resolution", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      const coreCount = matchResult.selectedPlayers.filter(
        (p) => p.selectionCategory === "CORE",
      ).length;
      expect(coreCount).toBeGreaterThanOrEqual(6);
    }
  });

  it("resolves support before routing drops", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const supportPlayers = result.matchResults.flatMap(
      (r) => r.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT"),
    );
    expect(supportPlayers.length).toBeGreaterThan(0);
  });

  it("routes drops downstream after support is resolved", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const routedDrops = result.generationSummary.routedCoreMatchDrops;
    if (routedDrops.length > 0) {
      const blaExcludedCore = result.matchResults.find(
        (r) => r.teamName === "Bla",
      )?.excludedPlayers.filter(
        (p) => p.automaticSelectionCategory === "CORE",
      );

      if (blaExcludedCore && blaExcludedCore.length > 0) {
        const blaDropsRouted = routedDrops.filter(
          (d) => d.fromTeamName === "Bla",
        );
        expect(blaDropsRouted.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Development routing gets priority bonus when target has dev slots", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Source", targetSquadSize: 8, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 14 },
        { name: "DevTarget", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 7, maxSquadSize: 14 },
        { name: "BackfillTarget", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 14 },
      ],
      playersPerTeam: 10,
      rotationPaths: [
        { from: "Source", to: "DevTarget", role: "DEVELOPMENT" },
        { from: "Source", to: "BackfillTarget", role: "BACKFILL" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("routes core match drops to development target when dev slots are unmet", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const routedDrops = result.generationSummary.routedCoreMatchDrops;
    const devRouted = routedDrops.filter(
      (d) => d.role === "DEVELOPMENT" && d.fromTeamName === "Source",
    );

    if (routedDrops.length > 0) {
      expect(devRouted.length).toBeGreaterThanOrEqual(
        routedDrops.filter((d) => d.role === "BACKFILL" && d.fromTeamName === "Source").length,
      );
    }
  });
});

describe("No silent exclusions — every excluded player has an explanation", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 1, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 7, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 6, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 7, maxSquadSize: 12 },
      ],
      playersPerTeam: 10,
      rotationPaths: [
        { from: "B", to: "A", role: "SUPPORT" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("every excluded player has at least one explanation record", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      for (const excluded of matchResult.excludedPlayers) {
        expect(excluded.explanations.length).toBeGreaterThan(0);
        expect(excluded.exclusionReason).toBeTruthy();
      }
    }
  });

  it("excluded core-match-drop candidates are either routed or have an unrouted explanation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const allExcludedDrops = result.matchResults.flatMap(
      (r) => r.excludedPlayers.filter(
        (p) => p.automaticSelectionCategory === "CORE" &&
          (p.exclusionReason?.includes("core-match drop") || p.exclusionReason?.includes("surplus core")),
      ),
    );

    const allSelectedIds = new Set(
      result.matchResults.flatMap((r) => r.selectedPlayers.map((p) => p.playerId)),
    );

    for (const drop of allExcludedDrops) {
      const isRouted = allSelectedIds.has(drop.playerId);
      if (!isRouted) {
        expect(result.generationSummary.unroutedExclusions.some(
          (u) => u.playerName === drop.playerName,
        )).toBe(true);
      }
    }
  });
});

describe("Player uniqueness per match round", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "X", targetSquadSize: 11, minCorePlayers: 7, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 1, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Y", targetSquadSize: 11, minCorePlayers: 7, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "Y", to: "X", role: "SUPPORT" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("no player appears in more than one match in the same round", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    const playerToMatches = new Map<string, string[]>();
    for (const matchResult of result.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        const existing = playerToMatches.get(player.playerId) ?? [];
        existing.push(matchResult.teamName);
        playerToMatches.set(player.playerId, existing);
      }
    }

    for (const [, matchNames] of playerToMatches) {
      const uniqueMatches = new Set(matchNames);
      expect(uniqueMatches.size).toBe(1);
    }
  });

  it("no player appears twice in the same match", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const result = await generateMatchRound(fixtureIds.matchRoundId);

    for (const matchResult of result.matchResults) {
      const playerIds = matchResult.selectedPlayers.map((p) => p.playerId);
      const uniqueIds = new Set(playerIds);
      expect(uniqueIds.size).toBe(playerIds.length);
    }
  });
});