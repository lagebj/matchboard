import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  seedTestFixture,
  type TestFixtureIds,
} from "@/test/test-db";
import {
  getPlayersSeasonOverview,
  getPlayersCurrentRoundAttention,
} from "./get-players-overview";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

let db: PrismaClient;
let fixture: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

async function ensureTestOpponentTeam(db: PrismaClient, name: string, organisationId: string): Promise<string> {
  const normalizedName = normalizeOpponentName(name);
  const displayName = cleanOpponentDisplayName(name);
  const ot = await db.opponentTeam.upsert({
    where: { organisationId_normalizedName: { organisationId, normalizedName } },
    update: { displayName },
    create: { displayName, normalizedName, organisationId },
  });
  return ot.id;
}

describe("getPlayersSeasonOverview", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns planning period info and player rows", async () => {
    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);

    expect(result.leagueSeason.id).toBe(fixture.leagueSeasonId);
    expect(result.leagueSeason.label).toBe("Test Period");
    expect(result.seasonRows.length).toBeGreaterThan(0);
  });

  it("returns all active players in the season", async () => {
    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);
    expect(result.seasonRows.length).toBe(fixture.players.length);
  });

  it("each row has required fields", async () => {
    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);

    for (const row of result.seasonRows) {
      expect(row.playerId).toBeDefined();
      expect(row.displayName).toBeDefined();
      expect(typeof row.actualAppearances).toBe("number");
      expect(typeof row.goals).toBe("number");
      expect(typeof row.assists).toBe("number");
      expect(typeof row.coreAppearances).toBe("number");
      expect(typeof row.supportAppearances).toBe("number");
      expect(typeof row.developmentAppearances).toBe("number");
      expect(typeof row.matchdayAdditions).toBe("number");
      expect(typeof row.plannedButAbsent).toBe("number");
    }
  });

  it("counts zero appearances when no post-match reports exist", async () => {
    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);

    for (const row of result.seasonRows) {
      expect(row.actualAppearances).toBe(0);
      expect(row.goals).toBe(0);
      expect(row.assists).toBe(0);
      expect(row.coreAppearances).toBe(0);
      expect(row.supportAppearances).toBe(0);
      expect(row.developmentAppearances).toBe(0);
      expect(row.matchdayAdditions).toBe(0);
      expect(row.plannedButAbsent).toBe(0);
    }
  });

  it("returns empty results for non-existent planning period", async () => {
    const result = await getPlayersSeasonOverview("nonexistent-id");

    expect(result.leagueSeason.label).toBe("Unknown");
    expect(result.seasonRows).toEqual([]);
  });

  it("filters by team when teamId is provided", async () => {
    const blaTeamId = fixture.teams["Bla"];

    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId, { teamId: blaTeamId });

    for (const row of result.seasonRows) {
      expect(row.coreTeam?.id).toBe(blaTeamId);
    }
  });

  it("counts actual appearances from reported post-match data", async () => {
    const matchId = Object.values(fixture.matches)[0];
    const player = fixture.players[0];
    const opponentTeamId = await ensureTestOpponentTeam(db, "Test Opponent", fixture.organisationId);

    await db.match.update({
      where: { id: matchId },
      data: { opponentTeamId },
    });

    const report = await db.postMatchReport.create({
      data: {
        matchId,
        status: "REPORTED",
        homeGoals: 3,
        awayGoals: 1,
        organisationId: fixture.organisationId,
      },
    });

    await db.postMatchPlayerActual.create({
      data: {
        reportId: report.id,
        matchId,
        playerId: player.id,
        source: "PLANNED",
        attendanceStatus: "PRESENT",
        organisationId: fixture.organisationId,
      },
    });

    await db.matchReportPlayerStat.create({
      data: {
        matchReportId: report.id,
        playerId: player.id,
        goals: 2,
        assists: 1,
        organisationId: fixture.organisationId,
      },
    });

    await db.goal.create({
      data: { reportId: report.id, playerId: player.id, type: "NORMAL" , organisationId: fixture.organisationId },
    });
    await db.goal.create({
      data: { reportId: report.id, playerId: player.id, type: "NORMAL" , organisationId: fixture.organisationId },
    });
    await db.assist.create({
      data: { reportId: report.id, playerId: player.id, type: "NORMAL" , organisationId: fixture.organisationId },
    });

    await db.selection.create({
      data: {
        playerId: player.id,
        matchId,
        matchRoundId: fixture.matchRoundId,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixture.organisationId,
      },
    });

    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);
    const playerRow = result.seasonRows.find((r) => r.playerId === player.id);

    expect(playerRow).toBeDefined();
    expect(playerRow!.actualAppearances).toBe(1);
    expect(playerRow!.goals).toBe(2);
    expect(playerRow!.assists).toBe(1);
    expect(playerRow!.coreAppearances).toBe(1);
  });

  it("counts matchday additions separately", async () => {
    const matchId = Object.values(fixture.matches)[0];
    const player = fixture.players[1];

    let report = await db.postMatchReport.findFirst({ where: { matchId } });
    if (!report) {
      report = await db.postMatchReport.create({
        data: { matchId, status: "REPORTED", homeGoals: 2, awayGoals: 0 , organisationId: fixture.organisationId },
      });
    }

    await db.postMatchPlayerActual.create({
      data: {
        reportId: report.id,
        matchId,
        playerId: player.id,
        source: "ADDED_POST_MATCH",
        attendanceStatus: "PRESENT",
        organisationId: fixture.organisationId,
      },
    });

    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);
    const playerRow = result.seasonRows.find((r) => r.playerId === player.id);

    expect(playerRow).toBeDefined();
    expect(playerRow!.matchdayAdditions).toBeGreaterThanOrEqual(1);
  });

  it("excludes a GuestPlayer's participation entirely, while the real Player's stats in the same match are computed correctly and undiminished (ADR-0106)", async () => {
    const matchId = Object.values(fixture.matches)[0];
    const player = fixture.players[2];

    let report = await db.postMatchReport.findFirst({ where: { matchId } });
    if (!report) {
      report = await db.postMatchReport.create({
        data: { matchId, status: "REPORTED", homeGoals: 2, awayGoals: 0, organisationId: fixture.organisationId },
      });
    }

    const guestPlayer = await db.guestPlayer.create({
      data: { name: "Oliver Hansen", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
    });

    // Real Player: present in the match, scored a goal.
    await db.postMatchPlayerActual.create({
      data: { reportId: report.id, matchId, playerId: player.id, source: "PLANNED", attendanceStatus: "PRESENT", organisationId: fixture.organisationId },
    });
    await db.goal.create({ data: { reportId: report.id, playerId: player.id, type: "NORMAL", organisationId: fixture.organisationId } });

    // GuestPlayer: also present in the same match, also scored a goal.
    await db.postMatchPlayerActual.create({
      data: { reportId: report.id, matchId, guestPlayerId: guestPlayer.id, source: "PLANNED", attendanceStatus: "PRESENT", organisationId: fixture.organisationId },
    });
    await db.goal.create({ data: { reportId: report.id, guestPlayerId: guestPlayer.id, type: "NORMAL", organisationId: fixture.organisationId } });

    const result = await getPlayersSeasonOverview(fixture.leagueSeasonId);

    const playerRow = result.seasonRows.find((r) => r.playerId === player.id);
    expect(playerRow).toBeDefined();
    expect(playerRow!.actualAppearances).toBeGreaterThanOrEqual(1);
    expect(playerRow!.goals).toBeGreaterThanOrEqual(1);

    expect(result.seasonRows.some((r) => r.playerId === guestPlayer.id)).toBe(false);
    expect(result.seasonRows.some((r) => r.displayName.includes("Oliver Hansen"))).toBe(false);
    expect(result.seasonRows.length).toBe(fixture.players.length);
  });
});

