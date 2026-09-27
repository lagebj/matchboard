import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildOpponentContext } from "@/lib/matches/match-insights/opponent-context";
import { createTestMatch, createTestOpponentTeam } from "@/test/support/factories";
import { recordDeterministicExtraction } from "@/lib/evidence/qualitative-evidence-service";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("match-insights/opponent-context: opponentPatterns (ADR-0152 §6)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.qualitativeEvidenceObservation.deleteMany({});
    await testDb.qualitativeEvidenceExtractionRun.deleteMany({});
  });

  const teamId = () => Object.values(fixtureIds.teams)[0]!;
  const currentMatchId = () => Object.values(fixtureIds.matches)[0]!;

  async function seedEncounter(opponentTeamId: string, startsAt: Date, observations: { phase: string; polarity: string; statement: string }[]) {
    const match = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), opponentTeamId, { startsAt });
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: teamId(),
      sourceType: "POST_MATCH_DEBRIEF_OPPONENT",
      sourceId: match.id,
      fingerprintPayload: { matchId: match.id },
      subject: { matchId: match.id },
      observations: observations.map((o) => ({ scope: "OPPONENT", phase: o.phase as never, polarity: o.polarity as never, statement: o.statement })),
    });
    return match;
  }

  it("returns opponentPatterns: [] when there is no opponent or no prior encounters", async () => {
    const noOpponent = await buildOpponentContext({ teamId: teamId(), opponentTeamId: null, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(noOpponent.opponentPatterns).toEqual([]);

    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    const noHistory = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(noHistory.opponentPatterns).toEqual([]);
  });

  it("classifies SINGLE_OBSERVATION for a phase seen in exactly one prior encounter", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    await seedEncounter(opponent.id, new Date("2026-06-01T10:00:00Z"), [{ phase: "PRESSING", polarity: "PROBLEM", statement: "Struggled against their press." }]);

    const context = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(context.opponentPatterns).toEqual([
      expect.objectContaining({ phase: "PRESSING", consistency: "SINGLE_OBSERVATION", encounterCount: 1, recency: "RECENT" }),
    ]);
    expect(context.opponentPatterns[0]!.summary).toContain("one recorded observation");
  });

  it("classifies CONSISTENT when the dominant polarity appears in >=2 encounters and >=60% of the phase's evidence-bearing encounters", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    await seedEncounter(opponent.id, new Date("2026-04-01T10:00:00Z"), [{ phase: "PRESSING", polarity: "PROBLEM", statement: "Press caused turnovers (oldest)." }]);
    await seedEncounter(opponent.id, new Date("2026-05-01T10:00:00Z"), [{ phase: "PRESSING", polarity: "PROBLEM", statement: "Press caused turnovers (middle)." }]);
    await seedEncounter(opponent.id, new Date("2026-06-01T10:00:00Z"), [{ phase: "PRESSING", polarity: "PROBLEM", statement: "Press caused turnovers (newest)." }]);

    const context = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(context.opponentPatterns).toEqual([
      expect.objectContaining({ phase: "PRESSING", consistency: "CONSISTENT", encounterCount: 3, recency: "RECENT" }),
    ]);
    expect(context.opponentPatterns[0]!.summary).toContain("a problem in 3 of 3 recorded meetings");
  });

  it("classifies MIXED when evidence for the same phase points in different directions with no 60% majority", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    await seedEncounter(opponent.id, new Date("2026-04-01T10:00:00Z"), [{ phase: "BUILD_UP", polarity: "WORKING", statement: "Played out well (1)." }]);
    await seedEncounter(opponent.id, new Date("2026-05-01T10:00:00Z"), [{ phase: "BUILD_UP", polarity: "PROBLEM", statement: "Struggled to play out (2)." }]);

    const context = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(context.opponentPatterns).toEqual([expect.objectContaining({ phase: "BUILD_UP", consistency: "MIXED", encounterCount: 2 })]);
    expect(context.opponentPatterns[0]!.summary).toContain("mixed");
  });

  it("classifies recency as OLD when no evidence-bearing encounter is among the 2 most recent, and MIXED_AGE when evidence spans both", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    // 4 encounters total, newest-first when queried: idx0=2026-07, idx1=2026-06, idx2=2026-05, idx3=2026-04.
    await seedEncounter(opponent.id, new Date("2026-04-01T10:00:00Z"), [{ phase: "SET_PLAYS", polarity: "PROBLEM", statement: "Old set-piece issue." }]);
    await seedEncounter(opponent.id, new Date("2026-05-01T10:00:00Z"), [{ phase: "CHANCE_CREATION", polarity: "WORKING", statement: "Old chance creation strength." }]);
    await seedEncounter(opponent.id, new Date("2026-06-01T10:00:00Z"), [{ phase: "CHANCE_CREATION", polarity: "WORKING", statement: "Recent chance creation strength too." }]);
    await seedEncounter(opponent.id, new Date("2026-07-01T10:00:00Z"), [{ phase: "GENERAL", polarity: "NEUTRAL", statement: "Unrelated newest-match note." }]);

    const context = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    const setPlays = context.opponentPatterns.find((p) => p.phase === "SET_PLAYS");
    const chanceCreation = context.opponentPatterns.find((p) => p.phase === "CHANCE_CREATION");
    expect(setPlays).toMatchObject({ recency: "OLD", encounterCount: 1 });
    expect(chanceCreation).toMatchObject({ recency: "MIXED_AGE", encounterCount: 2 });
  });

  it("caps at the same MAX_PREVIOUS_ENCOUNTERS window previousEncounters already uses (5)", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    for (let i = 0; i < 7; i++) {
      await seedEncounter(opponent.id, new Date(2026, 0, 1 + i), [{ phase: "PROGRESSION", polarity: "WORKING", statement: `Progression note ${i}.` }]);
    }

    const context = await buildOpponentContext({ teamId: teamId(), opponentTeamId: opponent.id, organisationId: fixtureIds.organisationId, excludeMatchId: currentMatchId() });
    expect(context.previousEncounterCount).toBe(5);
    const progression = context.opponentPatterns.find((p) => p.phase === "PROGRESSION");
    expect(progression?.encounterCount).toBe(5);
  });
});
