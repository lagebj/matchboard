import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
} from "@/test/test-db";
import { finalizeEventAction, unfinalizeEventAction } from "@/app/(app)/events/event-finalization-actions";
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let db: PrismaClient;
let playerCodeCounter = 30000;
let testOrgId: string;
let testGroupId: string;

async function cleanEventTables(db: PrismaClient) {
  await db.eventSquadPlayer.deleteMany();
  await db.eventSquad.deleteMany();
  await db.eventMatch.deleteMany();
  await db.eventPlayerAvailability.deleteMany();
  await db.event.deleteMany();
  await db.player.deleteMany();
  await db.team.deleteMany();
}

async function createPlayer(db: PrismaClient, overrides: Record<string, unknown> = {}) {
  const team = await db.team.create({
    data: { name: `Team-${Math.random().toString(36).slice(2, 8)}`, organisationId: testOrgId, footballGroupId: testGroupId },
  });
  const player = await db.player.create({
    data: {
      firstName: `Player-${Math.random().toString(36).slice(2, 6)}`,
      lastName: "Test",
      primaryPosition: "MID",
      playerCode: playerCodeCounter++,
      preferredFoot: "RIGHT",
      secondaryFoot: "WEAK",
      bestSide: "CENTER",
      coreTeamId: team.id,
      ...overrides,
      organisationId: testOrgId,
    },
  });
  return { player, team };
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

async function createValidEventWithSquad(db: PrismaClient) {
  const event = await createEvent(db);
  const { player } = await createPlayer(db, { goalkeeperAbility: "YES", primaryPosition: "GK" });
  const squad = await db.eventSquad.create({
    data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
  });
  await db.eventPlayerAvailability.create({
    data: { eventId: event.id, playerId: player.id, status: "AVAILABLE", organisationId: testOrgId },
  });
  await db.eventSquadPlayer.create({
    data: { eventId: event.id, eventSquadId: squad.id, playerId: player.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
  });
  return { event, player, squad };
}

describe("event-finalization-actions", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-finalize-actions" },
      update: {},
      create: { name: "Test Org Finalize Actions", slug: "test-org-event-finalize-actions" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("finalizeEventAction", () => {
    it("fails for nonexistent event", async () => {
      const result = await finalizeEventAction("nonexistent-id");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("fails for event with no squads", async () => {
      const event = await createEvent(db);
      try {
        const result = await finalizeEventAction(event.id);
        expect(result.success).toBe(false);
        expect(result.error).toContain("blocking issues");
      } finally {
        await cleanEventTables(db);
      }
    });

    it("finalizes a valid event", async () => {
      const { event } = await createValidEventWithSquad(db);
      try {
        const result = await finalizeEventAction(event.id);
        expect(result.success).toBe(true);
        expect(result.finalizedAt).toBeDefined();

        const updated = await db.event.findUnique({ where: { id: event.id } });
        expect(updated?.status).toBe("FINALIZED");
        expect(updated?.finalizedAt).toBeDefined();
        expect(updated?.finalizedBy).toBeDefined();
      } finally {
        await cleanEventTables(db);
      }
    });

    it("fails to finalize an already finalized event", async () => {
      const { event } = await createValidEventWithSquad(db);
      try {
        const first = await finalizeEventAction(event.id);
        expect(first.success).toBe(true);

        const second = await finalizeEventAction(event.id);
        expect(second.success).toBe(false);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("fails for event with unavailable player in squad", async () => {
      const event = await createEvent(db);
      const { player } = await createPlayer(db, { goalkeeperAbility: "NO" });
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: player.id, status: "UNAVAILABLE", organisationId: testOrgId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, playerId: player.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });

      try {
        const result = await finalizeEventAction(event.id);
        expect(result.success).toBe(false);
      } finally {
        await cleanEventTables(db);
      }
    });
  });

  describe("unfinalizeEventAction", () => {
    it("fails for nonexistent event", async () => {
      const result = await unfinalizeEventAction("nonexistent-id");
      expect(result.success).toBe(false);
    });

    it("fails for draft event", async () => {
      const event = await createEvent(db);
      try {
        const result = await unfinalizeEventAction(event.id);
        expect(result.success).toBe(false);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("unfinalizes a finalized event", async () => {
      const { event } = await createValidEventWithSquad(db);
      try {
        const finalizeResult = await finalizeEventAction(event.id);
        expect(finalizeResult.success).toBe(true);

        const unfinalizeResult = await unfinalizeEventAction(event.id);
        expect(unfinalizeResult.success).toBe(true);

        const updated = await db.event.findUnique({ where: { id: event.id } });
        expect(updated?.status).toBe("DRAFT");
        expect(updated?.finalizedAt).toBeNull();
        expect(updated?.finalizedBy).toBeNull();
      } finally {
        await cleanEventTables(db);
      }
    });
  });
});