import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { unfinalizeMatchRound } from "@/lib/selection/unfinalize-match-round";
import { unfinalizeSingleMatch } from "@/lib/selection/unfinalize-single-match";

/**
 * ARR-0028 resolution criteria: round-level and per-match finalize/un-finalize must produce
 * identical side effects for the fields they share, since both now call the same owning
 * functions in round-finalization-transitions.ts rather than reimplementing the writes.
 */

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

type SelectionFieldSnapshot = {
  status: string;
  ruleConfigVersion: number | null;
  overrideReasonCategory: string | null;
  overrideReasonDetail: string | null;
};

async function snapshotSelectionFields(db: PrismaClient, matchRoundId: string): Promise<SelectionFieldSnapshot[]> {
  const selections = await db.selection.findMany({
    where: { matchRoundId },
    select: { status: true, ruleConfigVersion: true, overrideReasonCategory: true, overrideReasonDetail: true },
    orderBy: { id: "asc" },
  });
  return selections;
}

describe("Round finalize/un-finalize field parity (ARR-0028)", () => {
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

  it("finalizeMatchRound and finalizeSingleMatch (looped to auto-finalize) write the same Selection field shape", async () => {
    await createDraftSelections(testDb, fixtureIds);
    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Round-level test override");
    const roundLevelSnapshot = await snapshotSelectionFields(testDb, fixtureIds.matchRoundId);

    expect(roundLevelSnapshot.length).toBeGreaterThan(0);
    for (const s of roundLevelSnapshot) {
      expect(s.status).toBe("FINALIZED");
      expect(s.ruleConfigVersion).not.toBeNull();
    }
    // Every selection finalized by the same round-level call shares one ruleConfigVersion.
    const roundLevelVersions = new Set(roundLevelSnapshot.map((s) => s.ruleConfigVersion));
    expect(roundLevelVersions.size).toBe(1);

    // Reset and repeat via per-match finalization, looping until the round auto-finalizes.
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "DRAFT" } });
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    for (const match of matches) {
      const result = await finalizeSingleMatch(match.id, "coach_judgement", "Per-match test override");
      expect(result.success).toBe(true);
    }
    const perMatchSnapshot = await snapshotSelectionFields(testDb, fixtureIds.matchRoundId);

    expect(perMatchSnapshot.length).toBe(roundLevelSnapshot.length);
    for (const s of perMatchSnapshot) {
      expect(s.status).toBe("FINALIZED");
      expect(s.ruleConfigVersion).not.toBeNull();
      expect(s.overrideReasonCategory).toBe("COACH_JUDGEMENT");
      expect(s.overrideReasonDetail).toBe("Per-match test override");
    }
    // Every selection finalized across the sequence of per-match calls that converge to the
    // same round-auto-finalize event also shares one ruleConfigVersion — identical shape to the
    // round-level case, even though the two runs' absolute version numbers differ (the
    // underlying RuleConfig row's version counter is global and was already bumped once by the
    // first half of this test).
    const perMatchVersions = new Set(perMatchSnapshot.map((s) => s.ruleConfigVersion));
    expect(perMatchVersions.size).toBe(1);

    const round = await testDb.matchRound.findUnique({ where: { id: fixtureIds.matchRoundId }, select: { status: true } });
    expect(round!.status).toBe("FINALIZED");
  });

  it("unfinalizeMatchRound and unfinalizeSingleMatch (looped) write the same Selection field shape", async () => {
    await createDraftSelections(testDb, fixtureIds);
    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");

    await unfinalizeMatchRound(fixtureIds.matchRoundId);
    const roundLevelSnapshot = await snapshotSelectionFields(testDb, fixtureIds.matchRoundId);

    expect(roundLevelSnapshot.length).toBeGreaterThan(0);
    for (const s of roundLevelSnapshot) {
      expect(s.status).toBe("DRAFT");
      expect(s.ruleConfigVersion).toBeNull();
      expect(s.overrideReasonCategory).toBeNull();
      expect(s.overrideReasonDetail).toBeNull();
    }
    const roundAfter = await testDb.matchRound.findUnique({ where: { id: fixtureIds.matchRoundId }, select: { status: true } });
    expect(roundAfter!.status).toBe("DRAFT");

    // Re-finalize, then revert via per-match un-finalize looped across every match.
    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");
    const matches = await testDb.match.findMany({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true } });
    for (const match of matches) {
      const result = await unfinalizeSingleMatch(match.id);
      expect(result.success).toBe(true);
    }
    const perMatchSnapshot = await snapshotSelectionFields(testDb, fixtureIds.matchRoundId);

    expect(perMatchSnapshot).toEqual(roundLevelSnapshot);

    const roundAfterPerMatch = await testDb.matchRound.findUnique({ where: { id: fixtureIds.matchRoundId }, select: { status: true } });
    expect(roundAfterPerMatch!.status).toBe("DRAFT");
  });
});
