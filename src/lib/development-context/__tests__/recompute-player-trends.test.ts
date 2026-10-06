import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { recomputePlayerTrends } from "../recompute-player-trends";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

describe("recomputePlayerTrends (ADR-0155 step B6)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createMatch(teamId: string, startsAt: Date, opponent: string) {
    return testDb.match.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        teamId,
        opponent,
        startsAt,
        homeAway: "HOME",
        squadSize: 11,
        matchType: "LEAGUE",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixtureIds.organisationId,
      },
    });
  }

  it("is ineligible (no trend row) with fewer than 6 eligible matches for a dimension", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const teamId = fixtureIds.teams["Bla"];

    for (let i = 0; i < 5; i++) {
      const match = await createMatch(teamId, new Date(2025, 0, i + 1), `Trend Opponent Few ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: 600,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "RW" },
          sourceRefs: [],
          inputRevision: `fixture-few-${i}`,
        },
      });
    }

    const outcome = await recomputePlayerTrends(playerId, fixtureIds.organisationId);
    expect(outcome.trendsWritten).toBe(0);
    const trends = await testDb.derivedTrend.findMany({ where: { playerId, dimensions: { equals: { position: "RW" } } } });
    expect(trends).toHaveLength(0);
  });

  it("produces one trend row per dimension once 6 eligible matches exist, and replaces rather than duplicates on rerun", async () => {
    const playerId = fixtureIds.players[1]!.id;
    const teamId = fixtureIds.teams["Hvit"];
    const values = [100, 100, 100, 200, 200, 200]; // previous window 300, latest window 600

    for (let i = 0; i < 6; i++) {
      const match = await createMatch(teamId, new Date(2025, 1, i + 1), `Trend Opponent Six ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: values[i]!,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM" },
          sourceRefs: [],
          inputRevision: `fixture-six-${i}`,
        },
      });
    }

    const outcome = await recomputePlayerTrends(playerId, fixtureIds.organisationId);
    expect(outcome.trendsWritten).toBe(1);

    const trends = await testDb.derivedTrend.findMany({ where: { playerId, metricKey: "role_seconds" } });
    expect(trends).toHaveLength(1);
    expect(trends[0]!.previousValue).toBe(300);
    expect(trends[0]!.latestValue).toBe(600);
    expect(trends[0]!.direction).toBe("UP");
    expect(trends[0]!.dimensions).toEqual({ position: "CM" });

    await recomputePlayerTrends(playerId, fixtureIds.organisationId);
    const trendsAfterRerun = await testDb.derivedTrend.findMany({ where: { playerId, metricKey: "role_seconds" } });
    expect(trendsAfterRerun).toHaveLength(1);
  });
});
