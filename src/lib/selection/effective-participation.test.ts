import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
} from "@/test/test-db";
import {
  isCoreRole,
  isSupportRole,
  isDevelopmentRole,
  isFloatingRole,
  classifyRole,
  getEffectiveMatchParticipation,
  getEffectiveSeasonStats,
} from "./effective-participation";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

let testDb: PrismaClient;
let testOrgId: string;
let testGroupId: string;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testOpponentTeamId: string;

async function ensureTestOpponentTeam(db: PrismaClient, name: string): Promise<string> {
  const normalizedName = normalizeOpponentName(name);
  const displayName = cleanOpponentDisplayName(name);
  const ot = await db.opponentTeam.upsert({
    where: { organisationId_normalizedName: { organisationId: testOrgId, normalizedName } },
    update: { displayName },
    create: { displayName, normalizedName, organisationId: testOrgId },
  });
  return ot.id;
}

describe("Effective participation helpers", () => {
  describe("isCoreRole", () => {
    it("returns true for CORE", () => {
      expect(isCoreRole("CORE")).toBe(true);
    });

    it("returns false for non-CORE roles", () => {
      expect(isCoreRole("SUPPORT")).toBe(false);
      expect(isCoreRole("DEVELOPMENT")).toBe(false);
      expect(isCoreRole("BACKFILL")).toBe(false);
      expect(isCoreRole("CONFIDENCE_REBUILD")).toBe(false);
    });
  });

  describe("isSupportRole", () => {
    it("returns true for SUPPORT", () => {
      expect(isSupportRole("SUPPORT")).toBe(true);
    });

    it("returns true for legacy BACKFILL role", () => {
      expect(isSupportRole("BACKFILL")).toBe(true);
    });

    it("returns false for non-support roles", () => {
      expect(isSupportRole("CORE")).toBe(false);
      expect(isSupportRole("DEVELOPMENT")).toBe(false);
      expect(isSupportRole("CONFIDENCE_REBUILD")).toBe(false);
    });
  });

  describe("isDevelopmentRole", () => {
    it("returns true for DEVELOPMENT", () => {
      expect(isDevelopmentRole("DEVELOPMENT")).toBe(true);
    });

    it("returns true for legacy CONFIDENCE_REBUILD role", () => {
      expect(isDevelopmentRole("CONFIDENCE_REBUILD")).toBe(true);
    });

    it("returns false for non-development roles", () => {
      expect(isDevelopmentRole("CORE")).toBe(false);
      expect(isDevelopmentRole("SUPPORT")).toBe(false);
      expect(isDevelopmentRole("BACKFILL")).toBe(false);
    });
  });

  describe("isFloatingRole", () => {
    it("returns true for all floating roles", () => {
      expect(isFloatingRole("SUPPORT")).toBe(true);
      expect(isFloatingRole("DEVELOPMENT")).toBe(true);
      expect(isFloatingRole("BACKFILL")).toBe(true);
      expect(isFloatingRole("CONFIDENCE_REBUILD")).toBe(true);
      expect(isFloatingRole("CORE_MATCH_DROP")).toBe(true);
      expect(isFloatingRole("REDUCED_MATCH_LOAD_DROP")).toBe(true);
    });

    it("returns false for CORE", () => {
      expect(isFloatingRole("CORE")).toBe(false);
    });

    it("returns false for MANUAL_OVERRIDE", () => {
      expect(isFloatingRole("MANUAL_OVERRIDE")).toBe(false);
    });
  });

  describe("classifyRole", () => {
    it("classifies CORE as core", () => {
      expect(classifyRole("CORE")).toBe("core");
    });

    it("classifies SUPPORT as support", () => {
      expect(classifyRole("SUPPORT")).toBe("support");
    });

    it("classifies legacy BACKFILL as support", () => {
      expect(classifyRole("BACKFILL")).toBe("support");
    });

    it("classifies DEVELOPMENT as development", () => {
      expect(classifyRole("DEVELOPMENT")).toBe("development");
    });

    it("classifies legacy CONFIDENCE_REBUILD as development", () => {
      expect(classifyRole("CONFIDENCE_REBUILD")).toBe("development");
    });
  });
});

