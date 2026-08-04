import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";

let _testOrgId = "org-test";

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "coach@test.com" }) };
});

vi.mock("@/lib/auth/actor-context", () => {
  const makeCtx = () => ({
    userId: "test-coach",
    email: "coach@test.com",
    membershipId: "mem-test",
    organisationId: _testOrgId,
    organisationSlug: "test-org",
    role: "COACH",
    delegatedTeamIds: null,
    orgFilter: { type: "all" as const },
  });
  return {
    requireActorContext: vi.fn().mockResolvedValue(makeCtx()),
    requireMutationRole: vi.fn(),
    canMutate: vi.fn().mockReturnValue(true),
    canAdmin: vi.fn().mockReturnValue(false),
    canOwn: vi.fn().mockReturnValue(false),
    hasTeamAccess: vi.fn().mockReturnValue(true),
    requireTeamAccess: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  addPlayersToEventPoolAction,
  removePlayerFromEventPoolAction,
  assignPlayerToEventSquadAction,
  unassignPlayerFromEventSquadAction,
  generateEventSquadsAction,
} from "../actions";

describe("Event pool and squad actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    _testOrgId = fixture.organisationId;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("addPlayersToEventPoolAction", () => {
    it("adds players to an event pool with AVAILABLE status by default", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Pool Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const player1Id = fixture.players[0]!.id;
      const player2Id = fixture.players[1]!.id;

      await addPlayersToEventPoolAction(event.id, [player1Id, player2Id], "AVAILABLE");

      const poolEntries = await testDb.eventPlayerAvailability.findMany({
        where: { eventId: event.id },
      });

      expect(poolEntries).toHaveLength(2);
      expect(poolEntries.find((e) => e.playerId === player1Id)?.status).toBe("AVAILABLE");
      expect(poolEntries.find((e) => e.playerId === player2Id)?.status).toBe("AVAILABLE");
    });

    it("does not duplicate players already in the pool", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Duplicate Pool",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const playerId = fixture.players[0]!.id;

      await addPlayersToEventPoolAction(event.id, [playerId], "AVAILABLE");
      await addPlayersToEventPoolAction(event.id, [playerId], "UNAVAILABLE");

      const poolEntries = await testDb.eventPlayerAvailability.findMany({
        where: { eventId: event.id, playerId },
      });

      expect(poolEntries).toHaveLength(1);
      expect(poolEntries[0]!.status).toBe("AVAILABLE");
    });

    it("does nothing when playerIds is empty", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Empty Pool",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      await addPlayersToEventPoolAction(event.id, [], "AVAILABLE");

      const count = await testDb.eventPlayerAvailability.count({ where: { eventId: event.id } });
      expect(count).toBe(0);
    });
  });

  describe("removePlayerFromEventPoolAction", () => {
    it("removes a player from the pool and their squad assignment", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Remove Pool",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const playerId = fixture.players[0]!.id;

      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId, status: "AVAILABLE" , organisationId: fixture.organisationId},
      });

      const squad = await testDb.eventSquad.findFirstOrThrow({ where: { eventId: event.id } });

      await testDb.eventSquadPlayer.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          playerId,
          source: "MANUAL",
          locked: false,
          selectionReason: "Manually assigned by coach",
                  organisationId: fixture.organisationId,
},
      });

      await removePlayerFromEventPoolAction(event.id, playerId);

      const poolEntry = await testDb.eventPlayerAvailability.findUnique({
        where: { eventId_playerId: { eventId: event.id, playerId } },
      });
      expect(poolEntry).toBeNull();

      const squadAssignment = await testDb.eventSquadPlayer.findFirst({
        where: { eventSquadId: squad.id, playerId },
      });
      expect(squadAssignment).toBeNull();
    });
  });

  describe("assignPlayerToEventSquadAction", () => {
    it("assigns a player to a squad manually", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Assign Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const playerId = fixture.players[0]!.id;
      const squad = await testDb.eventSquad.findFirstOrThrow({ where: { eventId: event.id } });

      await assignPlayerToEventSquadAction(event.id, squad.id, playerId);

      const assignment = await testDb.eventSquadPlayer.findFirst({
        where: { eventSquadId: squad.id, playerId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment!.source).toBe("MANUAL");
      expect(assignment!.locked).toBe(false);
      expect(assignment!.selectionReason).toBe("Manually assigned by coach");
    });

    it("assigns a player as locked when requested", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Lock Assign",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const playerId = fixture.players[0]!.id;
      const squad = await testDb.eventSquad.findFirstOrThrow({ where: { eventId: event.id } });

      await assignPlayerToEventSquadAction(event.id, squad.id, playerId, true);

      const assignment = await testDb.eventSquadPlayer.findFirst({
        where: { eventSquadId: squad.id, playerId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment!.locked).toBe(true);
      expect(assignment!.source).toBe("LOCKED");
    });

    it("rejects assigning a player already assigned to another squad in the same event", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Double Assign",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
              { name: "Squad 2", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
            ],
          },
        },
      });

      const playerId = fixture.players[0]!.id;
      const squads = await testDb.eventSquad.findMany({ where: { eventId: event.id } });

      await assignPlayerToEventSquadAction(event.id, squads[0]!.id, playerId);

      await expect(
        assignPlayerToEventSquadAction(event.id, squads[1]!.id, playerId),
      ).rejects.toThrow("already assigned");
    });
  });

  describe("unassignPlayerFromEventSquadAction", () => {
    it("removes a player from a squad", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Unassign Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      const playerId = fixture.players[0]!.id;
      const squad = await testDb.eventSquad.findFirstOrThrow({ where: { eventId: event.id } });

      const assignment = await testDb.eventSquadPlayer.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          playerId,
          source: "MANUAL",
          locked: false,
          selectionReason: "Manually assigned by coach",
                  organisationId: fixture.organisationId,
},
      });

      await unassignPlayerFromEventSquadAction(assignment.id);

      const removed = await testDb.eventSquadPlayer.findUnique({ where: { id: assignment.id } });
      expect(removed).toBeNull();
    });

    it("throws when assignment does not exist", async () => {
      await expect(
        unassignPlayerFromEventSquadAction("nonexistent-id"),
      ).rejects.toThrow("not found");
    });
  });

  describe("generateEventSquadsAction", () => {
    it("throws when no players are in the event pool", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Empty Generate",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      await expect(
        generateEventSquadsAction(event.id),
      ).rejects.toThrow("No players in the event pool");
    });

    it("throws when all players are unavailable", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Unavailable Generate",
          eventType: "CUP",
          startsAt: new Date("2026-07-01"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: { create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId } },
        },
      });

      await testDb.eventPlayerAvailability.create({
        data: {
          eventId: event.id,
          playerId: fixture.players[0]!.id,
          status: "UNAVAILABLE",
                  organisationId: fixture.organisationId,
},
      });

      await expect(
        generateEventSquadsAction(event.id),
      ).rejects.toThrow("No available players");
    });
  });
});