import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getSeasonPlayerRoundMatrix, getPlayerLoadSummary, getMovementPathSummary, getPlayerMovementTimeline, getSeasonFairnessWarnings } from "@/lib/selection/get-season-overview";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Season overview service", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getSeasonPlayerRoundMatrix", () => {
    it("returns players with round cells for finalized selections", async () => {
      const playerId = fixtureIds.players[0]!.id;
      const matchId = fixtureIds.matches["Bla"]!;

      await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });

      await testDb.selection.create({
        data: {
          matchId,
          matchRoundId: fixtureIds.matchRoundId,
          playerId,
          role: "CORE",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      });

      const matrix = await getSeasonPlayerRoundMatrix(fixtureIds.leagueSeasonId, true);

      const player = matrix.players.find((p) => p.playerId === playerId);
      expect(player).toBeDefined();
      expect(player!.coreMatches).toBe(1);
      expect(player!.roundsPlayed).toBe(1);
      expect(player!.cells).toHaveLength(1);
      expect(player!.cells[0]!.role).toBe("CORE");
    });

    it("excludes draft selections when includeDrafts is false", async () => {
      const playerId = fixtureIds.players[14]!.id;
      const matchId = fixtureIds.matches["Hvit"]!;

      await testDb.selection.create({
        data: {
          matchId,
          matchRoundId: fixtureIds.matchRoundId,
          playerId,
          role: "SUPPORT",
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });

      const matrixDraftExcluded = await getSeasonPlayerRoundMatrix(fixtureIds.leagueSeasonId, false);
      const matrixDraftIncluded = await getSeasonPlayerRoundMatrix(fixtureIds.leagueSeasonId, true);

      const playerExcluded = matrixDraftExcluded.players.find((p) => p.playerId === playerId);
      const playerIncluded = matrixDraftIncluded.players.find((p) => p.playerId === playerId);

      expect(playerExcluded!.supportMatches).toBe(0);
      expect(playerIncluded!.supportMatches).toBe(1);
      expect(playerIncluded!.cells[0]!.status).toBe("DRAFT");
    });

    it("counts support and core matches separately", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const hvitTeamId = fixtureIds.teams["Hvit"]!;
      const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);
      const corePlayer = blaPlayers[2]!;
      const supportPlayer = blaPlayers[3]!;

      await testDb.selection.createMany({
        data: [
          { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: corePlayer.id, role: "CORE", status: "FINALIZED" , organisationId: fixtureIds.organisationId },
          { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: supportPlayer.id, role: "SUPPORT", status: "FINALIZED" , organisationId: fixtureIds.organisationId },
        ],
      });

      await testDb.movementLedger.create({
        data: {
          matchRoundId: fixtureIds.matchRoundId,
          matchId: fixtureIds.matches["Hvit"]!,
          playerId: supportPlayer.id,
          fromTeamId: blaTeamId,
          toTeamId: hvitTeamId,
          role: "SUPPORT",
          isDraft: false,
          organisationId: fixtureIds.organisationId,
        },
      });

      const matrix = await getSeasonPlayerRoundMatrix(fixtureIds.leagueSeasonId, true);

      const coreRow = matrix.players.find((p) => p.playerId === corePlayer.id);
      const supportRow = matrix.players.find((p) => p.playerId === supportPlayer.id);

      expect(coreRow!.coreMatches).toBe(1);
      expect(coreRow!.supportMatches).toBe(0);
      expect(supportRow!.coreMatches).toBe(0);
      expect(supportRow!.supportMatches).toBe(1);
    });

    it("counts unavailable rounds separately not as dropped", async () => {
      const playerId = fixtureIds.players[5]!.id;

      await testDb.availability.create({
        data: {
          playerId,
          matchRoundId: fixtureIds.matchRoundId,
          status: "INJURED",
          organisationId: fixtureIds.organisationId,
        },
      });

      const matrix = await getSeasonPlayerRoundMatrix(fixtureIds.leagueSeasonId, true);
      const player = matrix.players.find((p) => p.playerId === playerId);

      expect(player!.unavailableRounds).toBe(1);
      expect(player!.droppedRounds).toBe(0);
    });

    it("returns empty matrix for nonexistent planning period", async () => {
      const matrix = await getSeasonPlayerRoundMatrix("nonexistent-id", false);

      expect(matrix.roundCount).toBe(0);
      expect(matrix.players).toHaveLength(0);
      expect(matrix.rounds).toHaveLength(0);
    });
  });

  describe("getPlayerLoadSummary", () => {
    it("returns load summary for all players", async () => {
      const summary = await getPlayerLoadSummary(fixtureIds.leagueSeasonId);

      expect(summary.length).toBeGreaterThanOrEqual(9);
      for (const entry of summary) {
        expect(entry).toHaveProperty("playerId");
        expect(entry).toHaveProperty("playerName");
        expect(entry).toHaveProperty("roundsPlayed");
        expect(entry).toHaveProperty("coreMatches");
        expect(entry).toHaveProperty("supportMatches");
      }
    });
  });

  describe("getMovementPathSummary", () => {
    it("returns movement paths for finalized movements", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const hvitTeamId = fixtureIds.teams["Hvit"]!;
      const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);
      const playerForThisTest = blaPlayers[6]!;

      await testDb.movementLedger.create({
        data: {
          matchRoundId: fixtureIds.matchRoundId,
          matchId: fixtureIds.matches["Hvit"]!,
          playerId: playerForThisTest.id,
          fromTeamId: blaTeamId,
          toTeamId: hvitTeamId,
          role: "DEVELOPMENT",
          isDraft: false,
          organisationId: fixtureIds.organisationId,
        },
      });

      const paths = await getMovementPathSummary(fixtureIds.leagueSeasonId);

      const devPath = paths.find((p) => p.role === "DEVELOPMENT" && p.fromTeamName === "Bla" && p.toTeamName === "Hvit");
      expect(devPath).toBeDefined();
      expect(devPath!.count).toBeGreaterThanOrEqual(1);
    });

    it("excludes draft movements when includeDrafts is false", async () => {
      const rodTeamId = fixtureIds.teams["Rod"]!;
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);
      const playerForThisTest = rodPlayers[0]!;

      await testDb.movementLedger.create({
        data: {
          matchRoundId: fixtureIds.matchRoundId,
          matchId: fixtureIds.matches["Bla"]!,
          playerId: playerForThisTest.id,
          fromTeamId: rodTeamId,
          toTeamId: blaTeamId,
          role: "BACKFILL",
          isDraft: true,
          organisationId: fixtureIds.organisationId,
        },
      });

      const pathsExcluded = await getMovementPathSummary(fixtureIds.leagueSeasonId, false);
      const pathsIncluded = await getMovementPathSummary(fixtureIds.leagueSeasonId, true);

      const draftPathExcluded = pathsExcluded.find((p) => p.role === "BACKFILL" && p.fromTeamName === "Rod" && p.toTeamName === "Bla");
      const draftPathIncluded = pathsIncluded.find((p) => p.role === "BACKFILL" && p.fromTeamName === "Rod" && p.toTeamName === "Bla");

      expect(draftPathExcluded).toBeUndefined();
      expect(draftPathIncluded).toBeDefined();
    });
  });

  describe("getPlayerMovementTimeline", () => {
    it("returns timeline entries for player selections", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId && p.firstName === "BPlayer")!;

      const timeline = await getPlayerMovementTimeline(blaPlayer.id, true);

      for (const entry of timeline) {
        expect(entry).toHaveProperty("role");
        expect(entry).toHaveProperty("status");
        expect(entry).toHaveProperty("teamName");
      }
    });

    it("includes fromTeam for support movements from movement ledger", async () => {
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
          organisationId: fixtureIds.organisationId,
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
          organisationId: fixtureIds.organisationId,
        },
      });

      const timeline = await getPlayerMovementTimeline(blaPlayer.id, false);

      const supportEntry = timeline.find((e) => e.role === "SUPPORT");
      expect(supportEntry).toBeDefined();
      expect(supportEntry!.fromTeamName).toBe("Bla");
    });

    it("scopes to planning period when provided", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

      const timeline = await getPlayerMovementTimeline(blaPlayer.id, true, fixtureIds.leagueSeasonId);

      for (const entry of timeline) {
        expect(entry).toHaveProperty("matchRoundId");
      }
    });
  });

  describe("getSeasonFairnessWarnings", () => {
    it("flags high support burden when support exceeds core", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const _hvitTeamId = fixtureIds.teams["Hvit"]!;
      const _rodTeamId = fixtureIds.teams["Rod"]!;
      const blaPlayer = fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

      await testDb.selection.createMany({
        data: [
          { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "CORE", status: "FINALIZED" , organisationId: fixtureIds.organisationId },
          { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: "FINALIZED" , organisationId: fixtureIds.organisationId },
          { matchId: fixtureIds.matches["Rod"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", status: "FINALIZED" , organisationId: fixtureIds.organisationId },
        ],
      });

      const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId);

      const burdenWarning = warnings.find((w) => w.rule === "support_count_exceeds_core" && w.playerId === blaPlayer.id);
      expect(burdenWarning).toBeDefined();
      expect(burdenWarning!.severity).toBe("Planning note");
    });

    it("flags repeated double-load", async () => {
      const blaTeamId = fixtureIds.teams["Bla"]!;
      const blaPlayer = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId)[20] ?? fixtureIds.players.find((p) => p.coreTeamId === blaTeamId)!;

      await testDb.selection.createMany({
        data: [
          { matchId: fixtureIds.matches["Bla"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", controlledDoubleLoad: true, status: "FINALIZED" , organisationId: fixtureIds.organisationId },
          { matchId: fixtureIds.matches["Hvit"]!, matchRoundId: fixtureIds.matchRoundId, playerId: blaPlayer.id, role: "SUPPORT", controlledDoubleLoad: true, status: "FINALIZED" , organisationId: fixtureIds.organisationId },
        ],
      });

      const warnings = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId);

      const doubleLoadWarning = warnings.find((w) => w.rule === "repeated_double_load" && w.playerId === blaPlayer.id);
      expect(doubleLoadWarning).toBeDefined();
      expect(doubleLoadWarning!.severity).toBe("Planning note");
    });

    it("excludes draft data when includeDrafts is false", async () => {
      const rodTeamId = fixtureIds.teams["Rod"]!;
      const hvitTeamId = fixtureIds.teams["Hvit"]!;
      const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);
      const rodPlayer = rodPlayers[rodPlayers.length - 1]!;

      const secondRound = await testDb.matchRound.create({
        data: {
          name: "W20 Test Draft",
          leagueSeasonId: fixtureIds.leagueSeasonId,
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });

      const rodMatch2 = await testDb.match.create({
        data: {
          matchRoundId: secondRound.id,
          teamId: rodTeamId,
          opponent: "Opponent Rod 2",
          startsAt: new Date("2025-05-05T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          organisationId: fixtureIds.organisationId,
        },
      });

      const hvitMatch2 = await testDb.match.create({
        data: {
          matchRoundId: secondRound.id,
          teamId: hvitTeamId,
          opponent: "Opponent Hvit 2",
          startsAt: new Date("2025-05-05T12:00:00Z"),
          homeAway: "AWAY",
          squadSize: 11,
          matchType: "FRIENDLY",
          organisationId: fixtureIds.organisationId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: fixtureIds.matches["Rod"]!,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: rodPlayer.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: fixtureIds.matches["Hvit"]!,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: rodPlayer.id,
          role: "SUPPORT",
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: hvitMatch2.id,
          matchRoundId: secondRound.id,
          playerId: rodPlayer.id,
          role: "SUPPORT",
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });

      const warningsExcluded = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, false);
      const draftWarningExcluded = warningsExcluded.find((w) => w.playerId === rodPlayer.id);

      const warningsIncluded = await getSeasonFairnessWarnings(fixtureIds.leagueSeasonId, true);
      const draftWarningIncluded = warningsIncluded.find((w) => w.playerId === rodPlayer.id && w.rule === "support_count_exceeds_core");

      expect(draftWarningExcluded).toBeUndefined();
      expect(draftWarningIncluded).toBeDefined();
    });
  });
});