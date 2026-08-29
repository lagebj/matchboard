import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import { seedReportFromFinalizedSquad, seedReportFromLiveSession, markMatchAbsence, clearMatchAbsence } from "@/lib/reports/report-mutations";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

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
    await testDb.matchHelperAssignment.deleteMany({});
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

  it("seedReportFromLiveSession includes League Match helpers in the seeded player list (regression)", async () => {
    const matches = await testDb.match.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, teamId: true },
    });
    const [matchA, matchB] = matches;
    const teamAPlayers = fixtureIds.players.filter((p) => p.coreTeamId === matchA!.teamId).slice(0, 3);
    const helperPlayer = fixtureIds.players.find((p) => p.coreTeamId === matchB!.teamId)!;

    await finalizeMatchSelections(testDb, matchA!.id, fixtureIds.matchRoundId, teamAPlayers.map((p) => p.id), fixtureIds.organisationId);

    await testDb.matchHelperAssignment.create({
      data: {
        matchId: matchA!.id,
        playerId: helperPlayer.id,
        sourceTeamId: matchB!.teamId,
        organisationId: fixtureIds.organisationId,
      },
    });

    const result = await seedReportFromLiveSession(matchA!.id, fixtureIds.organisationId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const report = await testDb.postMatchReport.findUnique({
      where: { matchId: matchA!.id },
      select: {
        playerActuals: {
          select: { playerId: true, source: true, attendanceStatus: true, unplannedAppearanceReason: true },
        },
      },
    });
    expect(report).not.toBeNull();

    const helperActual = report!.playerActuals.find((pa) => pa.playerId === helperPlayer.id);
    expect(helperActual).toBeDefined();
    expect(helperActual!.source).toBe("EMERGENCY_BACKFILL");
    expect(helperActual!.attendanceStatus).toBe("PRESENT");
    expect(helperActual!.unplannedAppearanceReason).toBe("EMERGENCY_SQUAD_COVER");

    // No duplicate row, and the planned players are still present alongside the helper.
    const playerIdCounts = new Map<string, number>();
    for (const pa of report!.playerActuals) {
      // ADR-0106: playerId is nullable at the type level (GuestPlayer facts use guestPlayerId
      // instead); this fixture seeds only real Players.
      if (!pa.playerId) continue;
      playerIdCounts.set(pa.playerId, (playerIdCounts.get(pa.playerId) ?? 0) + 1);
    }
    expect([...playerIdCounts.values()].every((count) => count === 1)).toBe(true);
    expect(report!.playerActuals.length).toBe(teamAPlayers.length + 1);
  });

  it("seedReportFromLiveSession does not duplicate a player who is both a Selection and a helper", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true, teamId: true } }))!;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;

    await finalizeMatchSelections(testDb, match.id, fixtureIds.matchRoundId, [player.id], fixtureIds.organisationId);

    // Defensive scenario only — assertLeagueMatchHelperEligible already refuses this in the
    // normal add-helper flow, but the seed function's own guard must still hold if it ever
    // happens (e.g. legacy data).
    await testDb.matchHelperAssignment.create({
      data: {
        matchId: match.id,
        playerId: player.id,
        sourceTeamId: match.teamId,
        organisationId: fixtureIds.organisationId,
      },
    });

    const result = await seedReportFromLiveSession(match.id, fixtureIds.organisationId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const report = await testDb.postMatchReport.findUnique({
      where: { matchId: match.id },
      select: { playerActuals: { select: { playerId: true, source: true } } },
    });
    const rowsForPlayer = report!.playerActuals.filter((pa) => pa.playerId === player.id);
    expect(rowsForPlayer.length).toBe(1);
    expect(rowsForPlayer[0]!.source).toBe("PLANNED");
  });
});

