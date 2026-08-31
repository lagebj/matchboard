import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { ensureMatchPlanningBaselineCaptured, reopenMatchPlanningForReschedule } from "@/lib/selection/capture-planning-baseline";

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
  return matches;
}

describe("ensureMatchPlanningBaselineCaptured (ADR-0109 — planning boundary self-closes)", () => {
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
    await testDb.match.updateMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      data: { planningClosedAt: null, status: "SCHEDULED", startsAt: new Date("2025-04-28T10:00:00Z") },
    });
  });

  it("captures the baseline for a match past its scheduled kickoff: DRAFT selections become FINALIZED and planningClosedAt is stamped", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    const result = await ensureMatchPlanningBaselineCaptured(matchId);
    expect(result.captured).toBe(true);
    expect(result.alreadyCaptured).toBe(false);

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).not.toBeNull();

    const selections = await testDb.selection.findMany({ where: { matchId } });
    expect(selections.length).toBeGreaterThan(0);
    for (const s of selections) {
      expect(s.status).toBe("FINALIZED");
    }
  });

  it("is idempotent: a second call is a safe no-op and does not re-bump rule config version", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    const first = await ensureMatchPlanningBaselineCaptured(matchId);
    expect(first.captured).toBe(true);

    const ruleConfig = await testDb.ruleConfig.findFirst({
      where: { footballGroupId: fixtureIds.footballGroupId },
      select: { id: true, version: true },
    });
    if (!ruleConfig) throw new Error("Rule config not found");

    const second = await ensureMatchPlanningBaselineCaptured(matchId);
    expect(second.captured).toBe(false);
    expect(second.alreadyCaptured).toBe(true);

    const ruleConfigAfterRetry = await testDb.ruleConfig.findUnique({
      where: { id: ruleConfig.id },
      select: { version: true },
    });
    expect(ruleConfigAfterRetry?.version).toBe(ruleConfig.version);
  });

  it("does not capture a future match (kickoff has not passed)", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    await testDb.match.update({
      where: { id: matchId },
      data: { startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const result = await ensureMatchPlanningBaselineCaptured(matchId);
    expect(result.captured).toBe(false);
    expect(result.alreadyCaptured).toBe(false);

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).toBeNull();
  });

  it("does not capture a cancelled match", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    await testDb.match.update({ where: { id: matchId }, data: { status: "CANCELLED" } });

    const result = await ensureMatchPlanningBaselineCaptured(matchId);
    expect(result.captured).toBe(false);

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).toBeNull();
  });

  it("auto-finalizes the round once every active match's boundary has closed", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);

    for (const match of matches) {
      await ensureMatchPlanningBaselineCaptured(match.id);
    }

    const round = await testDb.matchRound.findUniqueOrThrow({ where: { id: fixtureIds.matchRoundId } });
    expect(round.status).toBe("FINALIZED");
  });
});

describe("reopenMatchPlanningForReschedule (ADR-0109 §4 — a real reschedule reopens planning, this is not un-finalize)", () => {
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
    await testDb.postMatchReport.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "DRAFT" } });
    await testDb.match.updateMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      data: { planningClosedAt: null, status: "SCHEDULED" },
    });
  });

  it("reopens planning for a rescheduled match with no live activity and no completed report", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    await ensureMatchPlanningBaselineCaptured(matchId);
    let match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).not.toBeNull();

    const result = await reopenMatchPlanningForReschedule(matchId);
    expect(result.reopened).toBe(true);

    match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).toBeNull();

    const selections = await testDb.selection.findMany({ where: { matchId } });
    for (const s of selections) {
      expect(s.status).toBe("DRAFT");
      expect(s.ruleConfigVersion).toBeNull();
    }
  });

  it("refuses to reopen a match that has a completed post-match report", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    await ensureMatchPlanningBaselineCaptured(matchId);

    await testDb.postMatchReport.create({
      data: {
        matchId,
        organisationId: fixtureIds.organisationId,
        status: "LOCKED",
        completedAt: new Date(),
      },
    });

    const result = await reopenMatchPlanningForReschedule(matchId);
    expect(result.reopened).toBe(false);
    if (!result.reopened) {
      expect(result.reason).toMatch(/completed post-match report/i);
    }

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).not.toBeNull();
  });

  it("refuses to reopen a match with recorded live match activity", async () => {
    const matches = await createDraftSelections(testDb, fixtureIds);
    const matchId = matches[0]!.id;

    await ensureMatchPlanningBaselineCaptured(matchId);

    await testDb.liveMatchSession.create({
      data: {
        matchId,
        coachId: "test-coach",
        organisationId: fixtureIds.organisationId,
        status: "ENDED",
      },
    });

    const result = await reopenMatchPlanningForReschedule(matchId);
    expect(result.reopened).toBe(false);

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.planningClosedAt).not.toBeNull();
  });
});
