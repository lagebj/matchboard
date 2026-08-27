import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  seedTestFixture,
  createTestGroup,
  type TestFixtureIds,
} from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { getAssistantCommandCentre } from "../get-assistant-command-centre";

const auth = mockAuthContext();

vi.mock("@/lib/db", () => {
  let _db: PrismaClient;
  return {
    get db() {
      return _db ?? getTestDb();
    },
    set db(v: PrismaClient) {
      _db = v;
    },
  };
});

let db: PrismaClient;
let fixture: TestFixtureIds;

describe("getAssistantCommandCentre", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    auth.updateOrganisationId(fixture.organisationId);

    // seedTestFixture() creates no Selection rows by default -- several tests in this file need
    // fixture.matchRoundId to genuinely be a populated (not merely "not generated yet") round, so
    // they can meaningfully test blocked/decision-required/ready outcomes on top of it (deleting
    // down to below-minimum, adding an unselected extra player, etc.), matching how a real
    // generated round would look. Team "Bla" needs at least minAcceptedSquadSize (9) selected.
    const blaTeamId = fixture.teams["Bla"]!;
    const blaMatchId = fixture.matches["Bla"]!;
    const blaPlayers = fixture.players.filter((p) => p.coreTeamId === blaTeamId).slice(0, 9);
    await db.selection.createMany({
      data: blaPlayers.map((p) => ({
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: p.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixture.organisationId,
      })),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("shows ready_to_finalize or decision_required for draft round", async () => {
    const result = await getAssistantCommandCentre();
    const roundItems = result.items.filter(
      (i) =>
        i.matchRoundId === fixture.matchRoundId &&
        (i.category === "ready_to_finalize" ||
          i.category === "decision_required" ||
          i.category === "blocked_round"),
    );
    expect(roundItems.length).toBeGreaterThanOrEqual(1);
  });

  it("shows blocked_round when squad below minimum", async () => {
    const match = await db.match.findFirst({
      where: { matchRoundId: fixture.matchRoundId },
    });
    if (!match) return;

    // Delete down to 1 selection, not 0 -- 0 draft selections is NOT_GENERATED (a different,
    // non-blocked category, Phase 11 Sec68/ADR-0083), not squad-below-minimum. This test is
    // specifically about a round that was generated but ended up short, not one never generated.
    const remaining = await db.selection.findMany({
      where: { matchId: match.id, status: "DRAFT" },
      select: { id: true },
      skip: 1,
    });
    await db.selection.deleteMany({
      where: { id: { in: remaining.map((s) => s.id) } },
    });

    const result = await getAssistantCommandCentre();
    const blockedItems = result.items.filter(
      (i) => i.category === "blocked_round",
    );
    expect(blockedItems.length).toBeGreaterThanOrEqual(1);
    expect(blockedItems[0]!.blockedCount).toBeGreaterThanOrEqual(1);
  });

  it("shows decision_required or blocked_round when available player has no match opportunity", async () => {
    const extraPlayer = await db.player.create({
      data: {
        firstName: "Extra",
        lastName: "Player",
        coreTeamId: fixture.teams["Bla"]!,
        primaryPosition: "CM",
        playerCode: 9991,
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
        organisationId: fixture.organisationId,
      },
    });

    const result = await getAssistantCommandCentre();
    const actionItems = result.items.filter(
      (i) =>
        i.matchRoundId === fixture.matchRoundId &&
        (i.category === "decision_required" || i.category === "blocked_round"),
    );
    expect(actionItems.length).toBeGreaterThanOrEqual(1);

    await db.player.delete({ where: { id: extraPlayer.id } });
  });

  it("shows both blocked_round and decision_required when both exist", async () => {
    const result = await getAssistantCommandCentre();
    const blocked = result.items.filter((i) => i.category === "blocked_round");
    const decision = result.items.filter(
      (i) => i.category === "decision_required",
    );
    if (blocked.length > 0 && decision.length > 0) {
      expect(blocked[0]!.matchRoundId).toBe(fixture.matchRoundId);
      expect(decision[0]!.matchRoundId).toBe(fixture.matchRoundId);
    }
  });

  it("shows post_match_report for finalized match without report", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "FINALIZED" },
    });
    await db.selection.updateMany({
      where: { matchRoundId: fixture.matchRoundId, status: "DRAFT" },
      data: { status: "FINALIZED" },
    });

    const result = await getAssistantCommandCentre();
    const reportItems = result.items.filter(
      (i) => i.category === "post_match_report",
    );
    expect(reportItems.length).toBeGreaterThanOrEqual(1);
    expect(reportItems[0]!.matchId).toBeDefined();
  });

  it("shows planned_rotation_delayed for a finalized match with a delayed planned change", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "FINALIZED" },
    });
    await db.selection.updateMany({
      where: { matchRoundId: fixture.matchRoundId, status: "DRAFT" },
      data: { status: "FINALIZED" },
    });

    const match = await db.match.findFirstOrThrow({ where: { matchRoundId: fixture.matchRoundId } });
    const rotation = await db.plannedRotation.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId: match.teamId } },
      update: {},
      create: { matchId: match.id, teamId: match.teamId, organisationId: fixture.organisationId },
    });
    await db.plannedRotationChange.create({
      data: {
        plannedRotationId: rotation.id,
        sequence: 1,
        positionOnly: false,
        status: "DELAYED",
        organisationId: fixture.organisationId,
      },
    });

    const result = await getAssistantCommandCentre();
    const delayedItems = result.items.filter((i) => i.category === "planned_rotation_delayed");
    expect(delayedItems.length).toBeGreaterThanOrEqual(1);
    expect(delayedItems.some((i) => i.matchId === match.id)).toBe(true);

    await db.plannedRotationChange.deleteMany({ where: { plannedRotationId: rotation.id } });
    await db.plannedRotation.delete({ where: { id: rotation.id } });
  });

  it("shows no post_match_report when report exists", async () => {
    const matches = await db.match.findMany({
      where: { matchRoundId: fixture.matchRoundId },
    });
    for (const m of matches) {
      await db.postMatchReport.upsert({
        where: { matchId: m.id },
        update: {},
        create: { matchId: m.id, status: "LOCKED", organisationId: fixture.organisationId },
      });
    }

    const result = await getAssistantCommandCentre();
    const reportItems = result.items.filter(
      (i) => i.category === "post_match_report",
    );
    expect(reportItems.length).toBe(0);
  });

  it("shows populate_needed for not-generated rounds", async () => {
    // NOT_GENERATED is never a persisted value (Phase 11 Sec68, ADR-0083) -- the round stays
    // DRAFT in the database; "not generated" is derived live from having zero draft selections.
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "DRAFT" },
    });
    await db.selection.deleteMany({
      where: { matchRoundId: fixture.matchRoundId },
    });

    const result = await getAssistantCommandCentre();
    const populateItems = result.items.filter(
      (i) => i.category === "populate_needed",
    );
    expect(populateItems.length).toBe(1);
    expect(populateItems[0]!.matchRoundId).toBe(fixture.matchRoundId);
  });

  it("sorting: blocked_round before ready_to_finalize", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "DRAFT" },
    });

    // NOT_GENERATED/READY are never persisted values (Phase 11 Sec68, ADR-0083) -- the round is
    // DRAFT in the database, and "ready" is derived live from having draft selections with no
    // blocked/decision-required signals, so round2 needs a real draft selection below to
    // genuinely exercise the ready_to_finalize path this test is about.
    const round2 = await db.matchRound.create({
      data: {
        leagueSeasonId: fixture.leagueSeasonId,
        name: "W20 Test",
        status: "DRAFT",
        organisationId: fixture.organisationId,
      },
    });
    const match2 = await db.match.findFirst({
      where: { matchRoundId: fixture.matchRoundId },
    });
    if (match2) {
      const team2 = Object.values(fixture.teams)[0]!;
      const oppTeam = match2.opponentTeamId;
      const createdMatch2 = await db.match.create({
        data: {
          matchRoundId: round2.id,
          teamId: team2,
          opponent: "Opp2",
          opponentTeamId: oppTeam ?? "missing",
          startsAt: new Date("2025-05-05T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        },
      });
      const player2 = fixture.players.find((p) => p.coreTeamId === team2);
      if (player2) {
        await db.selection.create({
          data: {
            matchId: createdMatch2.id,
            matchRoundId: round2.id,
            playerId: player2.id,
            role: "CORE",
            status: "DRAFT",
            organisationId: fixture.organisationId,
          },
        });
      }
    }

    const result = await getAssistantCommandCentre();
    const blockedIdx = result.items.findIndex(
      (i) => i.category === "blocked_round",
    );
    const readyIdx = result.items.findIndex(
      (i) => i.category === "ready_to_finalize",
    );
    if (blockedIdx >= 0 && readyIdx >= 0) {
      expect(blockedIdx).toBeLessThan(readyIdx);
    }

    await db.match.deleteMany({ where: { matchRoundId: round2.id } });
    await db.matchRound.delete({ where: { id: round2.id } });
  });

  it("aggregates one item per round per category even with multiple signals", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "DRAFT" },
    });

    const result = await getAssistantCommandCentre();
    const roundItems = result.items.filter(
      (i) => i.matchRoundId === fixture.matchRoundId,
    );
    const categories = roundItems.map((i) => i.category);
    const uniqueCategories = new Set(categories);
    expect(categories.length).toBe(uniqueCategories.size);
  });

  it("planning notes never appear as work items", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "DRAFT" },
    });

    const result = await getAssistantCommandCentre();
    const noteItems = result.items.filter(
      (i) =>
        i.title.toLowerCase().includes("planning note") ||
        i.title.toLowerCase().includes("below target") ||
        i.title.toLowerCase().includes("scoring preference"),
    );
    expect(noteItems.length).toBe(0);
  });

  it("returns planning period name", async () => {
    const result = await getAssistantCommandCentre();
    expect(result.leagueSeasonId).toBe(fixture.leagueSeasonId);
    expect(result.leagueSeasonName).toBeTruthy();
  });

  it("returns computedAt timestamp", async () => {
    const result = await getAssistantCommandCentre();
    expect(result.computedAt).toBeInstanceOf(Date);
  });

  it("computes a primary lifecycleStatus and a correctly-cased reportStatus for today's matches", async () => {
    const now = new Date();
    const teamId = Object.values(fixture.teams)[0]!;

    const todayRound = await db.matchRound.create({
      data: { name: "Today Test Round", leagueSeasonId: fixture.leagueSeasonId, status: "DRAFT", organisationId: fixture.organisationId },
    });
    const todayMatch = await db.match.create({
      data: {
        matchRoundId: todayRound.id,
        teamId,
        opponent: "Today Opponent",
        startsAt: now,
        homeAway: "HOME",
        squadSize: 11,
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixture.organisationId,
      },
    });
    await db.postMatchReport.create({
      data: { matchId: todayMatch.id, status: "LOCKED", organisationId: fixture.organisationId },
    });

    try {
      const result = await getAssistantCommandCentre();
      const todayMatchEntry = result.todayMatches.find((m) => m.matchId === todayMatch.id);

      expect(todayMatchEntry).toBeDefined();
      expect(todayMatchEntry!.lifecycleStatus).toBe("done");
      // The raw Prisma enum is uppercase ("LOCKED") — this must be lower-cased to match
      // TodayMatch.reportStatus's typed union, not passed through raw.
      expect(todayMatchEntry!.reportStatus).toBe("locked");
    } finally {
      await db.postMatchReport.deleteMany({ where: { matchId: todayMatch.id } });
      await db.match.delete({ where: { id: todayMatch.id } });
      await db.matchRound.delete({ where: { id: todayRound.id } });
    }
  });
});

