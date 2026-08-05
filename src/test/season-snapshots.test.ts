import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { finalizeLeagueSeason, unfinalizeLeagueSeason, validateLeagueSeasonFinalization } from "@/lib/seasons/finalize-league-season";

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

describe("League season finalization", () => {
  it("finalizes an OPEN league season and creates a snapshot", async () => {
    const result = await finalizeLeagueSeason(fixture.leagueSeasonId);
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
    const result = await finalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("already finalised");
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

  it("unfinalizes a FINALIZED league season and deletes the snapshot", async () => {
    const snapshotBefore = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshotBefore).not.toBeNull();

    const result = await unfinalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(true);

    const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
      where: { id: fixture.leagueSeasonId },
    });
    expect(leagueSeason.status).toBe("OPEN");
    expect(leagueSeason.finalizedAt).toBeNull();
    expect(leagueSeason.finalizedBy).toBeNull();

    const snapshotAfter = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshotAfter).toBeNull();
  });

  it("allows re-finalization after unfinalizing", async () => {
    const result = await finalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(true);

    const snapshot = await testDb.seasonPeriodSnapshot.findUnique({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshot).not.toBeNull();
  });

  it("rejects un-finalization of an OPEN league season", async () => {
    await unfinalizeLeagueSeason(fixture.leagueSeasonId);

    const result = await unfinalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not finalised");
  });

  it("getLeagueSeasonSnapshot returns null for a league season that was never finalized", async () => {
    const newSeason = await testDb.season.create({
      data: { name: "Test Season 2027", year: 2027, organisationId: fixture.organisationId },
    });
    const newLeagueSeason = await testDb.leagueSeason.create({
      data: {
        name: "Spring 2027",
        part: "SPRING",
        seasonId: newSeason.id,
        startDate: new Date("2027-01-01"),
        endDate: new Date("2027-06-30"),
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });

    const { getLeagueSeasonSnapshot } = await import("@/lib/seasons/finalize-league-season");
    const snapshot = await getLeagueSeasonSnapshot(newLeagueSeason.id);
    expect(snapshot).toBeNull();

    await testDb.leagueSeason.delete({ where: { id: newLeagueSeason.id } });
    await testDb.season.delete({ where: { id: newSeason.id } });
  });

  it("roster changes after finalization do not affect the snapshot", async () => {
    await finalizeLeagueSeason(fixture.leagueSeasonId);

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

  it("sets finalizedBy when provided", async () => {
    await unfinalizeLeagueSeason(fixture.leagueSeasonId);

    const result = await finalizeLeagueSeason(fixture.leagueSeasonId, "user-123");
    expect(result.success).toBe(true);

    const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
      where: { id: fixture.leagueSeasonId },
    });
    expect(leagueSeason.finalizedBy).toBe("user-123");

    const snapshot = await testDb.seasonPeriodSnapshot.findUniqueOrThrow({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });
    expect(snapshot.finalizedBy).toBe("user-123");
  });

  it("snapshot is recreated correctly after unfinalize and re-finalize", async () => {
    const result1 = await finalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result1.success).toBe(true);

    const snapshot1 = await testDb.seasonPeriodSnapshot.findUniqueOrThrow({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });

    const unfinalizeResult = await unfinalizeLeagueSeason(fixture.leagueSeasonId);
    expect(unfinalizeResult.success).toBe(true);

    const result2 = await finalizeLeagueSeason(fixture.leagueSeasonId);
    expect(result2.success).toBe(true);

    const snapshot2 = await testDb.seasonPeriodSnapshot.findUniqueOrThrow({
      where: { leagueSeasonId: fixture.leagueSeasonId },
    });

    expect(snapshot2.id).not.toBe(snapshot1.id);
    expect(snapshot2.finalizedAt.getTime()).toBeGreaterThanOrEqual(snapshot1.finalizedAt.getTime());
  });

  it("validateLeagueSeasonFinalization returns errors for non-finalized rounds", async () => {
    await unfinalizeLeagueSeason(fixture.leagueSeasonId);

    const leagueSeason = await testDb.leagueSeason.findUniqueOrThrow({
      where: { id: fixture.leagueSeasonId },
      include: { matchRounds: { select: { id: true, status: true } } },
    });

    const hasNonFinalizedRounds = leagueSeason.matchRounds.some((r) => r.status !== "FINALIZED");

    if (hasNonFinalizedRounds) {
      const validation = await validateLeagueSeasonFinalization(fixture.leagueSeasonId);
      expect(validation.canFinalize).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });
});