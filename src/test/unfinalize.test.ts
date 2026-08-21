import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { unfinalizeMatchRound } from "@/lib/selection/unfinalize-match-round";
import { unfinalizeSingleMatch } from "@/lib/selection/unfinalize-single-match";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";

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
          organisationId: fixtureIds.organisationId,
        },
      });
    }
  }
}

describe("Unfinalize match round", () => {
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

  it("reverts finalized selections back to DRAFT", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const finalizeResult = await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");
    if (!finalizeResult.success) {
      throw new Error(`Finalize failed: ${finalizeResult.warnings.join(", ")}`);
    }

    const beforeCount = await testDb.selection.count({
      where: { matchRoundId: fixtureIds.matchRoundId, status: "FINALIZED" },
    });
    expect(beforeCount).toBeGreaterThan(0);

    const result = await unfinalizeMatchRound(fixtureIds.matchRoundId);

    expect(result.success).toBe(true);
    expect(result.unfinalizedSelectionCount).toBe(beforeCount);

    const afterFinalized = await testDb.selection.count({
      where: { matchRoundId: fixtureIds.matchRoundId, status: "FINALIZED" },
    });
    expect(afterFinalized).toBe(0);

    const afterDraft = await testDb.selection.count({
      where: { matchRoundId: fixtureIds.matchRoundId, status: "DRAFT" },
    });
    expect(afterDraft).toBe(beforeCount);
  });

  it("clears ruleConfigVersion and overrideReason on selections", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const firstMatchId = (await testDb.match.findFirst({
      where: { matchRoundId: fixtureIds.matchRoundId },
    }))!.id;
    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: firstMatchId,
        severity: "REQUIRES_OVERRIDE",
        rule: "test_rule",
        message: "Test blocker",
        organisationId: fixtureIds.organisationId,
      },
    });

    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");

    const beforeSelections = await testDb.selection.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId, status: "FINALIZED" },
      select: { ruleConfigVersion: true, overrideReason: true, overrideReasonCategory: true, overrideReasonDetail: true },
    });
    expect(beforeSelections.some((s) => s.overrideReason !== null)).toBe(true);

    await unfinalizeMatchRound(fixtureIds.matchRoundId);

    const afterSelections = await testDb.selection.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId, status: "DRAFT" },
      select: { ruleConfigVersion: true, overrideReason: true, overrideReasonCategory: true, overrideReasonDetail: true },
    });
    for (const s of afterSelections) {
      expect(s.ruleConfigVersion).toBeNull();
      expect(s.overrideReason).toBeNull();
      expect(s.overrideReasonCategory).toBeNull();
      expect(s.overrideReasonDetail).toBeNull();
    }
  });

  it("reverts movement ledger entries back to draft", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matchIds = (await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, teamId: true },
    }));

    for (const match of matchIds) {
      const selections = await testDb.selection.findMany({
        where: { matchId: match.id, status: "DRAFT", role: "SUPPORT" },
        select: { playerId: true },
        take: 1,
      });
      if (selections.length > 0) {
        const player = await testDb.player.findUnique({
          where: { id: selections[0]!.playerId },
          select: { coreTeamId: true },
        });
        const fromTeamId = player?.coreTeamId && player.coreTeamId !== match.teamId
          ? player.coreTeamId
          : Object.values(fixtureIds.teams).find((t) => t !== match.teamId) ?? match.teamId;

        await testDb.movementLedger.create({
          data: {
            matchRoundId: fixtureIds.matchRoundId,
            matchId: match.id,
            playerId: selections[0]!.playerId,
            fromTeamId,
            toTeamId: match.teamId,
            role: "SUPPORT",
            isDraft: true,
            organisationId: fixtureIds.organisationId,
          },
        });
      }
    }

    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");

    const beforeNonDraft = await testDb.movementLedger.count({
      where: { matchRoundId: fixtureIds.matchRoundId, isDraft: false },
    });
    expect(beforeNonDraft).toBeGreaterThan(0);

    await unfinalizeMatchRound(fixtureIds.matchRoundId);

    const afterNonDraft = await testDb.movementLedger.count({
      where: { matchRoundId: fixtureIds.matchRoundId, isDraft: false },
    });
    expect(afterNonDraft).toBe(0);

    const afterDraft = await testDb.movementLedger.count({
      where: { matchRoundId: fixtureIds.matchRoundId, isDraft: true },
    });
    expect(afterDraft).toBe(beforeNonDraft);
  });

  it("reverts round status from FINALIZED to DRAFT", async () => {
    await createDraftSelections(testDb, fixtureIds);
    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");

    const before = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(before!.status).toBe("FINALIZED");

    await unfinalizeMatchRound(fixtureIds.matchRoundId);

    const after = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(after!.status).not.toBe("FINALIZED");
  });

  it("always reverts the persisted round status to DRAFT, even when hard blocking warnings exist", async () => {
    // BLOCKED is a UI-derived display state computed live by deriveRoundStatus() (Phase 11 Sec68,
    // ADR-0083) -- it must never be the persisted MatchRound.status value, regardless of whether
    // blocking conditions exist. This test previously asserted the opposite (a confirmed bug,
    // since fixed): un-finalizing wrote the computed display status back into the database.
    await createDraftSelections(testDb, fixtureIds);

    const firstMatchId = (await testDb.match.findFirst({
      where: { matchRoundId: fixtureIds.matchRoundId },
    }))!.id;
    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: firstMatchId,
        severity: "HARD_BLOCK",
        rule: "test_rule",
        message: "Test hard blocker",
        resolved: false,
        organisationId: fixtureIds.organisationId,
      },
    });

    await finalizeMatchRound(fixtureIds.matchRoundId, "coach_judgement", "Test override");

    await unfinalizeMatchRound(fixtureIds.matchRoundId);

    const after = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(after!.status).toBe("DRAFT");
  });

  it("rejects un-finalization of a non-finalized round", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const result = await unfinalizeMatchRound(fixtureIds.matchRoundId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Only finalized");
  });

  it("rejects un-finalization of a non-existent round", async () => {
    const result = await unfinalizeMatchRound("nonexistent");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("Unfinalize single match", () => {
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

  it("reverts finalized selections for a single match back to DRAFT", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });
    const firstMatchId = matches[0]!.id;

    await finalizeSingleMatch(firstMatchId, "coach_judgement", "Test override");

    const beforeCount = await testDb.selection.count({
      where: { matchId: firstMatchId, status: "FINALIZED" },
    });
    expect(beforeCount).toBeGreaterThan(0);

    const result = await unfinalizeSingleMatch(firstMatchId);

    expect(result.success).toBe(true);
    expect(result.unfinalizedSelectionCount).toBe(beforeCount);

    const afterFinalized = await testDb.selection.count({
      where: { matchId: firstMatchId, status: "FINALIZED" },
    });
    expect(afterFinalized).toBe(0);

    const afterDraft = await testDb.selection.count({
      where: { matchId: firstMatchId, status: "DRAFT" },
    });
    expect(afterDraft).toBe(beforeCount);
  });

  it("reverts round status from FINALIZED when no other finalized matches remain", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });

    for (const match of matches) {
      await finalizeSingleMatch(match.id, "coach_judgement", "Test override");
    }

    const before = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(before!.status).toBe("FINALIZED");

    for (const match of matches) {
      const result = await unfinalizeSingleMatch(match.id);
      expect(result.success).toBe(true);
    }

    const after = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(after!.status).not.toBe("FINALIZED");
  });

  it("keeps round as FINALIZED when other finalized matches remain", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });

    for (const match of matches) {
      await finalizeSingleMatch(match.id, "coach_judgement", "Test override");
    }

    if (matches.length < 2) return;

    const result = await unfinalizeSingleMatch(matches[0]!.id);

    expect(result.success).toBe(true);
    expect(result.roundStatusReverted).toBe(false);

    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(round!.status).toBe("FINALIZED");
  });

  it("rejects un-finalization of a match with no finalized selections", async () => {
    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true },
    });

    const result = await unfinalizeSingleMatch(matches[0]!.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No finalized selections");
  });

  it("rejects un-finalization of a non-existent match", async () => {
    const result = await unfinalizeSingleMatch("nonexistent");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("clears ruleConfigVersion and overrideReason on un-finalized selections", async () => {
    await createDraftSelections(testDb, fixtureIds);

    const firstMatchId = (await testDb.match.findFirst({
      where: { matchRoundId: fixtureIds.matchRoundId },
    }))!.id;
    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: firstMatchId,
        severity: "REQUIRES_OVERRIDE",
        rule: "test_rule",
        message: "Test blocker",
        organisationId: fixtureIds.organisationId,
      },
    });

    await finalizeSingleMatch(firstMatchId, "coach_judgement", "Test override");

    await unfinalizeSingleMatch(firstMatchId);

    const selections = await testDb.selection.findMany({
      where: { matchId: firstMatchId, status: "DRAFT" },
      select: { ruleConfigVersion: true, overrideReason: true, overrideReasonCategory: true, overrideReasonDetail: true },
    });
    for (const s of selections) {
      expect(s.ruleConfigVersion).toBeNull();
      expect(s.overrideReason).toBeNull();
      expect(s.overrideReasonCategory).toBeNull();
      expect(s.overrideReasonDetail).toBeNull();
    }
  });
});