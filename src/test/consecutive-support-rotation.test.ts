import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getConsecutiveSupportCount } from "@/lib/selection/get-consecutive-support-count";
import { getRotationCandidatePriorityScore, getRankedRotationCandidates } from "@/lib/selection/rotation-candidate-ranking";
import type { RotationCandidate } from "@/lib/selection/selection-types";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

function makeCandidate(overrides: Partial<RotationCandidate> & { id: string; playerName: string }): RotationCandidate {
  return {
    player: { id: overrides.id, firstName: overrides.playerName.split(" ")[0] ?? "Test", lastName: overrides.playerName.split(" ")[1] ?? "", primaryPosition: "CM", secondaryPosition: null, tertiaryPosition: null, nonRotatable: false, coreTeamId: "team1", coreTeam: { id: "team1", name: "Team 1" }, rotationPathsFromCoreTeam: [], active: true, removedAt: null, currentAvailability: "AVAILABLE", playerCode: 1, readiness: "ready", createdAt: new Date(), updatedAt: new Date() } as RotationCandidate["player"],
    playerName: overrides.playerName,
    playerPosition: "CM",
    candidateCategory: "SUPPORT",
    chosenPosition: "CM",
    cooldownBlocked: false,
    cooldownBlockReason: null,
    eligibilityExplanation: "",
    floatingHistory: { lastFinalizedMatchDate: null, lastFinalizedRoleType: null, totalFloatingMatches: 0 },
    missedCoreMatchThisWeek: null,
    positionMatchLevel: "primary" as const,
    priorityScore: 0,
    registeredAppearanceCount: 0,
    recentLoadScore: 0,
    suitabilityScore: 0,
    ...overrides,
  } as RotationCandidate;
}

describe("Consecutive support rotation scoring", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getRotationCandidatePriorityScore", () => {
    it("applies penalty for players with consecutive support rounds as SUPPORT candidates", () => {
      const candidate = makeCandidate({
        id: "p1",
        playerName: "Player One",
        candidateCategory: "SUPPORT",
      });

      const scoreWithout = getRotationCandidatePriorityScore(candidate, [], null, 0);
      const scoreWith2Consecutive = getRotationCandidatePriorityScore(candidate, [], null, 2);
      const scoreWith3Consecutive = getRotationCandidatePriorityScore(candidate, [], null, 3);

      expect(scoreWith2Consecutive).toBeLessThan(scoreWithout);
      expect(scoreWith3Consecutive).toBeLessThan(scoreWith2Consecutive);
    });

    it("does not apply consecutive support penalty for DEVELOPMENT candidates", () => {
      const supportCandidate = makeCandidate({
        id: "p1",
        playerName: "Player One",
        candidateCategory: "DEVELOPMENT",
      });

      const scoreWithout = getRotationCandidatePriorityScore(supportCandidate, [], null, 0);
      const scoreWith3Consecutive = getRotationCandidatePriorityScore(supportCandidate, [], null, 3);

      expect(scoreWith3Consecutive).toBe(scoreWithout);
    });

    it("does not apply penalty when consecutive support rounds is 1 (only 1 round)", () => {
      const candidate = makeCandidate({
        id: "p1",
        playerName: "Player One",
        candidateCategory: "SUPPORT",
      });

      const scoreWithout = getRotationCandidatePriorityScore(candidate, [], null, 0);
      const scoreWith1 = getRotationCandidatePriorityScore(candidate, [], null, 1);

      expect(scoreWith1).toBe(scoreWithout);
    });

    it("penalty is 6 points per consecutive round beyond the first", () => {
      const candidate = makeCandidate({
        id: "p1",
        playerName: "Player One",
        candidateCategory: "SUPPORT",
      });

      const scoreWithout = getRotationCandidatePriorityScore(candidate, [], null, 0);
      const scoreWith2 = getRotationCandidatePriorityScore(candidate, [], null, 2);
      const scoreWith4 = getRotationCandidatePriorityScore(candidate, [], null, 4);

      expect(scoreWithout - scoreWith2).toBe(6);
      expect(scoreWithout - scoreWith4).toBe(18);
    });
  });

  describe("getRankedRotationCandidates with consecutive support", () => {
    it("ranks players with fewer consecutive support rounds higher for SUPPORT role", () => {
      const playerWithHistory = makeCandidate({
        id: "p-history",
        playerName: "History Player",
        candidateCategory: "SUPPORT",
      });

      const playerWithoutHistory = makeCandidate({
        id: "p-fresh",
        playerName: "Fresh Player",
        candidateCategory: "SUPPORT",
      });

      const consecutiveMap = new Map<string, number>();
      consecutiveMap.set("p-history", 3);
      consecutiveMap.set("p-fresh", 0);

      const ranked = getRankedRotationCandidates(
        [playerWithoutHistory, playerWithHistory],
        [],
        null,
        consecutiveMap,
      );

      expect(ranked[0]!.player.id).toBe("p-fresh");
    });
  });
});

describe("getConsecutiveSupportCount", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
  });

  it("returns 0 consecutive support rounds for a player with no history", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const result = await getConsecutiveSupportCount(playerId, new Date("2025-06-01"));

    expect(result.consecutiveSupportRounds).toBe(0);
    expect(result.totalSupportRounds).toBe(0);
  });

  it("counts consecutive support rounds correctly", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    });

    await testDb.selection.createMany({
      data: matches.slice(0, 2).map((m) => ({
        matchId: m.id,
        matchRoundId: fixtureIds.matchRoundId,
        playerId,
        role: "SUPPORT",
        status: "FINALIZED",
      })),
    });

    const latestDate = new Date(matches[1]!.startsAt.getTime() + 86400000);
    const result = await getConsecutiveSupportCount(playerId, latestDate);

    expect(result.consecutiveSupportRounds).toBeGreaterThanOrEqual(1);
    expect(result.totalSupportRounds).toBeGreaterThanOrEqual(1);
  });

  it("does not count CORE rounds as consecutive support", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    });

    await testDb.selection.create({
      data: {
        matchId: matches[0]!.id,
        matchRoundId: fixtureIds.matchRoundId,
        playerId,
        role: "CORE",
        status: "FINALIZED",
      },
    });

    const latestDate = new Date(matches[0]!.startsAt.getTime() + 86400000);
    const result = await getConsecutiveSupportCount(playerId, latestDate);

    expect(result.consecutiveSupportRounds).toBe(0);
  });
});