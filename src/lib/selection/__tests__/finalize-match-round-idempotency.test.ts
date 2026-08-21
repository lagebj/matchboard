import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
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
    const teamPlayers = fixtureIds.players.filter((p) => p.coreTeamId === match.teamId);
    for (let i = 0; i < Math.min(5, teamPlayers.length); i++) {
      await db.selection.create({
        data: {
          matchId: match.id,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: teamPlayers[i]!.id,
          role: i < 4 ? "CORE" : "SUPPORT",
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });
    }
  }
}

describe("finalizeMatchRound idempotency (Phase 11 §69)", () => {
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

  it("does not bump the global rule-config version on a retry after the round is already finalized", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const first = await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");
    if (!first.success) {
      throw new Error(`First finalize failed: ${first.warnings.join(", ")}`);
    }

    const ruleConfig = await testDb.ruleConfig.findFirst({
      where: { footballGroupId: fixtureIds.footballGroupId },
      select: { id: true, version: true },
    });
    if (!ruleConfig) throw new Error("Rule config not found");
    const versionAfterFirstFinalize = ruleConfig.version;

    const second = await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");
    expect(second.success).toBe(false);

    const ruleConfigAfterRetry = await testDb.ruleConfig.findUnique({
      where: { id: ruleConfig.id },
      select: { version: true },
    });

    expect(ruleConfigAfterRetry?.version).toBe(versionAfterFirstFinalize);
  });
});
