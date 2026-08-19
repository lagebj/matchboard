import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

async function selectAllPlayersForTeam(
  db: PrismaClient,
  fixtureIds: TestFixtureIds,
  teamName: string,
) {
  const matchId = fixtureIds.matches[teamName]!;
  const teamId = fixtureIds.teams[teamName]!;
  const teamPlayers = fixtureIds.players.filter((p) => p.coreTeamId === teamId);

  for (const player of teamPlayers) {
    await db.selection.create({
      data: {
        matchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixtureIds.organisationId,
      },
    });
  }
}

describe("computeRoundPlanIntegrity: already-finalized matches within a DRAFT round", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 12 });
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

  it("does not report a finalized match's squad as below minimum or missing goalkeeper coverage", async () => {
    // All three teams' 12 players include a primary-position goalkeeper (seedTestFixture
    // cycles GK/CB/CM/W/ST, so player index 0 is GK) — fully staffed squads, mirroring the
    // real reported scenario: Bla finalized individually, Hvit/Rod left in DRAFT.
    await selectAllPlayersForTeam(testDb, fixtureIds, "Bla");
    await selectAllPlayersForTeam(testDb, fixtureIds, "Hvit");
    await selectAllPlayersForTeam(testDb, fixtureIds, "Rod");

    const blaMatchId = fixtureIds.matches["Bla"]!;
    const blaTeamId = fixtureIds.teams["Bla"]!;

    const result = await finalizeSingleMatch(blaMatchId, "coach_judgement", "Test override");
    expect(result.success).toBe(true);

    // Round stays DRAFT — Hvit and Rod still have real DRAFT selections.
    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(round!.status).toBe("DRAFT");

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const blaSignals = integrity.signals.filter((s) => s.teamId === blaTeamId);
    expect(blaSignals).toEqual([]);

    const squadBelowMinimum = integrity.signals.find(
      (s) => s.ruleCode === "SQUAD_BELOW_MINIMUM" && s.matchId === blaMatchId,
    );
    expect(squadBelowMinimum).toBeUndefined();

    const noGoalkeeperCoverage = integrity.signals.find(
      (s) => s.title.toLowerCase().includes("goalkeeper") && s.teamId === blaTeamId,
    );
    expect(noGoalkeeperCoverage).toBeUndefined();
  });

  it("still reports a genuinely under-staffed DRAFT match as below minimum", async () => {
    // Hvit gets zero selections — still correctly blocked (not the bug being fixed here).
    const hvitTeamId = fixtureIds.teams["Hvit"]!;
    const hvitMatchId = fixtureIds.matches["Hvit"]!;

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const squadBelowMinimum = integrity.signals.find(
      (s) => s.ruleCode === "SQUAD_BELOW_MINIMUM" && s.matchId === hvitMatchId,
    );
    expect(squadBelowMinimum).toBeDefined();
    expect(squadBelowMinimum!.teamId).toBe(hvitTeamId);
  });
});
