import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, createTestGroup } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => {
  let _db: PrismaClient;
  return {
    get db() {
      return _db ?? getTestDb();
    },
    set db(v: PrismaClient) {
      _db = v;
    },
  };
});

let db: PrismaClient;
let testOrgId: string;
let testGroupId: string;

async function cleanEventGuestTables(db: PrismaClient) {
  await db.eventSquadPlayer.deleteMany();
  await db.eventPlayerAvailability.deleteMany();
  await db.eventSquad.deleteMany();
  await db.event.deleteMany();
  await db.guestPlayer.deleteMany();
}

async function createEvent(db: PrismaClient, overrides: Record<string, unknown> = {}) {
  return db.event.create({
    data: {
      name: `Event-${Math.random().toString(36).slice(2, 8)}`,
      eventType: "CUP",
      startsAt: new Date("2028-01-01T09:00:00Z"),
      endsAt: new Date("2028-01-01T17:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      organisationId: testOrgId,
      footballGroupId: testGroupId,
      ...overrides,
    },
  });
}

async function createGuestPlayer(db: PrismaClient, footballGroupId: string, overrides: Record<string, unknown> = {}) {
  return db.guestPlayer.create({
    data: {
      name: `Guest-${Math.random().toString(36).slice(2, 8)}`,
      organisationId: testOrgId,
      footballGroupId,
      ...overrides,
    },
  });
}

describe("event-guest-player-participation (ADR-0106)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-guest-participation" },
      update: {},
      create: { name: "Test Org Event Guest Participation", slug: "test-org-event-guest-participation" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("assertGuestPlayerBelongsToEventGroup", () => {
    it("passes for a guest player belonging to the event's own group", async () => {
      const { assertGuestPlayerBelongsToEventGroup } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId);
      try {
        await expect(assertGuestPlayerBelongsToEventGroup(event.id, guestPlayer.id, auth.orgFilter)).resolves.toBeUndefined();
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("rejects a guest player from a different group", async () => {
      const { assertGuestPlayerBelongsToEventGroup } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const otherGroupId = await createTestGroup(db, testOrgId);
      const guestPlayer = await createGuestPlayer(db, otherGroupId);
      try {
        await expect(assertGuestPlayerBelongsToEventGroup(event.id, guestPlayer.id, auth.orgFilter)).rejects.toThrow(
          "does not belong to this Event's Group",
        );
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("rejects an inactive guest player", async () => {
      const { assertGuestPlayerBelongsToEventGroup } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId, { active: false, deactivatedAt: new Date() });
      try {
        await expect(assertGuestPlayerBelongsToEventGroup(event.id, guestPlayer.id, auth.orgFilter)).rejects.toThrow(
          "inactive",
        );
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("rejects a nonexistent event", async () => {
      const { assertGuestPlayerBelongsToEventGroup } = await import("@/lib/events/event-guest-player-participation");
      const guestPlayer = await createGuestPlayer(db, testGroupId);
      try {
        await expect(assertGuestPlayerBelongsToEventGroup("nonexistent", guestPlayer.id, auth.orgFilter)).rejects.toThrow(
          "Event not found",
        );
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("rejects a nonexistent guest player", async () => {
      const { assertGuestPlayerBelongsToEventGroup } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      try {
        await expect(assertGuestPlayerBelongsToEventGroup(event.id, "nonexistent", auth.orgFilter)).rejects.toThrow(
          "Guest player not found",
        );
      } finally {
        await cleanEventGuestTables(db);
      }
    });
  });

  describe("getAvailableGuestPlayersForEvent", () => {
    it("returns active guest players from the event's group not yet in the pool", async () => {
      const { getAvailableGuestPlayersForEvent } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId, { name: "Oliver Hansen" });
      try {
        const results = await getAvailableGuestPlayersForEvent(event.id, auth.orgFilter);
        expect(results.map((g) => g.id)).toContain(guestPlayer.id);
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("excludes guest players already in the event's pool", async () => {
      const { getAvailableGuestPlayersForEvent } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId);
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      try {
        const results = await getAvailableGuestPlayersForEvent(event.id, auth.orgFilter);
        expect(results.map((g) => g.id)).not.toContain(guestPlayer.id);
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("excludes guest players from a different group", async () => {
      const { getAvailableGuestPlayersForEvent } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const otherGroupId = await createTestGroup(db, testOrgId);
      const guestPlayer = await createGuestPlayer(db, otherGroupId);
      try {
        const results = await getAvailableGuestPlayersForEvent(event.id, auth.orgFilter);
        expect(results.map((g) => g.id)).not.toContain(guestPlayer.id);
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("excludes inactive guest players", async () => {
      const { getAvailableGuestPlayersForEvent } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId, { active: false, deactivatedAt: new Date() });
      try {
        const results = await getAvailableGuestPlayersForEvent(event.id, auth.orgFilter);
        expect(results.map((g) => g.id)).not.toContain(guestPlayer.id);
      } finally {
        await cleanEventGuestTables(db);
      }
    });
  });

  describe("getEventGuestPlayerPool", () => {
    it("returns pool entries with squad assignment when assigned", async () => {
      const { getEventGuestPlayerPool } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId, { name: "Noah Berg", sourceLabel: "G2016" });
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });

      try {
        const pool = await getEventGuestPlayerPool(event.id, auth.orgFilter);
        const entry = pool.find((p) => p.guestPlayerId === guestPlayer.id);
        expect(entry).toBeDefined();
        expect(entry?.name).toBe("Noah Berg");
        expect(entry?.sourceLabel).toBe("G2016");
        expect(entry?.assignedSquadId).toBe(squad.id);
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("returns pool entries with no squad assignment when unassigned", async () => {
      const { getEventGuestPlayerPool } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const guestPlayer = await createGuestPlayer(db, testGroupId);
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });

      try {
        const pool = await getEventGuestPlayerPool(event.id, auth.orgFilter);
        const entry = pool.find((p) => p.guestPlayerId === guestPlayer.id);
        expect(entry?.assignedSquadId).toBeNull();
      } finally {
        await cleanEventGuestTables(db);
      }
    });

    it("does not include real Player rows", async () => {
      const { getEventGuestPlayerPool } = await import("@/lib/events/event-guest-player-participation");
      const event = await createEvent(db);
      const team = await db.team.create({
        data: { name: `Team-${Math.random().toString(36).slice(2, 8)}`, organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const player = await db.player.create({
        data: {
          firstName: "Real",
          lastName: "Player",
          primaryPosition: "MID",
          playerCode: 90001,
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          coreTeamId: team.id,
          organisationId: testOrgId,
        },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: player.id, status: "AVAILABLE", organisationId: testOrgId },
      });

      try {
        const pool = await getEventGuestPlayerPool(event.id, auth.orgFilter);
        expect(pool.length).toBe(0);
      } finally {
        await db.eventPlayerAvailability.deleteMany();
        await db.player.deleteMany();
        await db.team.deleteMany();
        await cleanEventGuestTables(db);
      }
    });
  });
});
