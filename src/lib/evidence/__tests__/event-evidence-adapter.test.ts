import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

/**
 * ADR-0104 section 9: evidence-season resolution is context only, never League competition
 * membership. Exactly one applicable League season resolves; zero or several never guess.
 */
describe("buildEventMatchRef -- evidence league season resolution", () => {
  let fixtureIds: TestFixtureIds;
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });

    const event = await testDb.event.create({
      data: {
        name: "Season Resolution Event",
        eventType: "TOURNAMENT",
        startsAt: new Date("2025-04-01"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    eventId = event.id;
    const squad = await testDb.eventSquad.create({
      data: { eventId, name: "Squad", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    squadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("resolves the single applicable League season when the event date falls inside its range", async () => {
    // fixtureIds.leagueSeasonId spans 2025-01-06 .. 2025-06-30 (seedTestFixture default)
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "In-range opponent",
        startsAt: new Date("2025-04-15T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const ref = await buildEventMatchRef(eventMatch.id);

    expect(ref.kind).toBe("EVENT_MATCH");
    if (ref.kind !== "EVENT_MATCH") return;
    expect(ref.evidenceLeagueSeasonId).toBe(fixtureIds.leagueSeasonId);
  });

  it("resolves null (does not guess) when the event date falls outside every League season's range", async () => {
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "Out-of-range opponent",
        startsAt: new Date("2025-09-01T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const ref = await buildEventMatchRef(eventMatch.id);

    expect(ref.kind).toBe("EVENT_MATCH");
    if (ref.kind !== "EVENT_MATCH") return;
    expect(ref.evidenceLeagueSeasonId).toBeNull();
  });

  it("resolves null (does not guess) when several League seasons overlap the event date", async () => {
    // A second, overlapping season for the same football group creates ambiguity.
    const season = await testDb.season.create({
      data: { name: "Overlap Season", year: 2025, organisationId: fixtureIds.organisationId },
    });
    await testDb.leagueSeason.create({
      data: {
        name: "Overlapping Period",
        part: "FALL",
        seasonId: season.id,
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-05-01"),
        organisationId: fixtureIds.organisationId,
        footballGroupId: fixtureIds.footballGroupId,
      },
    });

    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "Ambiguous opponent",
        startsAt: new Date("2025-04-15T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const ref = await buildEventMatchRef(eventMatch.id);

    expect(ref.kind).toBe("EVENT_MATCH");
    if (ref.kind !== "EVENT_MATCH") return;
    expect(ref.evidenceLeagueSeasonId).toBeNull();
  });
});
