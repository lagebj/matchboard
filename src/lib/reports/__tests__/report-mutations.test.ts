import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import { seedReportFromFinalizedSquad, seedReportFromLiveSession } from "@/lib/reports/report-mutations";

/**
 * ARR-0028 resolution criteria: the two DRAFT-report creation paths (direct post-match entry vs
 * the live-reporting handoff) are distinct, legitimate seeding strategies for the same Run ->
 * Learn transition — not duplicates to merge — but both must produce a report satisfying the
 * same required-field/valid-enum invariants.
 */

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

async function finalizeMatchSelections(
  db: PrismaClient,
  matchId: string,
  matchRoundId: string,
  playerIds: string[],
  organisationId: string,
) {
  for (const playerId of playerIds) {
    await db.selection.create({
      data: {
        matchId,
        matchRoundId,
        playerId,
        role: "CORE",
        status: "FINALIZED",
        organisationId,
      },
    });
  }
}

describe("Run -> Learn report seeding invariants (ARR-0028)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 6 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.postMatchReport.deleteMany({});
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
    await testDb.selection.deleteMany({});
  });

  it("seedReportFromFinalizedSquad and seedReportFromLiveSession both satisfy the same report invariants", async () => {
    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, teamId: true },
    });
    const [matchA, matchB] = matches;
    expect(matchA).toBeDefined();
    expect(matchB).toBeDefined();

    const teamAPlayers = fixtureIds.players.filter((p) => p.coreTeamId === matchA!.teamId).slice(0, 3);
    const teamBPlayers = fixtureIds.players.filter((p) => p.coreTeamId === matchB!.teamId).slice(0, 3);

    await finalizeMatchSelections(testDb, matchA!.id, fixtureIds.matchRoundId, teamAPlayers.map((p) => p.id), fixtureIds.organisationId);
    await finalizeMatchSelections(testDb, matchB!.id, fixtureIds.matchRoundId, teamBPlayers.map((p) => p.id), fixtureIds.organisationId);

    // Path 1: direct post-match entry, no live session.
    const directResult = await seedReportFromFinalizedSquad(matchA!.id);
    expect(directResult.success).toBe(true);
    if (!directResult.success) return;

    const directReport = await testDb.postMatchReport.findUnique({
      where: { matchId: matchA!.id },
      select: { id: true, matchId: true, organisationId: true, status: true, playerActuals: { select: { attendanceStatus: true } } },
    });
    expect(directReport).not.toBeNull();
    expect(directReport!.organisationId).toBe(fixtureIds.organisationId);
    expect(directReport!.status).toBe("DRAFT");
    expect(directReport!.playerActuals.length).toBe(teamAPlayers.length);
    for (const pa of directReport!.playerActuals) {
      expect(pa.attendanceStatus).toBe("UNKNOWN");
    }

    // Path 2: live-reporting handoff, with a couple of live events to derive from.
    const user = await createTestUser(testDb);
    const session = await testDb.liveMatchSession.create({
      data: {
        matchId: matchB!.id,
        coachId: user.id,
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: matchB!.id,
        sessionId: session.id,
        eventType: "SCORER_SET",
        playerId: teamBPlayers[0]!.id,
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: matchB!.id,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixtureIds.organisationId,
      },
    });

    const liveResult = await seedReportFromLiveSession(matchB!.id, fixtureIds.organisationId);
    expect(liveResult.success).toBe(true);
    if (!liveResult.success) return;
    expect(liveResult.alreadyExisted).toBe(false);

    const liveReport = await testDb.postMatchReport.findUnique({
      where: { matchId: matchB!.id },
      select: {
        id: true,
        matchId: true,
        organisationId: true,
        status: true,
        homeGoals: true,
        playerActuals: { select: { attendanceStatus: true } },
        goals: { select: { playerId: true } },
      },
    });
    expect(liveReport).not.toBeNull();
    expect(liveReport!.organisationId).toBe(fixtureIds.organisationId);
    expect(liveReport!.status).toBe("DRAFT");
    expect(liveReport!.homeGoals).toBe(1);
    expect(liveReport!.playerActuals.length).toBe(teamBPlayers.length);
    for (const pa of liveReport!.playerActuals) {
      expect(pa.attendanceStatus).toBe("PRESENT");
    }
    expect(liveReport!.goals.map((g) => g.playerId)).toEqual([teamBPlayers[0]!.id]);

    // Both paths: report id/matchId/organisationId/status shape is identical, only the seeded
    // attendance status and derived goals differ by design (the two legitimate strategies).
    expect(liveResult.reportId).toBe(liveReport!.id);
    expect(liveResult.status).toBe("DRAFT");
  });

  it("seedReportFromLiveSession is idempotent — returns the existing report instead of creating a duplicate", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true } }))!;

    const first = await seedReportFromLiveSession(match.id, fixtureIds.organisationId);
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.alreadyExisted).toBe(false);

    const second = await seedReportFromLiveSession(match.id, fixtureIds.organisationId);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.alreadyExisted).toBe(true);
    expect(second.reportId).toBe(first.reportId);

    const reportCount = await testDb.postMatchReport.count({ where: { matchId: match.id } });
    expect(reportCount).toBe(1);
  });
});
