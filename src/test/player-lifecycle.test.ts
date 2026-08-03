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

describe("Player lifecycle preservation", () => {
  it("removing a player sets removedAt and active=false", async () => {
    const player = fixture.players[0];
    const before = await testDb.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(before.removedAt).toBeNull();
    expect(before.active).toBe(true);

    await testDb.player.update({
      where: { id: player.id },
      data: { active: false, removedAt: new Date() },
    });

    const after = await testDb.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(after.removedAt).not.toBeNull();
    expect(after.active).toBe(false);
  });

  it("restoring a player clears removedAt and sets active=true", async () => {
    const player = fixture.players[0];
    await testDb.player.update({
      where: { id: player.id },
      data: { active: false, removedAt: new Date() },
    });

    const removed = await testDb.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(removed.removedAt).not.toBeNull();
    expect(removed.active).toBe(false);

    await testDb.player.update({
      where: { id: player.id },
      data: { active: true, removedAt: null },
    });

    const restored = await testDb.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(restored.removedAt).toBeNull();
    expect(restored.active).toBe(true);
  });

  it("removed players are excluded from active planning queries", async () => {
    const player = fixture.players[1];
    await testDb.player.update({
      where: { id: player.id },
      data: { active: false, removedAt: new Date() },
    });

    const activePlayers = await testDb.player.findMany({
      where: { removedAt: null, active: true },
    });

    const found = activePlayers.find((p) => p.id === player.id);
    expect(found).toBeUndefined();
  });

  it("removed players remain visible in historical queries", async () => {
    const player = fixture.players[1];
    const removed = await testDb.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(removed.removedAt).not.toBeNull();

    const allPlayers = await testDb.player.findMany({
      where: { id: player.id },
    });
    expect(allPlayers).toHaveLength(1);
  });

  it("hard delete of player with selections is blocked by Restrict", async () => {
    const player = fixture.players[2];
    const matchId = Object.values(fixture.matches)[0];

    await testDb.selection.create({
      data: {
        playerId: player.id,
        matchId,
        matchRoundId: fixture.matchRoundId,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixture.organisationId,
      },
    });

    await expect(
      testDb.player.delete({ where: { id: player.id } }),
    ).rejects.toThrow();

    await testDb.selection.deleteMany({ where: { playerId: player.id } });
  });

  it("hard delete of player with availability records is blocked by Restrict", async () => {
    const player = fixture.players[3];

    await testDb.availability.create({
      data: {
        playerId: player.id,
        matchRoundId: fixture.matchRoundId,
        status: "AVAILABLE",
        organisationId: fixture.organisationId,
      },
    });

    await expect(
      testDb.player.delete({ where: { id: player.id } }),
    ).rejects.toThrow();

    await testDb.availability.deleteMany({ where: { playerId: player.id } });
  });

  it("hard delete of player with movement candidate records is blocked by Restrict", async () => {
    const player = fixture.players[4];

    await testDb.movementCandidate.create({
      data: {
        playerId: player.id,
        rotationPathId: fixture.rotationPathIds[0],
        role: "SUPPORT",
        status: "ACTIVE",
        rationaleCategory: "COACH_JUDGEMENT",
        organisationId: fixture.organisationId,
      },
    });

    await expect(
      testDb.player.delete({ where: { id: player.id } }),
    ).rejects.toThrow();

    await testDb.movementCandidate.deleteMany({ where: { playerId: player.id } });
  });

  it("Goal playerId is set to null when player is soft-deleted (SetNull)", async () => {
    const player = fixture.players[5];
    const matchId = Object.values(fixture.matches)[0];

    const postMatchReport = await testDb.postMatchReport.create({
      data: {
        matchId,
        status: "DRAFT",
        homeGoals: 2,
        awayGoals: 1,
        organisationId: fixture.organisationId,
      },
    });

    await testDb.goal.create({
      data: {
        reportId: postMatchReport.id,
        playerId: player.id,
        minute: 10,
        organisationId: fixture.organisationId,
      },
    });

    const goalBefore = await testDb.goal.findFirst({
      where: { reportId: postMatchReport.id },
    });
    expect(goalBefore!.playerId).toBe(player.id);

    await testDb.player.update({
      where: { id: player.id },
      data: { active: false, removedAt: new Date() },
    });

    await testDb.player.delete({ where: { id: player.id } });

    const goalAfter = await testDb.goal.findFirst({
      where: { reportId: postMatchReport.id },
    });
    expect(goalAfter!.playerId).toBeNull();

    await testDb.goal.deleteMany({ where: { reportId: postMatchReport.id } });
    await testDb.postMatchReport.deleteMany({ where: { matchId } });
  });
});