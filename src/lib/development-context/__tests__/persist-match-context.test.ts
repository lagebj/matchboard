import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { persistMatchContextPack } from "../persist-match-context";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

/**
 * post-match-learning-pipeline.test.ts already covers the real end-to-end wiring (a well-formed
 * League match producing real measurements, and a re-run replacing rather than duplicating
 * them). This file covers persistMatchContextPack's own no-op behaviour, which that pipeline
 * test never exercises.
 */
describe("persistMatchContextPack — unresolvable ref (ADR-0155 step B3)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("is a true no-op for a match id that does not exist — never deletes or inserts", async () => {
    const outcome = await persistMatchContextPack({ kind: "LEAGUE_MATCH", matchId: "does-not-exist", leagueSeasonId: null });

    expect(outcome.measurementsWritten).toBe(0);
    const rows = await testDb.derivedMeasurement.findMany({ where: { matchId: "does-not-exist" } });
    expect(rows).toEqual([]);
  });

  it("never wipes existing measurements for an unresolvable ref", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await testDb.derivedMeasurement.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId,
        playerId: "p1",
        metricKey: "role_seconds",
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey: matchId,
        value: 100,
        unit: "seconds",
        coverage: "COMPLETE",
        eligible: true,
        missingInputs: [],
        warnings: [],
        dimensions: { position: "CM" },
        sourceRefs: [],
        inputRevision: "fixture-revision",
      },
    });

    // A different, non-existent match id -- resolving organisationId for it fails, so this
    // must never touch the real match's existing row above.
    await persistMatchContextPack({ kind: "LEAGUE_MATCH", matchId: "does-not-exist-2", leagueSeasonId: null });

    const rows = await testDb.derivedMeasurement.findMany({ where: { matchId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(100);
  });
});
