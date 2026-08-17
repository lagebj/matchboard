import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { SelectionStatus } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

let testDb: PrismaClient;

const TEAMS = [
  { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
  { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
  { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
];

const PATHS = [
  { from: "Bla", to: "Hvit", role: "SUPPORT" as const },
  { from: "Bla", to: "Rod", role: "SUPPORT" as const },
  { from: "Rod", to: "Hvit", role: "SUPPORT" as const },
  { from: "Bla", to: "Hvit", role: "BACKFILL" as const },
  { from: "Hvit", to: "Bla", role: "BACKFILL" as const },
  { from: "Rod", to: "Bla", role: "BACKFILL" as const },
  { from: "Rod", to: "Bla", role: "DEVELOPMENT" as const },
  { from: "Hvit", to: "Rod", role: "DEVELOPMENT" as const },
  { from: "Bla", to: "Rod", role: "DEVELOPMENT" as const },
];

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let fixtureIds: TestFixtureIds;

async function finalizeRound(db: PrismaClient, roundId: string): Promise<void> {
  const selections = await db.selection.findMany({
    where: { matchRoundId: roundId, status: SelectionStatus.DRAFT },
  });
  for (const sel of selections) {
    await db.selection.update({
      where: { id: sel.id },
      data: { status: SelectionStatus.FINALIZED },
    });
  }
}

async function createNextRound(
  db: PrismaClient,
  leagueSeasonId: string,
  teams: Record<string, string>,
  weekNumber: number,
  dateOffset: number,
): Promise<{ roundId: string; matchIds: Record<string, string> }> {
  const round = await db.matchRound.create({
    data: {
      name: `W${weekNumber} Test`,
      leagueSeasonId,
      status: "DRAFT",
      organisationId: fixtureIds.organisationId,
    },
  });

  const matchIds: Record<string, string> = {};
  const w19Date = new Date("2025-04-28T10:00:00Z");
  const baseDate = new Date(w19Date);
  baseDate.setDate(baseDate.getDate() + dateOffset * 7);

  for (const teamName of Object.keys(teams)) {
    const opponentName = `Opponent ${teamName}`;
    const normalizedName = normalizeOpponentName(opponentName);
    const displayName = cleanOpponentDisplayName(opponentName);
    const ot = await db.opponentTeam.upsert({
      where: { organisationId_normalizedName: { organisationId: fixtureIds.organisationId, normalizedName } },
      update: { displayName },
      create: { displayName, normalizedName, organisationId: fixtureIds.organisationId },
    });
    const opponentTeamId = ot.id;

    const match = await db.match.create({
      data: {
        matchRoundId: round.id,
        teamId: teams[teamName]!,
        opponent: opponentName,
        opponentTeamId,
        startsAt: new Date(baseDate),
        homeAway: "HOME",
        squadSize: 11,
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixtureIds.organisationId,
      },
    });
    matchIds[teamName] = match.id;
  }

  return { roundId: round.id, matchIds };
}

describe("Consecutive rounds (W19 then W20) produce valid selections", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: TEAMS,
      playersPerTeam: 12,
      rotationPaths: PATHS,
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("generates and finalizes W19 round successfully", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");

    const result = await generateMatchRound(fixtureIds.matchRoundId);
    expect(result.matchResults.length).toBe(3);

    await createGeneratedDraftRound(result);

    const draftSelections = await testDb.selection.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId, status: SelectionStatus.DRAFT },
    });
    expect(draftSelections.length).toBeGreaterThan(0);

    await finalizeRound(testDb, fixtureIds.matchRoundId);

    const finalizedSelections = await testDb.selection.findMany({
      where: { matchRoundId: fixtureIds.matchRoundId, status: SelectionStatus.FINALIZED },
    });
    expect(finalizedSelections.length).toBeGreaterThan(0);
  });

  it("generates W20 with history from W19 and produces valid selections", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w20 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 20, 1);

    const w20Result = await generateMatchRound(w20.roundId);
    expect(w20Result.matchResults.length).toBe(3);

    for (const matchResult of w20Result.matchResults) {
      expect(matchResult.selectedPlayers.length).toBeGreaterThanOrEqual(10);
    }

    const allPlayerIds = w20Result.matchResults.flatMap((r) => r.selectedPlayers.map((p) => p.playerId));
    expect(new Set(allPlayerIds).size).toBe(allPlayerIds.length);
  });

  it("W20 does not have cross-match duplicate warnings", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w20Round = await testDb.matchRound.findFirst({
      where: { name: "W20 Test" },
    });
    const w20Result = await generateMatchRound(w20Round!.id);

    const crossMatchWarnings = w20Result.roundWarnings.filter(
      (w) => w.code === "player_in_multiple_matches",
    );
    expect(crossMatchWarnings).toHaveLength(0);
  });

  it("W20 does not have duplicate-player-in-match warnings", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w20Round = await testDb.matchRound.findFirst({
      where: { name: "W20 Test" },
    });
    const w20Result = await generateMatchRound(w20Round!.id);

    const duplicateWarnings = w20Result.roundWarnings.filter(
      (w) => w.code === "duplicate_player_in_match",
    );
    expect(duplicateWarnings).toHaveLength(0);
  });
});

describe("W21 round after two finalized rounds", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: TEAMS,
      playersPerTeam: 12,
      rotationPaths: PATHS,
    });

    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");

    const w19Result = await generateMatchRound(fixtureIds.matchRoundId);
    await createGeneratedDraftRound(w19Result);
    await finalizeRound(testDb, fixtureIds.matchRoundId);

    const w20 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 20, 1);
    const w20Result = await generateMatchRound(w20.roundId);
    await createGeneratedDraftRound(w20Result);
    await finalizeRound(testDb, w20.roundId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("generates W21 without errors after two finalized rounds", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w21 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 21, 2);
    const w21Result = await generateMatchRound(w21.roundId);

    expect(w21Result.matchResults.length).toBe(3);
    for (const matchResult of w21Result.matchResults) {
      expect(matchResult.selectedPlayers.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("W21 has no cross-match duplicates", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w21 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 21, 2);
    const w21Result = await generateMatchRound(w21.roundId);

    const crossMatchWarnings = w21Result.roundWarnings.filter(
      (w) => w.code === "player_in_multiple_matches",
    );
    expect(crossMatchWarnings).toHaveLength(0);
  });

  it("W21 has no in-match duplicates", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w21 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 21, 2);
    const w21Result = await generateMatchRound(w21.roundId);

    for (const matchResult of w21Result.matchResults) {
      const playerIds = matchResult.selectedPlayers.map((p) => p.playerId);
      expect(new Set(playerIds).size).toBe(playerIds.length);
    }
  });

  it("W21 still produces rotation despite history", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w21 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 21, 2);
    const w21Result = await generateMatchRound(w21.roundId);

    const nonCoreSelections = w21Result.matchResults.flatMap(
      (r) => r.selectedPlayers.filter((p) => p.selectionCategory !== "CORE"),
    );
    expect(nonCoreSelections.length).toBeGreaterThan(0);
  });

  it("W21 every excluded player has an explanation", async () => {
    const { generateMatchRound } = await import("@/lib/selection/generate-round");

    const w21 = await createNextRound(testDb, fixtureIds.leagueSeasonId, fixtureIds.teams, 21, 2);
    const w21Result = await generateMatchRound(w21.roundId);

    for (const matchResult of w21Result.matchResults) {
      for (const excluded of matchResult.excludedPlayers) {
        expect(excluded.explanations.length).toBeGreaterThan(0);
        expect(excluded.exclusionReason).toBeTruthy();
      }
    }
  });
});