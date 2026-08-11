import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext();

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  seedMatchReport,
  addActualPlayer,
  updateAttendanceStatus,
  markPlannedAbsence,
  removePlannedAbsence,
  updatePlayerStats,
  submitMatchReport,
  lockMatchReport,
  completeMatchReport,
  reopenMatchReport,
  updateMatchResult,
  addGoalToReport,
  removeGoalFromReport,
} from "../actions";

async function cleanup() {
  await testDb.matchReportPlayerStat.deleteMany();
  await testDb.matchReportAbsence.deleteMany();
  await testDb.goal.deleteMany();
  await testDb.postMatchPlayerActual.deleteMany();
  await testDb.postMatchReport.deleteMany();
  await testDb.selection.deleteMany();
}

describe("Post-match report lifecycle", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("seedMatchReport", () => {
    it("creates a DRAFT report from finalized selections", async () => {
      const matchId = fixture.matches.Bla;
      if (!matchId) return;

      await testDb.selection.createMany({
        data: fixture.players.filter((p) => p.coreTeamName === "Bla").slice(0, 3).map((p) => ({
          matchId,
          matchRoundId: fixture.matchRoundId,
          playerId: p.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: fixture.organisationId,
        })),
      });

      const result = await seedMatchReport(matchId);
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();

      const report = await testDb.postMatchReport.findUnique({
        where: { matchId },
        include: { playerActuals: true },
      });
      expect(report).not.toBeNull();
      expect(report!.status).toBe("DRAFT");
      expect(report!.playerActuals).toHaveLength(3);

      await cleanup();
    });
  });

  describe("full lifecycle: DRAFT → REPORTED → LOCKED → reopen", () => {
    it("transitions through the full lifecycle", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const hvitPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      expect(seedResult.success).toBe(true);
      const reportId = seedResult.reportId!;

      const report = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(report!.status).toBe("DRAFT");

      const addResult = await addActualPlayer(reportId, {
        playerId: hvitPlayer.id,
        attendanceStatus: "PRESENT",
      });
      expect(addResult.success).toBe(true);

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      const submitResult = await submitMatchReport(reportId);
      expect(submitResult.success).toBe(true);

      const reported = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(reported!.status).toBe("REPORTED");

      const setResult = await updateMatchResult(reportId, { homeGoals: 3, awayGoals: 1 });
      expect(setResult.success).toBe(true);

      const lockResult = await lockMatchReport(reportId);
      expect(lockResult.success).toBe(true);

      const locked = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(locked!.status).toBe("LOCKED");

      const addBlocked = await addActualPlayer(reportId, {
        playerId: hvitPlayer.id,
        attendanceStatus: "PRESENT",
      });
      expect(addBlocked.success).toBe(false);

      const reopenResult = await reopenMatchReport(reportId, "REPORTED");
      expect(reopenResult.success).toBe(true);

      const reopened = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(reopened!.status).toBe("REPORTED");

      const reopenDraftResult = await reopenMatchReport(reportId, "DRAFT");
      expect(reopenDraftResult.success).toBe(true);

      const draftAgain = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(draftAgain!.status).toBe("DRAFT");

      await cleanup();
    });
  });

  describe("planned absences", () => {
    it("marks and removes planned absences", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const absenceResult = await markPlannedAbsence(reportId, {
        playerId: blaPlayer.id,
        reason: "SICK",
        note: "Flu",
      });
      expect(absenceResult.success).toBe(true);

      const absence = await testDb.matchReportAbsence.findFirst({
        where: { matchReportId: reportId, playerId: blaPlayer.id },
      });
      expect(absence).not.toBeNull();
      expect(absence!.reason).toBe("SICK");
      expect(absence!.note).toBe("Flu");

      const removeResult = await removePlannedAbsence(absence!.id);
      expect(removeResult.success).toBe(true);

      const gone = await testDb.matchReportAbsence.findFirst({
        where: { matchReportId: reportId, playerId: blaPlayer.id },
      });
      expect(gone).toBeNull();

      await cleanup();
    });
  });

  describe("player stats", () => {
    it("updates goals and assists for a player in the actual squad", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      await submitMatchReport(reportId);

      const statsResult = await updatePlayerStats(reportId, {
        playerId: blaPlayer.id,
        goals: 2,
        assists: 1,
      });
      expect(statsResult.success).toBe(true);

      const stat = await testDb.matchReportPlayerStat.findUnique({
        where: { matchReportId_playerId: { matchReportId: reportId, playerId: blaPlayer.id } },
      });
      expect(stat).not.toBeNull();
      expect(stat!.goals).toBe(2);
      expect(stat!.assists).toBe(1);

      await cleanup();
    });

    it("rejects stats for player not in actual squad", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const hvitPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const statsResult = await updatePlayerStats(reportId, {
        playerId: hvitPlayer.id,
        goals: 1,
        assists: 0,
      });
      expect(statsResult.success).toBe(false);
      expect(statsResult.error).toContain("must be in actual squad");

      await cleanup();
    });
  });

  describe("goals", () => {
    it("adds and removes goals from a report", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const addGoalResult = await addGoalToReport(reportId, {
        playerId: blaPlayer.id,
        minute: 23,
        type: "NORMAL",
      });
      expect(addGoalResult.success).toBe(true);

      const goals = await testDb.goal.findMany({ where: { reportId } });
      expect(goals).toHaveLength(1);
      expect(goals[0].minute).toBe(23);

      const removeResult = await removeGoalFromReport(goals[0].id);
      expect(removeResult.success).toBe(true);

      const remaining = await testDb.goal.findMany({ where: { reportId } });
      expect(remaining).toHaveLength(0);

      await cleanup();
    });
  });

  describe("attendance status", () => {
    it("updates attendance for an actual player", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const actual = await testDb.postMatchPlayerActual.findFirst({
        where: { reportId, playerId: blaPlayer.id },
      });
      expect(actual).not.toBeNull();

      const updateResult = await updateAttendanceStatus(actual!.id, "NO_SHOW");
      expect(updateResult.success).toBe(true);

      const updated = await testDb.postMatchPlayerActual.findUnique({ where: { id: actual!.id } });
      expect(updated!.attendanceStatus).toBe("NO_SHOW");

      await cleanup();
    });
  });

  describe("blocked edits when LOCKED", () => {
    it("blocks all edits when report is LOCKED", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const hvitPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      await submitMatchReport(reportId);
      await lockMatchReport(reportId);

      const addResult = await addActualPlayer(reportId, {
        playerId: hvitPlayer.id,
        attendanceStatus: "PRESENT",
      });
      expect(addResult.success).toBe(false);

      const setResult = await updateMatchResult(reportId, { homeGoals: 5 });
      expect(setResult.success).toBe(false);

      const absResult = await markPlannedAbsence(reportId, {
        playerId: blaPlayer.id,
        reason: "SICK",
      });
      expect(absResult.success).toBe(false);

      const goalResult = await addGoalToReport(reportId, {
        playerId: blaPlayer.id,
        minute: 10,
        type: "NORMAL",
      });
      expect(goalResult.success).toBe(false);

      await cleanup();
    });
  });

  describe("UNKNOWN attendance blocks submission and locking", () => {
    it("rejects submit when player has UNKNOWN attendance", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const submitResult = await submitMatchReport(reportId);
      expect(submitResult.success).toBe(false);
      expect(submitResult.error).toContain("UNKNOWN attendance");

      await cleanup();
    });

    it("rejects lock when player has UNKNOWN attendance", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      const submitResult = await submitMatchReport(reportId);
      expect(submitResult.success).toBe(true);

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId },
        data: { attendanceStatus: "UNKNOWN" },
      });

      const lockResult = await lockMatchReport(reportId);
      expect(lockResult.success).toBe(false);
      expect(lockResult.error).toContain("UNKNOWN attendance");

      await cleanup();
    });
  });

  describe("completeMatchReport", () => {
    it("transitions DRAFT → LOCKED directly", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      expect(seedResult.success).toBe(true);
      const reportId = seedResult.reportId!;

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      const completeResult = await completeMatchReport(reportId);
      expect(completeResult.success).toBe(true);

      const locked = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(locked!.status).toBe("LOCKED");
      expect(locked!.completedAt).not.toBeNull();
      expect(locked!.completedBy).not.toBeNull();

      await cleanup();
    });

    it("rejects when UNKNOWN attendance exists", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      const completeResult = await completeMatchReport(reportId);
      expect(completeResult.success).toBe(false);
      expect(completeResult.error).toContain("UNKNOWN attendance");

      await cleanup();
    });

    it("transitions REPORTED → LOCKED", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      const submitResult = await submitMatchReport(reportId);
      expect(submitResult.success).toBe(true);

      const completeResult = await completeMatchReport(reportId);
      expect(completeResult.success).toBe(true);

      const locked = await testDb.postMatchReport.findUnique({ where: { id: reportId } });
      expect(locked!.status).toBe("LOCKED");

      await cleanup();
    });

    it("rejects LOCKED report", async () => {
      const matchId = fixture.matches.Bla!;
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: blaPlayer.id, role: "CORE" as const, status: "FINALIZED" , organisationId: fixture.organisationId},
      });

      const seedResult = await seedMatchReport(matchId);
      const reportId = seedResult.reportId!;

      await testDb.postMatchPlayerActual.updateMany({
        where: { reportId, attendanceStatus: "UNKNOWN" },
        data: { attendanceStatus: "PRESENT" },
      });

      await submitMatchReport(reportId);
      await lockMatchReport(reportId);

      const completeResult = await completeMatchReport(reportId);
      expect(completeResult.success).toBe(false);
      expect(completeResult.error).toContain("DRAFT or REPORTED");

      await cleanup();
    });
  });
});