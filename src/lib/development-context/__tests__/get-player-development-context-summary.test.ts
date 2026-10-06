import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getPlayerDevelopmentContextSummary } from "../get-player-development-context-summary";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

describe("getPlayerDevelopmentContextSummary (ADR-0155 step B5)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("is null when the player has no development-context measurements yet", async () => {
    const result = await getPlayerDevelopmentContextSummary("no-such-player");
    expect(result).toBeNull();
  });

  it("aggregates role seconds, game-state split, and the top co-presence partner across matches", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const teammateId = fixtureIds.players[1]!.id;
    const matchA = fixtureIds.matches["Bla"];
    const matchB = fixtureIds.matches["Hvit"];
    const organisationId = fixtureIds.organisationId;

    await testDb.derivedMeasurement.createMany({
      data: [
        {
          organisationId,
          matchId: matchA,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: matchA,
          value: 600,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM" },
          sourceRefs: [],
          inputRevision: "fixture-a",
        },
        {
          organisationId,
          matchId: matchB,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: matchB,
          value: 400,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM" },
          sourceRefs: [],
          inputRevision: "fixture-b",
        },
        {
          organisationId,
          matchId: matchA,
          playerId,
          metricKey: "game_state_role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: matchA,
          value: 500,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM", gameState: "DRAWING" },
          sourceRefs: [],
          inputRevision: "fixture-c",
        },
        {
          organisationId,
          matchId: matchA,
          playerId,
          metricKey: "game_state_role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: matchA,
          value: 100,
          unit: "seconds",
          coverage: "UNKNOWN",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM", gameState: "UNKNOWN" },
          sourceRefs: [],
          inputRevision: "fixture-d",
        },
        {
          organisationId,
          matchId: matchA,
          playerId,
          metricKey: "teammate_copresence_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: matchA,
          value: 300,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { teammateId },
          sourceRefs: [],
          inputRevision: "fixture-e",
        },
      ],
    });

    const result = await getPlayerDevelopmentContextSummary(playerId);

    expect(result).not.toBeNull();
    expect(result!.totalRoleSeconds).toBe(1000);
    expect(result!.matchesWithRoleData).toBe(2);
    expect(result!.gameStateBreakdown).toEqual(
      expect.arrayContaining([
        { gameState: "DRAWING", seconds: 500 },
        { gameState: "UNKNOWN", seconds: 100 },
      ]),
    );
    expect(result!.topCoPresencePartner).toEqual({
      teammateId,
      teammateName: expect.any(String),
      sharedSeconds: 300,
    });
  });
});
