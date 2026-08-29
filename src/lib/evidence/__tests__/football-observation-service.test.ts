import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const auth = mockAuthContext({ role: "COACH" });

let testDb: PrismaClient;

import { createFootballObservations } from "@/lib/evidence/football-observation-service";

/**
 * Mandatory for Event player-evidence parity (ADR-0104): without this write path, Event
 * matches never have any PlayerDevelopmentObservation rows to compute player evidence from.
 */
describe("createFootballObservations -- League and Event sources", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
    auth.updateOrganisationId(fixtureIds.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates a League-sourced observation with matchId set and eventMatchId null", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const playerId = fixtureIds.players[0].id;

    const result = await createFootballObservations([
      { playerId, matchId, observationCode: "PASSING_EFFECTIVE", polarity: "POSITIVE" },
    ]);

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    const row = await testDb.playerDevelopmentObservation.findFirst({ where: { playerId, matchId } });
    expect(row).not.toBeNull();
    expect(row!.sourceType).toBe("LEAGUE_MATCH");
    expect(row!.eventMatchId).toBeNull();
  });

  it("creates an Event-sourced observation with eventMatchId set and matchId null", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Observation Event",
        eventType: "CUP",
        startsAt: new Date("2025-05-05"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Observation Opponent",
        startsAt: new Date("2025-05-05T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });
    const playerId = fixtureIds.players[1].id;

    const result = await createFootballObservations([
      { playerId, eventMatchId: eventMatch.id, observationCode: "WORK_RATE_EFFECTIVE", polarity: "NEGATIVE" },
    ]);

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    const row = await testDb.playerDevelopmentObservation.findFirst({ where: { playerId, eventMatchId: eventMatch.id } });
    expect(row).not.toBeNull();
    expect(row!.sourceType).toBe("EVENT_MATCH");
    expect(row!.matchId).toBeNull();
  });

  it("rejects an input with neither matchId nor eventMatchId", async () => {
    const playerId = fixtureIds.players[0].id;

    const result = await createFootballObservations([
      { playerId, observationCode: "PASSING_EFFECTIVE", polarity: "POSITIVE" },
    ]);

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toMatch(/exactly one/i);
  });

  it("rejects an input with both matchId and eventMatchId set", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const playerId = fixtureIds.players[0].id;

    const result = await createFootballObservations([
      { playerId, matchId, eventMatchId: "some-event-match", observationCode: "PASSING_EFFECTIVE", polarity: "POSITIVE" },
    ]);

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toMatch(/exactly one/i);
  });

  it("rejects a GuestPlayer id as an observation subject (ADR-0106 statistics/evidence isolation) -- structurally impossible today, but locked in against future refactors", async () => {
    const guestPlayer = await testDb.guestPlayer.create({
      data: { name: "Oliver Hansen", organisationId: fixtureIds.organisationId, footballGroupId: fixtureIds.footballGroupId },
    });
    const matchId = fixtureIds.matches["Bla"];

    const result = await createFootballObservations([
      { playerId: guestPlayer.id, matchId, observationCode: "PASSING_EFFECTIVE", polarity: "POSITIVE" },
    ]);

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toMatch(/not found|not active|access denied/i);

    const row = await testDb.playerDevelopmentObservation.findFirst({ where: { playerId: guestPlayer.id } });
    expect(row).toBeNull();

    await testDb.guestPlayer.delete({ where: { id: guestPlayer.id } });
  });

  it("the database itself rejects a GuestPlayer id in PlayerDevelopmentObservation.playerId (FK to Player, not GuestPlayer)", async () => {
    const guestPlayer = await testDb.guestPlayer.create({
      data: { name: "Noah Berg", organisationId: fixtureIds.organisationId, footballGroupId: fixtureIds.footballGroupId },
    });
    const matchId = fixtureIds.matches["Bla"];

    await expect(
      testDb.playerDevelopmentObservation.create({
        data: {
          organisationId: fixtureIds.organisationId,
          playerId: guestPlayer.id,
          sourceType: "LEAGUE_MATCH",
          matchId,
          kind: "ATTRIBUTE",
          attributeKey: "PASSING_EFFECTIVE",
          direction: "POSITIVE",
          observedAt: new Date(),
          recordedBy: "test-user",
        },
      }),
    ).rejects.toThrow();

    await testDb.guestPlayer.delete({ where: { id: guestPlayer.id } });
  });
});
