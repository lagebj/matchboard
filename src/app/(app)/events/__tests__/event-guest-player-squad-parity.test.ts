import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { getEventById } from "../actions";

// ADR-0106 planning-parity completion: getEventById() previously filtered EventSquadPlayer rows
// to `playerId: { not: null }`, silently dropping every GuestPlayer squad assignment from the
// Event detail page's data -- the root cause of guests disappearing from the squad overview and
// the actual-vs-target squad size count (AGENTS.md "Event squad assignment/distribution":
// "Team A target=10, 9 registered + 1 guest = 10 planned participants, not 9").
describe("getEventById includes GuestPlayer squad assignments (ADR-0106 planning parity)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("counts a GuestPlayer toward the squad's player list alongside registered Players", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Squad Count Parity Cup",
        eventType: "CUP",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 40,
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad 1", intent: "BALANCED", targetSize: 10, generationOrder: 0, organisationId: fixture.organisationId },
    });

    const somePlayer = fixture.players[0]!;
    await testDb.eventSquadPlayer.create({
      data: { eventSquadId: squad.id, eventId: event.id, playerId: somePlayer.id, source: "MANUAL", locked: false, organisationId: fixture.organisationId },
    });

    const guestPlayer = await testDb.guestPlayer.create({
      data: {
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Guest Nilsen",
      },
    });
    await testDb.eventSquadPlayer.create({
      data: { eventSquadId: squad.id, eventId: event.id, guestPlayerId: guestPlayer.id, source: "MANUAL", locked: false, organisationId: fixture.organisationId },
    });

    const loaded = await getEventById(event.id);
    const loadedSquad = loaded!.squads.find((s) => s.id === squad.id)!;

    expect(loadedSquad.players).toHaveLength(2);
    const playerIds = loadedSquad.players.map((p) => p.playerId).filter(Boolean);
    const guestPlayerIds = loadedSquad.players.map((p) => p.guestPlayerId).filter(Boolean);
    expect(playerIds).toContain(somePlayer.id);
    expect(guestPlayerIds).toContain(guestPlayer.id);
  });
});
