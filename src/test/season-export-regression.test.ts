import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { SelectionStatus } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getMovementPathSummary, getPlayerLoadSummary, getSeasonFairnessWarnings } from "@/lib/selection/get-season-overview";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Season export regression", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("export with support/development selections has non-empty movements", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const hvitTeamId = fixtureIds.teams["Hvit"]!;
    const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Hvit"]!,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: blaPlayer.id,
        role: "SUPPORT",
        status: "FINALIZED",
      },
    });

    await testDb.movementLedger.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: fixtureIds.matches["Hvit"]!,
        playerId: blaPlayer.id,
        fromTeamId: blaTeamId,
        toTeamId: hvitTeamId,
        role: "SUPPORT",
        isDraft: false,
      },
    });

    const paths = await getMovementPathSummary(fixtureIds.leagueSeasonId);

    const supportPath = paths.find((p) => p.role === "SUPPORT" && p.fromTeamName === "Bla" && p.toTeamName === "Hvit");
    expect(supportPath).toBeDefined();
    expect(supportPath!.count).toBeGreaterThanOrEqual(1);
  });

  it("no duplicate player in same match as controlled double-load plus support", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[4]!;

    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Hvit"]!,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: blaPlayer.id,
        role: "SUPPORT",
        controlledDoubleLoad: true,
        status: SelectionStatus.FINALIZED,
      },
    });

    const selections = await testDb.selection.findMany({
      where: {
        playerId: blaPlayer.id,
        matchId: fixtureIds.matches["Hvit"]!,
        matchRoundId: fixtureIds.matchRoundId,
      },
    });

    expect(selections).toHaveLength(1);
    expect(selections[0]!.role).toBe("SUPPORT");
    expect(selections[0]!.controlledDoubleLoad).toBe(true);
  });

  it("squad repair counted in backfillMatches not coreMatches", async () => {
    const _rodTeamId = fixtureIds.teams["Rod"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === fixtureIds.teams["Bla"]!)[5]!;

    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Rod"]!,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: blaPlayer.id,
        role: "BACKFILL",
        status: SelectionStatus.FINALIZED,
      },
    });

    const summary = await getPlayerLoadSummary(fixtureIds.leagueSeasonId, true);
    const player = summary.find((p) => p.playerId === blaPlayer.id);

    expect(player).toBeDefined();
    expect(player!.backfillMatches).toBeGreaterThanOrEqual(1);
    expect(player!.coreMatches).toBe(0);
  });

  it("double-load rounds counted from flag not role", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[6]!;

    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Hvit"]!,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: blaPlayer.id,
        role: "SUPPORT",
        controlledDoubleLoad: true,
        status: SelectionStatus.FINALIZED,
      },
    });

    const summary = await getPlayerLoadSummary(fixtureIds.leagueSeasonId, true);
    const player = summary.find((p) => p.playerId === blaPlayer.id);

    expect(player).toBeDefined();
    expect(player!.doubleLoadRounds).toBeGreaterThanOrEqual(1);
  });

  it("season fairness flags high support burden", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[7]!;

    await testDb.selection.createMany({
      data: [
        { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "CORE", status: SelectionStatus.FINALIZED },
        { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: SelectionStatus.FINALIZED },
        { matchId: fixtureIds.matches["Rod"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: SelectionStatus.FINALIZED },
        { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: SelectionStatus.FINALIZED },
      ],
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);
    const burdenWarning = warnings.find((w) => w.rule === "high_support_burden" && w.playerId === blaPlayer.id);

    expect(burdenWarning).toBeDefined();
  });

  it("season fairness flags low core belonging", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[8]!;

    await testDb.selection.createMany({
      data: [
        { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: SelectionStatus.FINALIZED },
        { matchId: fixtureIds.matches["Rod"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: SelectionStatus.FINALIZED },
      ],
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);
    const belongingWarning = warnings.find((w) => w.rule === "low_core_belonging" && w.playerId === blaPlayer.id);

    expect(belongingWarning).toBeDefined();
  });

  it("season fairness flags repeated double-load", async () => {
    const blaTeamId = fixtureIds.teams["Bla"]!;
    const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[9]!;

    await testDb.selection.createMany({
      data: [
        { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", controlledDoubleLoad: true, status: SelectionStatus.FINALIZED },
        { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", controlledDoubleLoad: true, status: SelectionStatus.FINALIZED },
      ],
    });

    const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);
    const doubleLoadWarning = warnings.find((w) => w.rule === "repeated_double_load" && w.playerId === blaPlayer.id);

    expect(doubleLoadWarning).toBeDefined();
  });
});