import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { normalizeOpponentName } from "@/lib/opponents/opponent-team";
import { auditDataIntegrity } from "./audit-data-integrity";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("auditDataIntegrity", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("mandatory checks", () => {
    afterEach(async () => {
      await testDb.goal.deleteMany({});
      await testDb.matchReportPlayerStat.deleteMany({});
      await testDb.postMatchPlayerActual.deleteMany({});
      await testDb.matchReportAbsence.deleteMany({});
      await testDb.postMatchReport.deleteMany({});
      await testDb.selection.deleteMany({
        where: { status: "FINALIZED", matchRoundId: fixture.matchRoundId },
      });
    });

    it("detects goal aggregate differing from goal events", async () => {
      const matchId = fixture.matches["Bla"]!;
      const playerId = fixture.players[0]!.id;

      const report = await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "REPORTED",
          homeGoals: 3,
          awayGoals: 1,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          reportId: report.id,
          matchId,
          playerId,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
        },
      });

      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });
      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });

      await testDb.matchReportPlayerStat.create({
        data: {
          matchReportId: report.id,
          playerId,
          goals: 5,
          assists: 0,
        },
      });

      const result = await auditDataIntegrity({ matchId }, testDb);

      const goalFinding = result.findings.find(
        (f) => f.code === "PLAYER_GOAL_AGGREGATE_DIFFERS_FROM_GOAL_EVENTS" && f.playerId === playerId,
      );

      expect(goalFinding).toBeDefined();
      expect(goalFinding!.canonicalValue).toBe(2);
      expect(goalFinding!.conflictingValue).toBe(5);
      expect(goalFinding!.repairability).toBe("REQUIRES_FACTUAL_REVIEW");
    });

    it("detects UNKNOWN attendance in REPORTED report", async () => {
      const matchId = fixture.matches["Hvit"]!;
      const playerId = fixture.players[1]!.id;

      const report = await testDb.postMatchReport.create({
        data: { matchId, status: "REPORTED" },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          reportId: report.id,
          matchId,
          playerId,
          source: "PLANNED",
          attendanceStatus: "UNKNOWN",
        },
      });

      const result = await auditDataIntegrity({ matchId }, testDb);

      const unknownFinding = result.findings.find(
        (f) => f.code === "REPORTED_REPORT_HAS_UNKNOWN_ATTENDANCE" && f.playerId === playerId,
      );

      expect(unknownFinding).toBeDefined();
      expect(unknownFinding!.severity).toBe("ERROR");
      expect(unknownFinding!.repairability).toBe("REQUIRES_FACTUAL_REVIEW");
    });

    it("detects planned player not present without absence reason", async () => {
      const matchId = fixture.matches["Rod"]!;
      const playerId = fixture.players[2]!.id;

      await testDb.postMatchReport.create({
        data: { matchId, status: "LOCKED" },
      });

      await testDb.selection.create({
        data: {
          matchId,
          matchRoundId: fixture.matchRoundId,
          playerId,
          role: "CORE",
          status: "FINALIZED",
        },
      });

      const result = await auditDataIntegrity({ matchId }, testDb);

      const absenceFinding = result.findings.find(
        (f) => f.code === "PLANNED_PLAYER_NOT_PRESENT_WITHOUT_ABSENCE_REASON" && f.playerId === playerId,
      );

      expect(absenceFinding).toBeDefined();
      expect(absenceFinding!.severity).toBe("REVIEW");
    });

    it("detects goal events exceeding own team score", async () => {
      const matchId = fixture.matches["Bla"]!;
      const playerId = fixture.players[0]!.id;

      const existingMatch = await testDb.match.findUniqueOrThrow({
        where: { id: matchId },
        select: { homeAway: true },
      });

      await testDb.match.update({
        where: { id: matchId },
        data: { homeAway: "HOME" },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "REPORTED",
          homeGoals: 1,
          awayGoals: 0,
        },
      });

      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });
      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });
      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });

      const result = await auditDataIntegrity({ matchId }, testDb);

      const scoreFinding = result.findings.find(
        (f) => f.code === "GOAL_EVENT_COUNT_EXCEEDS_RECORDED_TEAM_SCORE" && f.matchId === matchId,
      );

      expect(scoreFinding).toBeDefined();
      expect(scoreFinding!.severity).toBe("ERROR");
      expect(scoreFinding!.repairability).toBe("REQUIRES_FACTUAL_REVIEW");

      await testDb.match.update({
        where: { id: matchId },
        data: { homeAway: existingMatch.homeAway },
      });
    });

    it("does not flag fewer goal events than team score", async () => {
      const matchId = fixture.matches["Hvit"]!;
      const playerId = fixture.players[1]!.id;

      const report = await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "REPORTED",
          homeGoals: 5,
          awayGoals: 2,
        },
      });

      await testDb.goal.create({
        data: { reportId: report.id, playerId, type: "NORMAL" },
      });

      const result = await auditDataIntegrity({ matchId }, testDb);

      const scoreFinding = result.findings.find(
        (f) => f.code === "GOAL_EVENT_COUNT_EXCEEDS_RECORDED_TEAM_SCORE",
      );

      expect(scoreFinding).toBeUndefined();
    });
  });

  describe("candidate domain checks", () => {
    afterEach(async () => {
      await testDb.match.deleteMany({
        where: { matchRoundId: fixture.matchRoundId, opponent: "Different Snapshot Name" },
      });
    });

    it("detects opponent snapshot differing from persisted entity", async () => {
      const teamId = fixture.teams["Bla"]!;
      const opponentTeamId = fixture.opponentTeamIds[normalizeOpponentName("Opponent Bla")] ?? Object.values(fixture.opponentTeamIds)[0]!;

      const match = await testDb.match.create({
        data: {
          matchRoundId: fixture.matchRoundId,
          teamId,
          opponentTeamId,
          opponent: "Different Snapshot Name",
          startsAt: new Date(),
          homeAway: "HOME",
        },
      });

      const result = await auditDataIntegrity(undefined, testDb);

      const opponentFinding = result.findings.find(
        (f) => f.code === "OPPONENT_SNAPSHOT_DIFFERS_FROM_ENTITY" && f.entityId === match.id,
      );

      expect(opponentFinding).toBeDefined();
      expect(opponentFinding!.repairability).toBe("REPORT_ONLY");
    });

    it("detects support config divergence between minSupportCount and minSupportPlayers", async () => {
      const teamId = fixture.teams["Bla"]!;
      const original = await testDb.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { minSupportCount: true, minSupportPlayers: true },
      });

      await testDb.team.update({
        where: { id: teamId },
        data: { minSupportCount: 2, minSupportPlayers: 3 },
      });

      const result = await auditDataIntegrity(undefined, testDb);

      const configFinding = result.findings.find(
        (f) => f.code === "SUPPORT_CONFIG_COUNT_PLAYER_MISMATCH" && f.entityId === teamId,
      );

      expect(configFinding).toBeDefined();
      expect(configFinding!.repairability).toBe("REPORT_ONLY");

      await testDb.team.update({
        where: { id: teamId },
        data: { minSupportCount: original.minSupportCount, minSupportPlayers: original.minSupportPlayers },
      });
    });
  });

  describe("scope and output", () => {
    it("returns audit result with correct structure", async () => {
      const result = await auditDataIntegrity(undefined, testDb);

      expect(result).toHaveProperty("executedAt");
      expect(result).toHaveProperty("scope");
      expect(result).toHaveProperty("countsByDomain");
      expect(result).toHaveProperty("countsBySeverity");
      expect(result).toHaveProperty("findings");
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it("scopes to matchId when provided", async () => {
      const matchId = fixture.matches["Bla"]!;
      const result = await auditDataIntegrity({ matchId }, testDb);

      for (const finding of result.findings) {
        if (finding.matchId) {
          expect(finding.matchId).toBe(matchId);
        }
      }
    });

    it("is strictly read-only and does not modify data", async () => {
      const playerCountBefore = await testDb.player.count();
      const matchCountBefore = await testDb.match.count();

      await auditDataIntegrity(undefined, testDb);

      const playerCountAfter = await testDb.player.count();
      const matchCountAfter = await testDb.match.count();

      expect(playerCountAfter).toBe(playerCountBefore);
      expect(matchCountAfter).toBe(matchCountBefore);
    });
  });
});