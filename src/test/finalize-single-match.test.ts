import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds, cleanTestDb } from "@/test/test-db";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

async function createDraftSelections(db: PrismaClient, fixtureIds: TestFixtureIds) {
  const matches = await db.match.findMany({
    where: { matchRoundId: fixtureIds.matchRoundId },
    select: { id: true, teamId: true },
  });

  for (const match of matches) {
    const teamPlayers = fixtureIds.players.filter(
      (p) => p.coreTeamId === match.teamId,
    );
    for (let i = 0; i < Math.min(5, teamPlayers.length); i++) {
      await db.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: teamPlayers[i]!.id,
          role: i < 4 ? "CORE" : "SUPPORT",
          status: "DRAFT",
        },
      });
    }
  }
}

describe("Per-match finalization", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 14 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });
  });

  it("finalizes a single match within a round and leaves other matches as draft", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    const firstMatchId = matches[0]!.id;

    const result = await finalizeSingleMatch(firstMatchId);

    expect(result.success).toBe(true);
    expect(result.finalizedSelectionCount).toBeGreaterThan(0);
    expect(result.roundAutoFinalized).toBe(false);

    const finalizedInMatch = await testDb.selection.count({
      where: { matchId: firstMatchId, status: "FINALIZED" },
    });
    expect(finalizedInMatch).toBe(result.finalizedSelectionCount);

    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(round!.status).toBe("DRAFT");
  });

  it("auto-finalizes the round when all matches are finalized", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });

    for (const match of matches) {
      const result = await finalizeSingleMatch(match.id);
      expect(result.success).toBe(true);
    }

    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(round!.status).toBe("FINALIZED");
  });

  it("rejects finalization for a match in an already-finalized round", async () => {
    await createDraftSelections(testDb, fixtureIds);

    await finalizeMatchRound(fixtureIds.matchRoundId);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    const firstMatchId = matches[0]!.id;

    const result = await finalizeSingleMatch(firstMatchId);
    expect(result.success).toBe(false);
    expect(result.hardBlocked).toBe(true);
  });

  it("rejects finalization when hard blocker warnings exist for the match", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    const firstMatchId = matches[0]!.id;

    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: firstMatchId,
        severity: "HARD_BLOCK",
        rule: "test_rule",
        message: "Test hard blocker",
      },
    });

    const result = await finalizeSingleMatch(firstMatchId);
    expect(result.success).toBe(false);
    expect(result.hardBlocked).toBe(true);
  });

  it("allows finalization for a match without blockers when other matches have blockers", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    const firstMatchId = matches[0]!.id;
    const secondMatchId = matches[1]?.id;

    if (secondMatchId) {
      await testDb.warning.create({
        data: {
          matchRoundId: fixtureIds.matchRoundId,
          matchId: secondMatchId,
          severity: "HARD_BLOCK",
          rule: "test_rule",
          message: "Blocker on other match",
        },
      });
    }

    const result = await finalizeSingleMatch(firstMatchId);
    expect(result.success).toBe(true);
    expect(result.roundAutoFinalized).toBe(false);
  });
});