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
import { getAssistantCommandCentre } from "../get-assistant-command-centre";

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

    await db.selection.deleteMany({
      where: { matchId: match.id, status: "DRAFT" },
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

  it("shows no post_match_report when report exists", async () => {
    const matches = await db.match.findMany({
      where: { matchRoundId: fixture.matchRoundId },
    });
    for (const m of matches) {
      await db.postMatchReport.upsert({
        where: { matchId: m.id },
        update: {},
        create: { matchId: m.id, status: "LOCKED" },
      });
    }

    const result = await getAssistantCommandCentre();
    const reportItems = result.items.filter(
      (i) => i.category === "post_match_report",
    );
    expect(reportItems.length).toBe(0);
  });

  it("shows populate_needed for not-generated rounds", async () => {
    await db.matchRound.update({
      where: { id: fixture.matchRoundId },
      data: { status: "NOT_GENERATED" },
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

    const round2 = await db.matchRound.create({
      data: {
        leagueSeasonId: fixture.leagueSeasonId,
        name: "W20 Test",
        status: "READY",
        organisationId: fixture.organisationId,
      },
    });
    const match2 = await db.match.findFirst({
      where: { matchRoundId: fixture.matchRoundId },
    });
    if (match2) {
      const team2 = Object.values(fixture.teams)[0]!;
      const oppTeam = match2.opponentTeamId;
      await db.match.create({
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