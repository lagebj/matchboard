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

async function cleanTables(db: PrismaClient) {
  await db.eventMatchAvailability.deleteMany();
  await db.eventPlayerAvailability.deleteMany();
  await db.eventMatch.deleteMany();
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

async function createMatch(db: PrismaClient, eventId: string, squadId: string, overrides: Record<string, unknown> = {}) {
  return db.eventMatch.create({
    data: {
      eventId,
      eventSquadId: squadId,
      category: "CUP",
      organisationId: testOrgId,
      opponentName: "Opponent",
      startsAt: new Date("2028-01-01T10:00:00Z"),
      status: "SCHEDULED",
      ...overrides,
    },
  });
}

describe("event-match-availability (ADR-0106, PR 5a)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-match-availability" },
      update: {},
      create: { name: "Test Org Event Match Availability", slug: "test-org-event-match-availability" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getEffectiveEventMatchAvailability", () => {
    it("defaults to UNKNOWN event-level status and available for match when no availability row exists", async () => {
      const { getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Oliver Hansen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        const result = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(result.eventLevelStatus).toBe("UNKNOWN");
        expect(result.hasMatchException).toBe(false);
        expect(result.isAvailableForMatch).toBe(true);
      } finally {
        await cleanTables(db);
      }
    });

    it("is available for the match when Event-level status is AVAILABLE and no exception exists", async () => {
      const { getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Noah Berg", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        const result = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(result.eventLevelStatus).toBe("AVAILABLE");
        expect(result.isAvailableForMatch).toBe(true);
      } finally {
        await cleanTables(db);
      }
    });

    it("is unavailable for the match when a per-match exception exists, even though Event-level is AVAILABLE", async () => {
      const { getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Emil Larsen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);
      await db.eventMatchAvailability.create({
        data: { eventMatchId: match.id, guestPlayerId: guestPlayer.id, organisationId: testOrgId },
      });

      try {
        const result = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(result.eventLevelStatus).toBe("AVAILABLE");
        expect(result.hasMatchException).toBe(true);
        expect(result.isAvailableForMatch).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });

    it("Event-level UNAVAILABLE is never overridden by the absence of a per-match exception (invariant)", async () => {
      const { getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Oliver Hansen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "UNAVAILABLE", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        const result = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(result.isAvailableForMatch).toBe(false);
        expect(result.hasMatchException).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });

    it("Event-level WITHDRAWN is also a hard exclusion", async () => {
      const { getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Withdrawn Guest", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "WITHDRAWN", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        const result = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(result.isAvailableForMatch).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });
  });

  describe("setEventMatchUnavailable / removeEventMatchAvailabilityException", () => {
    it("creates an exception that removeEventMatchAvailabilityException correctly removes", async () => {
      const { setEventMatchUnavailable, removeEventMatchAvailabilityException, getEffectiveEventMatchAvailability } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Noah Berg", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        const setResult = await setEventMatchUnavailable(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter, "Leaving early");
        expect(setResult.success).toBe(true);

        const afterSet = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(afterSet.hasMatchException).toBe(true);
        expect(afterSet.isAvailableForMatch).toBe(false);

        const removeResult = await removeEventMatchAvailabilityException(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(removeResult.success).toBe(true);

        const afterRemove = await getEffectiveEventMatchAvailability(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter);
        expect(afterRemove.hasMatchException).toBe(false);
        expect(afterRemove.isAvailableForMatch).toBe(true);
      } finally {
        await cleanTables(db);
      }
    });

    it("setting unavailable twice for the same participant/match does not duplicate (upsert)", async () => {
      const { setEventMatchUnavailable } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Emil Larsen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await createMatch(db, event.id, squad.id);

      try {
        await setEventMatchUnavailable(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter, "First note");
        await setEventMatchUnavailable(match.id, { playerId: null, guestPlayerId: guestPlayer.id }, auth.orgFilter, "Updated note");

        const rows = await db.eventMatchAvailability.findMany({ where: { eventMatchId: match.id, guestPlayerId: guestPlayer.id } });
        expect(rows.length).toBe(1);
        expect(rows[0]!.note).toBe("Updated note");
      } finally {
        await cleanTables(db);
      }
    });
  });

  describe("getEventMatchAvailabilityMatrix", () => {
    it("returns per-participant Event-level status and match exceptions", async () => {
      const { getEventMatchAvailabilityMatrix } = await import("@/lib/events/event-match-availability");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Oliver Hansen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      const match = await createMatch(db, event.id, squad.id);
      await db.eventMatchAvailability.create({
        data: { eventMatchId: match.id, guestPlayerId: guestPlayer.id, note: "Late arrival", organisationId: testOrgId },
      });

      try {
        const matrix = await getEventMatchAvailabilityMatrix(event.id, auth.orgFilter);
        const entry = matrix.find((e) => e.guestPlayerId === guestPlayer.id);
        expect(entry).toBeDefined();
        expect(entry?.eventLevelStatus).toBe("AVAILABLE");
        expect(entry?.matchExceptions[match.id]).toEqual({ note: "Late arrival" });
      } finally {
        await cleanTables(db);
      }
    });
  });
});