describe("Effective participation database queries", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    const org = await testDb.organisation.create({ data: { name: "EffPart Test Org", slug: `effpart-org-${Date.now()}` } });
    testOrgId = org.id;
    testGroupId = await createTestGroup(testDb, testOrgId);
    testOpponentTeamId = await ensureTestOpponentTeam(testDb, "Test Opponent Team");
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("match with no report", () => {
    it("returns finalized selections as PLANNED_FINALIZED", async () => {
      await testDb.ruleConfig.create({
        data: { name: "Test rules", minDaysBetweenAnyMatches: 3, warningThreshold: 5, organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const season = await testDb.season.create({ data: { name: "Test Season", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 No Report", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamA",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent A",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const player1 = await testDb.player.create({
        data: {
          playerCode: 2001,
          firstName: "Test",
          lastName: "Player1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const player2 = await testDb.player.create({
        data: {
          playerCode: 2002,
          firstName: "Test",
          lastName: "Player2",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CM",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player1.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player2.id,
          role: "SUPPORT",
          status: "DRAFT",
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const finalized = rows.find((r) => r.playerId === player1.id);
      expect(finalized).toBeDefined();
      expect(finalized!.source).toBe("PLANNED_FINALIZED");
      expect(finalized!.plannedRole).toBe("CORE");
      expect(finalized!.countsForLoad).toBe(true);
      expect(finalized!.countsForFairness).toBe(true);
      expect(finalized!.countsForSeasonStats).toBe(false);
      expect(finalized!.played).toBe(false);

      const draft = rows.find((r) => r.playerId === player2.id);
      expect(draft).toBeDefined();
      expect(draft!.source).toBe("PLANNED_DRAFT");
      expect(draft!.plannedRole).toBe("SUPPORT");
      expect(draft!.countsForLoad).toBe(false);
      expect(draft!.countsForFairness).toBe(false);
      expect(draft!.countsForSeasonStats).toBe(false);
    });
  });

  describe("match with REPORTED status", () => {
    it("uses actuals as source of truth", async () => {
      await testDb.ruleConfig.create({
        data: { name: "Test rules 2", minDaysBetweenAnyMatches: 3, warningThreshold: 5, organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const season = await testDb.season.create({ data: { name: "Test Season 2", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 2",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 Reported", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamB",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent B",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const player1 = await testDb.player.create({
        data: {
          playerCode: 3001,
          firstName: "Test",
          lastName: "PlayerB1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const player2 = await testDb.player.create({
        data: {
          playerCode: 3002,
          firstName: "Test",
          lastName: "PlayerB2",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CM",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const player3 = await testDb.player.create({
        data: {
          playerCode: 3003,
          firstName: "Test",
          lastName: "AbsentB1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "GK",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player1.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player2.id,
          role: "SUPPORT",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player3.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "REPORTED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: player1.id,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: player2.id,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      await testDb.matchReportAbsence.create({
        data: {
          matchReportId: report.id,
          matchId: match.id,
          playerId: player3.id,
          reason: "SICK",
          organisationId: testOrgId,
        },
      });

      await testDb.matchReportPlayerStat.create({
        data: {
          matchReportId: report.id,
          playerId: player1.id,
          goals: 2,
          assists: 1,
          organisationId: testOrgId,
        },
      });

      await testDb.goal.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });
      await testDb.goal.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });
      await testDb.assist.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const present = rows.find((r) => r.playerId === player1.id);
      expect(present).toBeDefined();
      expect(present!.source).toBe("ACTUAL_REPORTED");
      expect(present!.played).toBe(true);
      expect(present!.plannedRole).toBe("CORE");
      expect(present!.goals).toBe(2);
      expect(present!.assists).toBe(1);
      expect(present!.countsForLoad).toBe(true);
      expect(present!.countsForFairness).toBe(true);
      expect(present!.countsForSeasonStats).toBe(true);

      const absent = rows.find((r) => r.playerId === player3.id);
      expect(absent).toBeDefined();
      expect(absent!.played).toBe(false);
      expect(absent!.absenceReason).toBe("SICK");
      expect(absent!.countsForLoad).toBe(false);
      expect(absent!.countsForFairness).toBe(false);
      expect(absent!.countsForSeasonStats).toBe(false);
    });

    it("excludes NO_SHOW players from participation", async () => {
      const season = await testDb.season.create({ data: { name: "Test Season 3", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 3",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 NoShow", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamNoShow",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent NS",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const playerNoShow = await testDb.player.create({
        data: {
          playerCode: 4001,
          firstName: "NoShow",
          lastName: "Player",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: playerNoShow.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "REPORTED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: playerNoShow.id,
          source: "PLANNED",
          attendanceStatus: "NO_SHOW",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const noShowPlaying = rows.find(
        (r) => r.playerId === playerNoShow.id && r.played === true,
      );
      expect(noShowPlaying).toBeUndefined();

      const noShowRecord = rows.find((r) => r.playerId === playerNoShow.id);
      expect(noShowRecord).toBeDefined();
      expect(noShowRecord!.played).toBe(false);
      expect(noShowRecord!.absenceReason).toBe("NO_SHOW");
      expect(noShowRecord!.countsForLoad).toBe(false);
      expect(noShowRecord!.countsForFairness).toBe(false);
    });

    it("includes added-post-match players", async () => {
      const season = await testDb.season.create({ data: { name: "Test Season 4", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 4",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 Added", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamAdded",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent Add",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const addedPlayer = await testDb.player.create({
        data: {
          playerCode: 5001,
          firstName: "Added",
          lastName: "PostMatch",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "W",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "REPORTED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: addedPlayer.id,
          source: "ADDED_POST_MATCH",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const added = rows.find((r) => r.playerId === addedPlayer.id);
      expect(added).toBeDefined();
      expect(added!.actualSource).toBe("ADDED_POST_MATCH");
      expect(added!.played).toBe(true);
      expect(added!.countsForLoad).toBe(true);
      expect(added!.countsForSeasonStats).toBe(true);
    });

    it("includes emergency backfill players", async () => {
      const season = await testDb.season.create({ data: { name: "Test Season 5", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 5",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 Emergency", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamEmergency",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent Emerg",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const emergPlayer = await testDb.player.create({
        data: {
          playerCode: 6001,
          firstName: "Emergency",
          lastName: "Backfill",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "ST",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "REPORTED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: emergPlayer.id,
          source: "EMERGENCY_BACKFILL",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const emerg = rows.find((r) => r.playerId === emergPlayer.id);
      expect(emerg).toBeDefined();
      expect(emerg!.actualSource).toBe("EMERGENCY_BACKFILL");
      expect(emerg!.played).toBe(true);
      expect(emerg!.countsForLoad).toBe(true);
    });
  });

  describe("match with DRAFT report", () => {
    it("uses finalized selections, not draft report data", async () => {
      const season = await testDb.season.create({ data: { name: "Test Season 6", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 6",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 DraftReport", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamDraftReport",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent DR",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const player1 = await testDb.player.create({
        data: {
          playerCode: 7001,
          firstName: "DraftRpt",
          lastName: "Player1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player1.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "DRAFT",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: player1.id,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const row = rows.find((r) => r.playerId === player1.id);
      expect(row).toBeDefined();
      expect(row!.source).toBe("PLANNED_FINALIZED");
      expect(row!.reportStatus).toBe("DRAFT");
      expect(row!.played).toBe(false);
      expect(row!.countsForLoad).toBe(true);
      expect(row!.countsForFairness).toBe(true);
      expect(row!.countsForSeasonStats).toBe(false);
    });
  });

  describe("match with LOCKED report", () => {
    it("uses ACTUAL_LOCKED source for locked reports", async () => {
      const season = await testDb.season.create({ data: { name: "Test Season 7", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Test Period 7",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 Locked", leagueSeasonId: period.id, status: "FINALIZED" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamLocked",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent L",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const player1 = await testDb.player.create({
        data: {
          playerCode: 8001,
          firstName: "Locked",
          lastName: "Player1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player1.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "LOCKED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: player1.id,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      const rows = await getEffectiveMatchParticipation(match.id);

      const row = rows.find((r) => r.playerId === player1.id);
      expect(row).toBeDefined();
      expect(row!.source).toBe("ACTUAL_LOCKED");
      expect(row!.played).toBe(true);
      expect(row!.countsForLoad).toBe(true);
      expect(row!.countsForFairness).toBe(true);
      expect(row!.countsForSeasonStats).toBe(true);
    });
  });

  describe("getEffectiveSeasonStats", () => {
    it("computes season stats including role classification and flags", async () => {
      const season = await testDb.season.create({ data: { name: "Stats Season", year: 2026, organisationId: testOrgId } });
      const period = await testDb.leagueSeason.create({
        data: {
          name: "Stats Period",
          part: "SPRING",
          seasonId: season.id,
          startDate: new Date("2025-01-06"),
          endDate: new Date("2025-06-30"),
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const round = await testDb.matchRound.create({
        data: { name: "W1 Stats", leagueSeasonId: period.id, status: "DRAFT" , organisationId: testOrgId },
      });
      const team = await testDb.team.create({
        data: {
          name: "TeamStats",
          targetSquadSize: 8,
          minCorePlayers: 5,
          targetSupportCount: 0,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 0,
          minAcceptedSquadSize: 5,
          maxSquadSize: 14,
          organisationId: testOrgId,
          footballGroupId: testGroupId,
        },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Opponent Stats",
          opponentTeamId: testOpponentTeamId,
          startsAt: new Date("2025-05-01T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 8,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const player1 = await testDb.player.create({
        data: {
          playerCode: 9001,
          firstName: "Stats",
          lastName: "Player1",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CB",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      await testDb.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: round.id,
          playerId: player1.id,
          role: "SUPPORT",
          status: "FINALIZED",
          organisationId: testOrgId,
        },
      });

      const report = await testDb.postMatchReport.create({
        data: {
          matchId: match.id,
          status: "REPORTED",
          organisationId: testOrgId,
        },
      });

      await testDb.postMatchPlayerActual.create({
        data: {
          matchId: match.id,
          playerId: player1.id,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          reportId: report.id,
          organisationId: testOrgId,
        },
      });

      await testDb.matchReportPlayerStat.create({
        data: {
          matchReportId: report.id,
          playerId: player1.id,
          goals: 1,
          assists: 2,
          organisationId: testOrgId,
        },
      });

      await testDb.goal.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });

      await testDb.assist.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });
      await testDb.assist.create({
        data: { reportId: report.id, playerId: player1.id, type: "NORMAL" , organisationId: testOrgId },
      });

      const stats = await getEffectiveSeasonStats(player1.id, period.id);

      expect(stats.playerId).toBe(player1.id);
      expect(stats.actualAppearances).toBe(1);
      expect(stats.supportCount).toBe(1);
      expect(stats.coreCount).toBe(0);
      expect(stats.developmentCount).toBe(0);
      expect(stats.goals).toBe(1);
      expect(stats.assists).toBe(2);
      expect(stats.flags).not.toContain("support_count_exceeds_core");
    });
  });
});