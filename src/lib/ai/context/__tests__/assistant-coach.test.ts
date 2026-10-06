import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { buildAssistantCoachContext, evidenceRefKey } from "../assistant-coach";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

describe("buildAssistantCoachContext (ADR-0155 step B7)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns null for a player with no development-context evidence at all", async () => {
    const context = await buildAssistantCoachContext({ organisationId: fixtureIds.organisationId, scopeId: "no-such-player" });
    expect(context).toBeNull();
  });

  it("sends the player under an ephemeral ref, never the raw database id", async () => {
    const playerId = fixtureIds.players[0]!.id;
    await testDb.derivedMeasurement.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: fixtureIds.matches["Bla"],
        playerId,
        metricKey: "role_seconds",
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey: fixtureIds.matches["Bla"],
        value: 600,
        unit: "seconds",
        coverage: "COMPLETE",
        eligible: true,
        missingInputs: [],
        warnings: [],
        dimensions: { position: "CM" },
        sourceRefs: [],
        inputRevision: "fixture-rev-1",
      },
    });

    const context = await buildAssistantCoachContext({ organisationId: fixtureIds.organisationId, scopeId: playerId });
    expect(context).not.toBeNull();

    const normalized = context!.normalizedContext as { player: { id: string; displayName: string } };
    expect(normalized.player.id).toBe("P01");
    expect(normalized.player.id).not.toBe(playerId);
    expect(context!.refMap.get("P01")).toEqual({ subjectType: "PLAYER", entityId: playerId });
  });

  it("includes every eligible measurement, each carrying its own evidenceRef, and registers it in evidenceRefs", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const measurement = await testDb.derivedMeasurement.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: fixtureIds.matches["Bla"],
        playerId,
        metricKey: "role_seconds",
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey: fixtureIds.matches["Bla"],
        value: 600,
        unit: "seconds",
        coverage: "COMPLETE",
        eligible: true,
        missingInputs: [],
        warnings: [],
        dimensions: { position: "CM" },
        sourceRefs: [],
        inputRevision: "fixture-rev-2",
      },
    });

    const context = await buildAssistantCoachContext({ organisationId: fixtureIds.organisationId, scopeId: playerId });
    const normalized = context!.normalizedContext as { measurements: { evidenceRef: { kind: string; id: string }; value: number }[] };

    const found = normalized.measurements.find((m) => m.evidenceRef.id === measurement.id);
    expect(found).toBeDefined();
    expect(found!.value).toBe(600);
    expect(context!.evidenceRefs.has(evidenceRefKey("DERIVED_MEASUREMENT", measurement.id))).toBe(true);
  });

  it("excludes an ineligible measurement from the pack entirely", async () => {
    const playerId = fixtureIds.players[1]!.id;
    await testDb.derivedMeasurement.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: fixtureIds.matches["Hvit"],
        playerId,
        metricKey: "role_seconds",
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey: fixtureIds.matches["Hvit"],
        value: 0,
        unit: "seconds",
        coverage: "UNKNOWN",
        eligible: false,
        missingInputs: ["exposureSeconds"],
        warnings: [],
        dimensions: { position: "CM" },
        sourceRefs: [],
        inputRevision: "fixture-rev-3",
      },
    });

    const context = await buildAssistantCoachContext({ organisationId: fixtureIds.organisationId, scopeId: playerId });
    expect(context).toBeNull();
  });
});
