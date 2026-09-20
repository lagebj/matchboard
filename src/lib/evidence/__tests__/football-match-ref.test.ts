import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { resolveFootballMatchRefById } from "../football-match-ref";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("evidence/football-match-ref: resolveFootballMatchRefById", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("resolves a League Match id to a LEAGUE_MATCH ref", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const ref = await resolveFootballMatchRefById(matchId);
    expect(ref).toEqual({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: fixtureIds.leagueSeasonId });
  });

  it("resolves an EventMatch id to an EVENT_MATCH ref", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Test event",
        eventType: "TOURNAMENT",
        startsAt: new Date("2025-05-10T09:00:00Z"),
        gameFormat: "ELEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { name: "Squad", eventId: event.id, intent: "MANUAL", targetSize: 11, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Opponent",
        startsAt: new Date("2025-05-10T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const ref = await resolveFootballMatchRefById(eventMatch.id);
    expect(ref).toMatchObject({ kind: "EVENT_MATCH", eventMatchId: eventMatch.id, eventId: event.id });
  });

  it("returns null when the id names neither a League Match nor an EventMatch", async () => {
    const ref = await resolveFootballMatchRefById("does-not-exist");
    expect(ref).toBeNull();
  });
});
