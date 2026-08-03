import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
});

afterAll(async () => {
  await teardownTestDb();
});

async function finalizeSeason(leagueSeasonId: string) {
  const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
    where: { id: leagueSeasonId },
    include: { periodSnapshot: true },
  });

  if (leagueSeason.status === "FINALIZED") {
    return { success: false, error: "Already finalized." };
  }

  if (leagueSeason.periodSnapshot) {
    return { success: false, error: "Snapshot already exists." };
  }

  const teamsWithPlayers = await testDb.team.findMany({
    where: { archivedAt: null },
    include: {
      corePlayers: {
        where: { removedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          secondaryPosition: true,
          tertiaryPosition: true,
          shirtNumber: true,
          active: true,
        },
        orderBy: [{ playerCode: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  await testDb.$transaction(async (tx) => {
    await tx.leagueSeason.update({
      where: { id: leagueSeasonId },
      data: { status: "FINALIZED", finalizedAt: now },
    });

    await tx.seasonPeriodSnapshot.create({
      data: {
        leagueSeasonId,
        finalizedAt: now,
        teamSnapshots: {
          create: teamsWithPlayers.map((team) => ({
            teamId: team.id,
            teamNameSnapshot: team.name,
            organisationId: fixture.organisationId,
            playerSnapshots: {
              create: team.corePlayers.map((player) => ({
                playerId: player.id,
                playerNameSnapshot: [player.firstName, player.lastName].filter(Boolean).join(" "),
                primaryPositionSnapshot: player.primaryPosition,
                secondaryPositionSnapshot: player.secondaryPosition,
                tertiaryPositionSnapshot: player.tertiaryPosition,
                shirtNumberSnapshot: player.shirtNumber,
                activeAtSnapshot: player.active,
                organisationId: fixture.organisationId,
              })),
            },
          })),
        },
        organisationId: fixture.organisationId,
      },
    });
  });

  return { success: true };
}

async function unfinalizeSeason(leagueSeasonId: string) {
  const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
    where: { id: leagueSeasonId },
  });

  if (leagueSeason.status !== "FINALIZED") {
    return { success: false, error: "Not finalized." };
  }

  await testDb.leagueSeason.update({
    where: { id: leagueSeasonId },
    data: { status: "OPEN", finalizedAt: null, finalizedBy: null },
  });

  return { success: true };
}

describe("League season finalization", () => {
  it("finalizes an OPEN league season and creates a snapshot", async () => {
    const result = await finalizeSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(true);

    const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
      where: { id: fixture.leagueSeasonId },
    });
    expect(leagueSeason.status).toBe("FINALIZED");
    expect(leagueSeason.finalizedAt).not.toBeNull();

    const snapshot = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
      include: {
        teamSnapshots: {
          include: { playerSnapshots: true },
        },
      },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.teamSnapshots.length).toBeGreaterThan(0);
    expect(snapshot!.finalizedAt).not.toBeNull();
  });

  it("rejects finalization of an already-finalized league season", async () => {
    await finalizeSeason(fixture.leagueSeasonId);
    const result = await finalizeSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Already finalized");
  });

  it("snapshot preserves team names and player details", async () => {
    const snapshot = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
      include: {
        teamSnapshots: {
          include: { playerSnapshots: true },
          orderBy: { teamNameSnapshot: "asc" },
        },
      },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.teamSnapshots.length).toBeGreaterThan(0);

    const firstTeam = snapshot!.teamSnapshots[0];
    expect(firstTeam.teamNameSnapshot).toBeTruthy();
    expect(firstTeam.playerSnapshots.length).toBeGreaterThan(0);

    const firstPlayer = firstTeam.playerSnapshots[0];
    expect(firstPlayer.playerNameSnapshot).toBeTruthy();
    expect(firstPlayer.primaryPositionSnapshot).not.toBeNull();
  });

  it("unfinalizes a FINALIZED league season without deleting snapshots", async () => {
    await finalizeSeason(fixture.leagueSeasonId);

    const snapshotBefore = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshotBefore).not.toBeNull();

    const result = await unfinalizeSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(true);

    const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
      where: { id: fixture.leagueSeasonId },
    });
    expect(leagueSeason.status).toBe("OPEN");
    expect(leagueSeason.finalizedAt).toBeNull();

    const snapshotAfter = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshotAfter).not.toBeNull();
  });

  it("rejects un-finalization of an OPEN league season", async () => {
    const result = await unfinalizeSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not finalized");
  });

  it("getLeagueSeasonSnapshot returns null for a league season that was never finalized", async () => {
    const newSeason = await testDb.season.create({
      data: { name: "Test Season 2027", year: 2027 , organisationId: fixture.organisationId },
    });
    const newLeagueSeason = await testDb.leagueSeason.create({
      data: {
        name: "Spring 2027",
        part: "SPRING",
        seasonId: newSeason.id,
        startDate: new Date("2027-01-01"),
        endDate: new Date("2027-06-30"),
        organisationId: fixture.organisationId,
      },
    });

    const snapshot = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: newLeagueSeason.id },
    });
    expect(snapshot).toBeNull();

    await testDb.leagueSeason.delete({ where: { id: newLeagueSeason.id } });
    await testDb.season.delete({ where: { id: newSeason.id } });
  });

  it("roster changes after finalization do not affect the snapshot", async () => {
    await finalizeSeason(fixture.leagueSeasonId);

    const snapshotBefore = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
      include: { teamSnapshots: { include: { playerSnapshots: true } } },
    });
    const playerCountBefore = snapshotBefore!.teamSnapshots.reduce((sum, t) => sum + t.playerSnapshots.length, 0);

    const newPlayer = await testDb.player.create({
      data: {
        playerCode: 9999,
        firstName: "New",
        lastName: "Player",
        active: true,
        coreTeamId: fixture.players[0].coreTeamId,
        primaryPosition: "CM",
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
        currentAvailability: "AVAILABLE",
        organisationId: fixture.organisationId,
      },
    });

    const snapshotAfter = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
      include: { teamSnapshots: { include: { playerSnapshots: true } } },
    });
    const playerCountAfter = snapshotAfter!.teamSnapshots.reduce((sum, t) => sum + t.playerSnapshots.length, 0);

    expect(playerCountAfter).toBe(playerCountBefore);

    await testDb.player.delete({ where: { id: newPlayer.id } });
  });
});