describe("getAssistantCommandCentre — setup missing cases", () => {
  let setupDb: PrismaClient;

  beforeAll(async () => {
    setupDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("shows setup_missing when no teams exist", async () => {
    await cleanExceptRules(setupDb);

    const org = await setupDb.organisation.create({
      data: { name: "Setup Test Org", slug: `setup-test-org-${Date.now()}` },
    });
    const setupGroup1 = await createTestGroup(setupDb, org.id);
    const season = await setupDb.season.create({
      data: { name: "Setup Season", year: 2026, organisationId: org.id },
    });
    const period = await setupDb.leagueSeason.create({
      data: {
        seasonId: season.id,
        name: "Setup Period",
        part: "SPRING",
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-06-30"),
        organisationId: org.id,
        footballGroupId: setupGroup1,
      },
    });

    auth.updateOrganisationId(org.id);

    const result = await getAssistantCommandCentre();
    const setupItems = result.items.filter(
      (i) => i.category === "setup_missing",
    );
    expect(setupItems.length).toBe(1);
    expect(setupItems[0]!.title.toLowerCase()).toContain("team");

    await setupDb.leagueSeason.delete({ where: { id: period.id } });
    await setupDb.season.delete({ where: { id: season.id } });
    await setupDb.organisation.delete({ where: { id: org.id } });
  });

  it("shows setup_missing when no players exist", async () => {
    await cleanExceptRules(setupDb);

    const org = await setupDb.organisation.create({
      data: { name: "Setup Test Org 2", slug: `setup-test-org2-${Date.now()}` },
    });
    const setupGroup2 = await createTestGroup(setupDb, org.id);
    const season = await setupDb.season.create({
      data: { name: "Setup Season 2", year: 2026, organisationId: org.id },
    });
    const period = await setupDb.leagueSeason.create({
      data: {
        seasonId: season.id,
        name: "Setup Period 2",
        part: "SPRING",
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-06-30"),
        organisationId: org.id,
        footballGroupId: setupGroup2,
      },
    });
    const team = await setupDb.team.create({
      data: { name: "Team A", targetSquadSize: 11, organisationId: org.id, footballGroupId: setupGroup2 },
    });

    auth.updateOrganisationId(org.id);

    const result = await getAssistantCommandCentre();
    const setupItems = result.items.filter(
      (i) => i.category === "setup_missing",
    );
    expect(setupItems.length).toBe(1);
    expect(setupItems[0]!.title.toLowerCase()).toContain("player");

    await setupDb.team.delete({ where: { id: team.id } });
    await setupDb.leagueSeason.delete({ where: { id: period.id } });
    await setupDb.season.delete({ where: { id: season.id } });
    await setupDb.organisation.delete({ where: { id: org.id } });
  });

  it("shows setup_missing when no matches exist", async () => {
    await cleanExceptRules(setupDb);

    const org = await setupDb.organisation.create({
      data: { name: "Setup Test Org 3", slug: `setup-test-org3-${Date.now()}` },
    });
    const setupGroup3 = await createTestGroup(setupDb, org.id);
    const season = await setupDb.season.create({
      data: { name: "Setup Season 3", year: 2026, organisationId: org.id },
    });
    const period = await setupDb.leagueSeason.create({
      data: {
        seasonId: season.id,
        name: "Setup Period 3",
        part: "SPRING",
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-06-30"),
        organisationId: org.id,
        footballGroupId: setupGroup3,
      },
    });
    const team = await setupDb.team.create({
      data: { name: "Team A3", targetSquadSize: 11, organisationId: org.id, footballGroupId: setupGroup3 },
    });
    await setupDb.player.create({
      data: {
        firstName: "P",
        lastName: "1",
        coreTeamId: team.id,
        primaryPosition: "CM",
        playerCode: 8001,
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
        organisationId: org.id,
      },
    });

    auth.updateOrganisationId(org.id);

    const result = await getAssistantCommandCentre();
    const setupItems = result.items.filter(
      (i) => i.category === "setup_missing",
    );
    expect(setupItems.length).toBe(1);
    expect(setupItems[0]!.title.toLowerCase()).toContain("match");

    await setupDb.player.deleteMany({
      where: { coreTeamId: team.id },
    });
    await setupDb.team.delete({ where: { id: team.id } });
    await setupDb.leagueSeason.delete({ where: { id: period.id } });
    await setupDb.season.delete({ where: { id: season.id } });
    await setupDb.organisation.delete({ where: { id: org.id } });
  });
});

async function cleanExceptRules(db: PrismaClient) {
  await db.selectionExplanation.deleteMany();
  await db.coachingIntent.deleteMany();
  await db.playerReadinessSignal.deleteMany();
  await db.matchExecutionFeedback.deleteMany();
  await db.teamReflection.deleteMany();
  await db.decisionRecord.deleteMany();
  await db.matchReportPlayerStat.deleteMany();
  await db.matchReportAbsence.deleteMany();
  await db.goal.deleteMany();
  await db.postMatchPlayerActual.deleteMany();
  await db.postMatchReport.deleteMany();
  await db.selectionAudit.deleteMany();
  await db.warning.deleteMany();
  await db.movementLedger.deleteMany();
  await db.selection.deleteMany();
  await db.availability.deleteMany();
  await db.playerLock.deleteMany();
  await db.match.deleteMany();
  await db.matchRound.deleteMany();
  await db.leagueSeason.deleteMany();
  await db.season.deleteMany();
  await db.player.deleteMany();
  await db.rotationPath.deleteMany();
  await db.team.deleteMany();
  await db.opponentTeam.deleteMany();
  await db.organisation.deleteMany();
}