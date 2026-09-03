import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  assignGuestPlayerToEventSquadAction,
  moveGuestPlayerBetweenSquadsAction,
} from "../event-guest-player-actions";

// ADR-0106 planning-parity completion: a GuestPlayer must be movable between squads on the same
// terms as a Player (movePlayerBetweenSquadsAction, actions.ts) -- previously the only write path
// (assignGuestPlayerToEventSquadAction) explicitly refused re-assignment once a guest was already
// in a squad, so there was no way to move one at all without two separate, non-atomic calls.
describe("moveGuestPlayerBetweenSquadsAction (ADR-0106 planning parity)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createEventWithTwoSquads() {
    const event = await testDb.event.create({
      data: {
        name: "Guest Move Test Cup",
        eventType: "CUP",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 40,
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });
    const squadA = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
    });
    const squadB = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
    });
    const guestPlayer = await testDb.guestPlayer.create({
      data: {
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Guest Bakke",
      },
    });
    return { event, squadA, squadB, guestPlayer };
  }

  it("moves a guest player from one squad to another atomically", async () => {
    const { event, squadA, squadB, guestPlayer } = await createEventWithTwoSquads();
    await assignGuestPlayerToEventSquadAction(event.id, squadA.id, guestPlayer.id);

    await moveGuestPlayerBetweenSquadsAction(event.id, guestPlayer.id, squadA.id, squadB.id);

    const rows = await testDb.eventSquadPlayer.findMany({ where: { guestPlayerId: guestPlayer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.eventSquadId).toBe(squadB.id);
  });

  it("rejects moving a guest player not present in the stated source squad", async () => {
    const { event, squadA, squadB, guestPlayer } = await createEventWithTwoSquads();

    await expect(
      moveGuestPlayerBetweenSquadsAction(event.id, guestPlayer.id, squadA.id, squadB.id),
    ).rejects.toThrow("not found in source squad");
  });
});