describe("markMatchAbsence / clearMatchAbsence (production consistency pass item #3)", () => {
  let fixtureIds: TestFixtureIds;

  function orgFilter(organisationId: string): OrgFilterMode {
    return { type: "org", filter: { organisationId }, filterNullable: { organisationId }, organisationId };
  }

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.matchReportAbsence.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.selection.deleteMany({});
  });

  it("marks a DRAFT-round player absent before a post-match report exists, without touching their Selection", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true, teamId: true } }))!;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;

    const selection = await testDb.selection.create({
      data: { matchId: match.id, matchRoundId: fixtureIds.matchRoundId, playerId: player.id, role: "CORE", status: "DRAFT", organisationId: fixtureIds.organisationId },
    });

    const result = await markMatchAbsence(match.id, { playerId: player.id, reason: "SICK" }, orgFilter(fixtureIds.organisationId));
    expect(result.success).toBe(true);

    // Selection (round/team assignment) is completely untouched.
    const unchangedSelection = await testDb.selection.findUniqueOrThrow({ where: { id: selection.id } });
    expect(unchangedSelection.status).toBe("DRAFT");
    expect(unchangedSelection.playerId).toBe(player.id);

    // A report was seeded early so the absence has somewhere to attach.
    const report = await testDb.postMatchReport.findUniqueOrThrow({ where: { matchId: match.id } });
    expect(report.status).toBe("DRAFT");

    const absence = await testDb.matchReportAbsence.findFirst({ where: { matchReportId: report.id, playerId: player.id } });
    expect(absence?.reason).toBe("SICK");

    // attendanceStatus is set so report completion is never blocked by a stale UNKNOWN.
    const actual = await testDb.postMatchPlayerActual.findFirst({ where: { reportId: report.id, playerId: player.id } });
    expect(actual?.attendanceStatus).toBe("NO_SHOW");
  });

  it("supports the AWAY reason", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true, teamId: true } }))!;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;
    await testDb.selection.create({
      data: { matchId: match.id, matchRoundId: fixtureIds.matchRoundId, playerId: player.id, role: "CORE", status: "DRAFT", organisationId: fixtureIds.organisationId },
    });

    const result = await markMatchAbsence(match.id, { playerId: player.id, reason: "AWAY" }, orgFilter(fixtureIds.organisationId));
    expect(result.success).toBe(true);

    const report = await testDb.postMatchReport.findUniqueOrThrow({ where: { matchId: match.id } });
    const absence = await testDb.matchReportAbsence.findFirst({ where: { matchReportId: report.id, playerId: player.id } });
    expect(absence?.reason).toBe("AWAY");
  });

  it("clearMatchAbsence restores the player to participating before the report is locked", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true, teamId: true } }))!;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;
    await testDb.selection.create({
      data: { matchId: match.id, matchRoundId: fixtureIds.matchRoundId, playerId: player.id, role: "CORE", status: "DRAFT", organisationId: fixtureIds.organisationId },
    });

    await markMatchAbsence(match.id, { playerId: player.id, reason: "DECLINED" }, orgFilter(fixtureIds.organisationId));
    const clearResult = await clearMatchAbsence(match.id, player.id, orgFilter(fixtureIds.organisationId));
    expect(clearResult.success).toBe(true);

    const report = await testDb.postMatchReport.findUniqueOrThrow({ where: { matchId: match.id } });
    const absence = await testDb.matchReportAbsence.findFirst({ where: { matchReportId: report.id, playerId: player.id } });
    expect(absence).toBeNull();

    const actual = await testDb.postMatchPlayerActual.findFirst({ where: { reportId: report.id, playerId: player.id } });
    expect(actual?.attendanceStatus).toBe("UNKNOWN");
  });

  it("refuses to mark or clear absence on a locked report", async () => {
    const match = (await testDb.match.findFirst({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true, teamId: true } }))!;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;
    await testDb.selection.create({
      data: { matchId: match.id, matchRoundId: fixtureIds.matchRoundId, playerId: player.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
    });

    await markMatchAbsence(match.id, { playerId: player.id, reason: "SICK" }, orgFilter(fixtureIds.organisationId));
    const report = await testDb.postMatchReport.findUniqueOrThrow({ where: { matchId: match.id } });
    await testDb.postMatchReport.update({ where: { id: report.id }, data: { status: "LOCKED" } });

    const markResult = await markMatchAbsence(match.id, { playerId: player.id, reason: "OTHER" }, orgFilter(fixtureIds.organisationId));
    expect(markResult.success).toBe(false);

    const clearResult = await clearMatchAbsence(match.id, player.id, orgFilter(fixtureIds.organisationId));
    expect(clearResult.success).toBe(false);
  });
});
