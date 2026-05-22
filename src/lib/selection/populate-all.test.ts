import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mapWarningSeverity, buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { WarningSeverity } from "@/generated/prisma/client";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { populateAllDrafts } from "@/lib/selection/populate-all-drafts";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("Warning severity mapping", () => {
  it("maps player_in_multiple_matches to HARD_BLOCK", () => {
    expect(mapWarningSeverity("player_in_multiple_matches")).toBe(WarningSeverity.HARD_BLOCK);
  });

  it("maps duplicate_player_in_match to HARD_BLOCK", () => {
    expect(mapWarningSeverity("duplicate_player_in_match")).toBe(WarningSeverity.HARD_BLOCK);
  });

  it("maps support_requirement_shortfall to REQUIRES_OVERRIDE", () => {
    expect(mapWarningSeverity("support_requirement_shortfall")).toBe(WarningSeverity.REQUIRES_OVERRIDE);
  });

  it("maps squad_repair_shortfall_after_resolution to REQUIRES_OVERRIDE", () => {
    expect(mapWarningSeverity("squad_repair_shortfall_after_resolution")).toBe(WarningSeverity.REQUIRES_OVERRIDE);
  });

  it("maps short_squad to WARNING", () => {
    expect(mapWarningSeverity("short_squad")).toBe(WarningSeverity.WARNING);
  });

  it("maps support_below_target to WARNING", () => {
    expect(mapWarningSeverity("support_below_target")).toBe(WarningSeverity.WARNING);
  });

  it("maps core_player_overflow to SCORING_PREFERENCE", () => {
    expect(mapWarningSeverity("core_player_overflow")).toBe(WarningSeverity.SCORING_PREFERENCE);
  });

  it("maps unknown codes to WARNING", () => {
    expect(mapWarningSeverity("unknown_future_code")).toBe(WarningSeverity.WARNING);
  });
});

describe("Warning persistence", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("persists warnings to the database after round generation", async () => {
    const generatedRound = await generateMatchRound(fixtureIds.matchRoundId);
    await createGeneratedDraftRound(generatedRound);

    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const [teamName, matchId] of Object.entries(fixtureIds.matches)) {
      matchIdByTeamName.set(teamName, matchId);
      teamIdByTeamName.set(teamName, fixtureIds.teams[teamName]!);
    }

    const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
    await persistRoundWarnings(warnings);

    const dbWarnings = await testDb.warning.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
    });

    expect(dbWarnings.length).toBe(warnings.length);

    for (const w of dbWarnings) {
      expect(typeof w.rule).toBe("string");
      expect(typeof w.message).toBe("string");
      expect(w.matchRoundId).toBe(fixtureIds.matchRoundId);
      expect([
        WarningSeverity.HARD_BLOCK,
        WarningSeverity.REQUIRES_OVERRIDE,
        WarningSeverity.WARNING,
        WarningSeverity.SCORING_PREFERENCE,
      ]).toContain(w.severity);
    }
  });

  it("deletes previous warnings before persisting new ones", async () => {
    const generatedRound = await generateMatchRound(fixtureIds.matchRoundId);
    await createGeneratedDraftRound(generatedRound);

    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const [teamName, matchId] of Object.entries(fixtureIds.matches)) {
      matchIdByTeamName.set(teamName, matchId);
      teamIdByTeamName.set(teamName, fixtureIds.teams[teamName]!);
    }

    const warnings1 = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
    await persistRoundWarnings(warnings1);

    const warnings2 = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
    await persistRoundWarnings(warnings2);

    const dbWarnings = await testDb.warning.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
    });

    expect(dbWarnings.length).toBe(warnings2.length);
  });
});

describe("Populate all workflow", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "TeamA", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "TeamB", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
      ],
      playersPerTeam: 12,
      rotationPaths: [
        { from: "TeamA", to: "TeamB", role: "SUPPORT" },
        { from: "TeamA", to: "TeamB", role: "BACKFILL" },
        { from: "TeamB", to: "TeamA", role: "BACKFILL" },
      ],
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("generates drafts for all rounds in a planning period", async () => {
    const round2 = await testDb.matchRound.create({
      data: {
        name: "W20 Populate Test",
        planningPeriodId: fixtureIds.planningPeriodId,
        status: "DRAFT",
      },
    });

    for (const teamName of ["TeamA", "TeamB"]) {
      const teamId = fixtureIds.teams[teamName]!;
      const opponentName = `Opponent ${teamName} W20`;
      const normalizedName = normalizeOpponentName(opponentName);
      const displayName = cleanOpponentDisplayName(opponentName);
      const ot = await testDb.opponentTeam.upsert({
        where: { normalizedName },
        update: { displayName },
        create: { displayName, normalizedName },
      });
      const opponentTeamId = ot.id;
      fixtureIds.opponentTeamIds[normalizedName] = opponentTeamId;
      await testDb.match.create({
        data: {
          matchRoundId: round2.id,
          teamId,
          opponent: opponentName,
          opponentTeamId,
          startsAt: new Date("2025-05-05T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
        },
      });
    }

    const result = await populateAllDrafts(fixtureIds.planningPeriodId);

    expect(result.totalRounds).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.results.every((r) => r.success)).toBe(true);
  });

  it("skips finalized rounds", async () => {
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "FINALIZED" },
    });

    const result = await populateAllDrafts(fixtureIds.planningPeriodId);

    expect(result.skippedCount).toBe(1);
    expect(result.skippedRoundIds).toContain(fixtureIds.matchRoundId);
  });

  it("does not finalize rounds after generation", async () => {
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });

    await populateAllDrafts(fixtureIds.planningPeriodId);

    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
    });

    expect(round?.status).toBe("DRAFT");
  });

  it("persists warnings for generated rounds", async () => {
    await populateAllDrafts(fixtureIds.planningPeriodId);

    const warnings = await testDb.warning.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId },
    });

    for (const w of warnings) {
      expect(typeof w.rule).toBe("string");
      expect(typeof w.message).toBe("string");
      expect([
        WarningSeverity.HARD_BLOCK,
        WarningSeverity.REQUIRES_OVERRIDE,
        WarningSeverity.WARNING,
        WarningSeverity.SCORING_PREFERENCE,
      ]).toContain(w.severity);
    }
  });

  it("reports failure for nonexistent planning period", async () => {
    await expect(populateAllDrafts("nonexistent-id")).rejects.toThrow();
  });
});