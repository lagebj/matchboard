import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SelectionStatus } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
  type TestFixtureIds,
} from "@/test/test-db";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

let testDb: PrismaClient;
let testOrgId: string;
let testGroupId: string;

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

async function createFreshFixture(): Promise<TestFixtureIds> {
  await import("@/test/test-db");

  const org = await testDb.organisation.create({
    data: { name: `Org ${Date.now()}`, slug: `org-clear-${Date.now()}` },
  });
  testOrgId = org.id;
  testGroupId = await createTestGroup(testDb, testOrgId);

  const season = await testDb.season.create({
    data: { name: `Season ${Date.now()}`, year: 2026, organisationId: testOrgId },
  });
  const period = await testDb.leagueSeason.create({
    data: {
      name: `Period ${Date.now()}`,
      part: "SPRING",
      seasonId: season.id,
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-06-30"),
      organisationId: testOrgId,
        footballGroupId: testGroupId,
    },
  });
  const round = await testDb.matchRound.create({
    data: {
      name: `Round ${Date.now()}`,
      leagueSeasonId: period.id,
      status: "DRAFT",
      organisationId: testOrgId,
    },
  });

  const teams = [
    { name: "Bla", priority: 3 },
    { name: "Hvit", priority: 1 },
    { name: "Rod", priority: 2 },
  ];
  const teamIds: Record<string, string> = {};
  for (const t of teams) {
    const team = await testDb.team.create({
      data: {
        name: `${t.name} ${Date.now()}`,
        targetSquadSize: 11,
        minCorePlayers: 8,
        targetSupportCount: 0,
        maxSupportCount: 5,
        minSupportPlayers: 0,
        supportPriority: t.priority,
        developmentSlots: 3,
        minAcceptedSquadSize: 9,
        maxSquadSize: 14,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    teamIds[t.name] = team.id;
  }

  const matchIds: Record<string, string> = {};
  const opponentTeamIds: Record<string, string> = {};
  const baseDate = new Date("2025-04-28T10:00:00Z");
  for (const t of teams) {
    const opponentName = `Opp ${t.name}`;
    const normalizedName = normalizeOpponentName(opponentName);
    const displayName = cleanOpponentDisplayName(opponentName);
    let opponentTeamId = opponentTeamIds[normalizedName];
    if (!opponentTeamId) {
      const ot = await testDb.opponentTeam.upsert({
        where: { normalizedName },
        update: { displayName },
        create: { displayName, normalizedName, organisationId: testOrgId },
      });
      opponentTeamId = ot.id;
      opponentTeamIds[normalizedName] = opponentTeamId;
    }
    const match = await testDb.match.create({
      data: {
        matchRoundId: round.id,
        teamId: teamIds[t.name]!,
        opponent: opponentName,
        opponentTeamId,
        startsAt: baseDate,
        homeAway: "HOME",
        squadSize: 11,
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: testOrgId,
      },
    });
    matchIds[t.name] = match.id;
  }

  const positions = ["GK", "CB", "CM", "W", "ST"];
  const players: TestFixtureIds["players"] = [];
  let playerCode = Math.floor(Math.random() * 90000) + 10000;
  for (const t of teams) {
    for (let i = 0; i < 12; i++) {
      const pos = positions[i % positions.length];
      const player = await testDb.player.create({
        data: {
          playerCode: playerCode++,
          firstName: `${t.name}P`,
          lastName: `${i + 1}`,
          active: true,
          coreTeamId: teamIds[t.name]!,
          primaryPosition: pos,
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: testOrgId,
        },
      });
      players.push({
        id: player.id,
        coreTeamId: teamIds[t.name]!,
        coreTeamName: t.name,
        firstName: player.firstName,
        lastName: player.lastName ?? "",
        primaryPosition: pos,
        playerCode: player.playerCode,
      });
    }
  }

  return {
    organisationId: testOrgId,
    footballGroupId: testGroupId,
    seasonId: season.id,
    leagueSeasonId: period.id,
    matchRoundId: round.id,
    teams: teamIds,
    players,
    matches: matchIds,
    opponentTeamIds,
    rotationPathIds: [],
  };
}

describe("clear-draft-selection", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("clearAllDraftSelections", () => {
    it("removes only DRAFT selections (not FINALIZED)", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: fx.players.find((p) => p.coreTeamName === "Hvit")!.id,
          role: "MANUAL_OVERRIDE",
          status: SelectionStatus.FINALIZED,
          organisationId: testOrgId,
        },
      });

      const { clearAllDraftSelections } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      const result = await clearAllDraftSelections(fx.leagueSeasonId);

      expect(result.selectionsDeleted).toBe(1);

      const remaining = await testDb.selection.findMany({
        where: { matchRoundId: fx.matchRoundId },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].status).toBe(SelectionStatus.FINALIZED);
    });

    it("removes draft warnings and draft movement ledger entries", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.movementLedger.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          playerId: blaPlayer.id,
          fromTeamId: blaPlayer.coreTeamId,
          toTeamId: fx.teams["Bla"]!,
          role: "CORE",
          reason: "test",
          isDraft: true,
          organisationId: testOrgId,
        },
      });
      await testDb.warning.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          teamId: fx.teams["Bla"]!,
          severity: "WARNING",
          rule: "test_rule",
          message: "Test warning",
          organisationId: testOrgId,
        },
      });

      const { clearAllDraftSelections } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      const result = await clearAllDraftSelections(fx.leagueSeasonId);

      expect(result.selectionsDeleted).toBe(1);
      expect(result.warningsDeleted).toBe(1);
      expect(result.movementLedgerDeleted).toBe(1);

      const warningsAfter = await testDb.warning.count({
        where: { matchRoundId: fx.matchRoundId },
      });
      const ledgerAfter = await testDb.movementLedger.count({
        where: { matchRoundId: fx.matchRoundId, isDraft: true },
      });
      expect(warningsAfter).toBe(0);
      expect(ledgerAfter).toBe(0);
    });
  });

  describe("clearRoundDraftSelection", () => {
    it("removes only draft data for the selected round", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.movementLedger.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          playerId: blaPlayer.id,
          fromTeamId: blaPlayer.coreTeamId,
          toTeamId: fx.teams["Bla"]!,
          role: "CORE",
          reason: "test",
          isDraft: true,
          organisationId: testOrgId,
        },
      });
      await testDb.warning.create({
        data: {
          matchRoundId: fx.matchRoundId,
          severity: "WARNING",
          rule: "test_rule",
          message: "Test warning",
          organisationId: testOrgId,
        },
      });

      const { clearRoundDraftSelection } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      const result = await clearRoundDraftSelection(fx.matchRoundId);

      expect(result.selectionsDeleted).toBe(1);
      expect(result.warningsDeleted).toBe(1);
      expect(result.movementLedgerDeleted).toBe(1);

      const selectionsAfter = await testDb.selection.count({
        where: {
          matchRoundId: fx.matchRoundId,
          status: SelectionStatus.DRAFT,
        },
      });
      expect(selectionsAfter).toBe(0);
    });

    it("does not affect other rounds", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });

       const secondRound = await testDb.matchRound.create({
         data: {
           name: "W20 Other",
           leagueSeasonId: fx.leagueSeasonId,
           status: "DRAFT",
           organisationId: testOrgId,
         },
       });
      const secondMatch = await testDb.match.create({
        data: {
          matchRoundId: secondRound.id,
          teamId: fx.teams["Hvit"]!,
          opponent: "Opp",
          opponentTeamId: Object.values(fx.opponentTeamIds)[0]!,
          startsAt: new Date("2025-05-05T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });
      const hvitPlayer = fx.players.find((p) => p.coreTeamName === "Hvit")!;
      await testDb.selection.create({
        data: {
          matchId: secondMatch.id,
          matchRoundId: secondRound.id,
          playerId: hvitPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.warning.create({
        data: {
          matchRoundId: secondRound.id,
          matchId: secondMatch.id,
          severity: "WARNING",
          rule: "test_rule",
          message: "Second round warning",
          organisationId: testOrgId,
        },
      });

      const { clearRoundDraftSelection } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      await clearRoundDraftSelection(fx.matchRoundId);

      const otherRoundSelections = await testDb.selection.count({
        where: { matchRoundId: secondRound.id },
      });
      const otherRoundWarnings = await testDb.warning.count({
        where: { matchRoundId: secondRound.id },
      });

      expect(otherRoundSelections).toBe(1);
      expect(otherRoundWarnings).toBe(1);
    });

    it("throws for finalized rounds", async () => {
      const fx = await createFreshFixture();

      await testDb.matchRound.update({
        where: { id: fx.matchRoundId },
        data: { status: "FINALIZED" },
      });

      const { clearRoundDraftSelection } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      await expect(
        clearRoundDraftSelection(fx.matchRoundId),
      ).rejects.toThrow("Cannot clear draft for a finalised round.");
    });
  });

  describe("clearMatchDraftSelection", () => {
    it("removes only draft data for the selected match", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.movementLedger.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          playerId: blaPlayer.id,
          fromTeamId: blaPlayer.coreTeamId,
          toTeamId: fx.teams["Bla"]!,
          role: "CORE",
          reason: "test",
          isDraft: true,
          organisationId: testOrgId,
        },
      });
      await testDb.warning.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          severity: "WARNING",
          rule: "test_rule",
          message: "Match warning",
          organisationId: testOrgId,
        },
      });

      const { clearMatchDraftSelection } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      const result = await clearMatchDraftSelection(blaMatchId);

      expect(result.selectionsDeleted).toBe(1);
      expect(result.movementLedgerDeleted).toBe(1);
      expect(result.warningsDeleted).toBe(1);

      const selectionsAfter = await testDb.selection.count({
        where: {
          matchId: blaMatchId,
          status: SelectionStatus.DRAFT,
        },
      });
      expect(selectionsAfter).toBe(0);
    });

    it("does not affect other matches in the same round", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const hvitMatchId = fx.matches["Hvit"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;
      const hvitPlayer = fx.players.find((p) => p.coreTeamName === "Hvit")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.selection.create({
        data: {
          matchId: hvitMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: hvitPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });

      const { clearMatchDraftSelection } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      await clearMatchDraftSelection(blaMatchId);

      const hvitSelectionsAfter = await testDb.selection.count({
        where: {
          matchId: hvitMatchId,
          status: SelectionStatus.DRAFT,
        },
      });
      expect(hvitSelectionsAfter).toBe(1);
    });
  });

  describe("clear actions preserve setup data", () => {
    it("preserves teams, players, matches, rules, and availability", async () => {
      const fx = await createFreshFixture();

      const blaMatchId = fx.matches["Bla"]!;
      const blaPlayer = fx.players.find((p) => p.coreTeamName === "Bla")!;

      await testDb.selection.create({
        data: {
          matchId: blaMatchId,
          matchRoundId: fx.matchRoundId,
          playerId: blaPlayer.id,
          role: "CORE",
          status: SelectionStatus.DRAFT,
          organisationId: testOrgId,
        },
      });
      await testDb.warning.create({
        data: {
          matchRoundId: fx.matchRoundId,
          matchId: blaMatchId,
          severity: "WARNING",
          rule: "test_rule",
          message: "Test warning",
          organisationId: testOrgId,
        },
      });
      await testDb.availability.create({
        data: {
          playerId: blaPlayer.id,
          matchRoundId: fx.matchRoundId,
          status: "AVAILABLE",
          organisationId: testOrgId,
        },
      });

      const teamsBefore = await testDb.team.count();
      const playersBefore = await testDb.player.count();
      const matchesBefore = await testDb.match.count();
      const availabilityBefore = await testDb.availability.count();
      expect(availabilityBefore).toBeGreaterThan(0);

      const { clearAllDraftSelections } = await import(
        "@/lib/selection/clear-draft-selection"
      );
      await clearAllDraftSelections(fx.leagueSeasonId);

      expect(await testDb.team.count()).toBe(teamsBefore);
      expect(await testDb.player.count()).toBe(playersBefore);
      expect(await testDb.match.count()).toBe(matchesBefore);
      expect(await testDb.availability.count()).toBe(availabilityBefore);
    });
  });
});