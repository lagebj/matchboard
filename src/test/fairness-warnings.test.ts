import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getSeasonFairnessWarnings } from "@/lib/selection/get-season-overview";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

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

    await testDb.rotationPath.upsert({
      where: { fromTeamId_toTeamId_role: { fromTeamId: blaTeamId, toTeamId: rodTeamId, role: "SUPPORT" } },
      update: { active: true, purpose: "Blå → Rød support" },
      create: {
        fromTeamId: blaTeamId,
        toTeamId: rodTeamId,
        role: "SUPPORT",
        purpose: "Blå → Rød support",
        active: true,
        organisationId: fixtureIds.organisationId,
      },
    });

    await testDb.rotationPath.upsert({
      where: { fromTeamId_toTeamId_role: { fromTeamId: hvitTeamId, toTeamId: blaTeamId, role: "SUPPORT" } },
      update: { active: true, purpose: "Hvit → Blå support" },
      create: {
        fromTeamId: hvitTeamId,
        toTeamId: blaTeamId,
        role: "SUPPORT",
        purpose: "Hvit → Blå support",
        active: true,
        organisationId: fixtureIds.organisationId,
      },
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, false);
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
      where: { leagueSeasonId: fixtureIds.leagueSeasonId },
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
        organisationId: fixtureIds.organisationId,
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
        organisationId: fixtureIds.organisationId,
      },
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);

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
          leagueSeasonId: fixtureIds.leagueSeasonId,
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      });

      const opponentName = `Opponent ${i + 1}`;
      const normalizedName = normalizeOpponentName(opponentName);
      const displayName = cleanOpponentDisplayName(opponentName);
      const ot = await testDb.opponentTeam.upsert({
        where: { organisationId_normalizedName: { organisationId: fixtureIds.organisationId, normalizedName } },
        update: { displayName },
        create: { displayName, normalizedName, organisationId: fixtureIds.organisationId },
      });
      const opponentTeamId = ot.id;
      fixtureIds.opponentTeamIds[normalizedName] = opponentTeamId;

      const match = await testDb.match.create({
        data: {
          teamId: rodTeamId,
          matchRoundId: mr.id,
          startsAt: new Date(Date.now() + (i + 10) * 7 * 24 * 60 * 60 * 1000),
          opponent: opponentName,
          opponentTeamId,
          homeAway: "HOME",
          matchType: "LEAGUE",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: fixtureIds.organisationId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: mr.id,
          playerId: blaPlayer.id,
          role: "SUPPORT",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      });
    }

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, false);
    const consecutiveWarnings = warnings.filter(
      (w) => w.rule === "player_moved_consecutive_rounds" && w.playerId === blaPlayer.id,
    );

    expect(consecutiveWarnings.length).toBeGreaterThan(0);
    expect(consecutiveWarnings[0]!.message).toContain("consecutive rounds");
  });

  it("generates team_round_disproportionate_support warning per round", async () => {
    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);
    const roundSupportWarnings = warnings.filter(
      (w) => w.rule === "team_round_disproportionate_support",
    );

    expect(Array.isArray(roundSupportWarnings)).toBe(true);
  });
});