describe("getPlayersCurrentRoundAttention", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns rows for all active players in the round", async () => {
    const result = await getPlayersCurrentRoundAttention(fixture.matchRoundId);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBe(fixture.players.length);
  });

  it("each row has required fields", async () => {
    const result = await getPlayersCurrentRoundAttention(fixture.matchRoundId);

    for (const row of result) {
      expect(row.playerId).toBeDefined();
      expect(row.displayName).toBeDefined();
      expect(typeof row.availability).toBe("string");
      expect(row.integrityState).toBeDefined();
    }
  });

  it("returns empty array for non-existent round", async () => {
    const result = await getPlayersCurrentRoundAttention("nonexistent-id");
    expect(result).toEqual([]);
  });

  it("assigns COVERED to players with a selection", async () => {
    const player = fixture.players[0];
    const matchId = Object.values(fixture.matches)[0];

    await db.selection.create({
      data: {
        playerId: player.id,
        matchId,
        matchRoundId: fixture.matchRoundId,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixture.organisationId,
      },
    });

    const result = await getPlayersCurrentRoundAttention(fixture.matchRoundId);
    const playerRow = result.find((r) => r.playerId === player.id);

    expect(playerRow).toBeDefined();
    expect(playerRow!.integrityState).toBe("COVERED");
    expect(playerRow!.currentAssignment).not.toBeNull();
    expect(playerRow!.currentAssignment!.role).toBe("CORE");
  });
});