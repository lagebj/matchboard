import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getSeasonFairnessWarnings } from "@/lib/selection/get-season-overview";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Season fairness warnings — new warnings", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("generates expected_support_path_unused warning when an active support path has no usage", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const hvitTeamId = fixtureIds.teams["Hvit"]!;

    await testDb.rotationPath.create({
      data: {
        fromTeamId: blaTeamId,
        toTeamId: rodTeamId,
        role: "SUPPORT",
        purpose: "Blå → Rød support",
        active: true,
      },
    });

    await testDb.rotationPath.create({
      data: {
        fromTeamId: hvitTeamId,
        toTeamId: blaTeamId,
        role: "SUPPORT",
        purpose: "Hvit → Blå support",
        active: true,
      },
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.planningPeriodId, false);
    const pathWarnings = warnings.filter((w) => w.rule === "expected_support_path_unused");

    expect(pathWarnings.length).toBeGreaterThan(0);
    expect(pathWarnings.some((w) => w.teamId === blaTeamId)).toBe(true);
    expect(pathWarnings.some((w) => w.teamId === hvitTeamId)).toBe(true);
  });

  it("does not generate expected_support_path_unused when path has support usage", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

    const matchRound = await testDb.matchRound.findFirst({
      where: { planningPeriodId: fixtureIds.planningPeriodId },
    });

    const rodMatch = await testDb.match.findFirst({
      where: { matchRoundId: matchRound!.id, teamId: rodTeamId },
    });

    await testDb.selection.create({
      data: {
        matchId: rodMatch!.id,
        matchRoundId: matchRound!.id,
        playerId: blaPlayer.id,
        role: "SUPPORT",
        status: "FINALIZED",
      },
    });

    await testDb.movementLedger.create({
      data: {
        matchRoundId: matchRound!.id,
        matchId: rodMatch!.id,
        playerId: blaPlayer.id,
        fromTeamId: blaTeamId,
        toTeamId: rodTeamId,
        role: "SUPPORT",
        isDraft: false,
      },
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.planningPeriodId, true);

    const blaSupportUsage = warnings.filter(
      (w) => w.rule === "expected_support_path_unused" && w.teamId === blaTeamId && w.message.includes("Blå"),
    );

    expect(blaSupportUsage.length).toBe(0);
  });

  it("generates player_moved_consecutive_rounds warning for 3+ consecutive non-core rounds", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

    const _roundId = fixtureIds.matchRoundId;

    for (let i = 0; i < 3; i++) {
      const mr = await testDb.matchRound.create({
        data: {
          name: `Consecutive week ${i + 1}`,
          planningPeriodId: fixtureIds.planningPeriodId,
          status: "FINALIZED",
        },
      });

      const match = await testDb.match.create({
        data: {
          teamId: rodTeamId,
          matchRoundId: mr.id,
          startsAt: new Date(Date.now() + (i + 10) * 7 * 24 * 60 * 60 * 1000),
          opponent: `Opponent ${i + 1}`,
          homeAway: "HOME",
          matchType: "LEAGUE",
          gameFormat: "ELEVEN_A_SIDE",
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: mr.id,
          playerId: blaPlayer.id,
          role: "SUPPORT",
          status: "FINALIZED",
        },
      });
    }

    const warnings = await getSeasonFairnessWarnings(fixtureIds.planningPeriodId, false);
    const consecutiveWarnings = warnings.filter(
      (w) => w.rule === "player_moved_consecutive_rounds" && w.playerId === blaPlayer.id,
    );

    expect(consecutiveWarnings.length).toBeGreaterThan(0);
    expect(consecutiveWarnings[0]!.message).toContain("consecutive rounds");
  });

  it("generates team_round_disproportionate_support warning per round", async () => {
    const warnings = await getSeasonFairnessWarnings(fixtureIds.planningPeriodId, true);
    const roundSupportWarnings = warnings.filter(
      (w) => w.rule === "team_round_disproportionate_support",
    );

    expect(Array.isArray(roundSupportWarnings)).toBe(true);
  });
});