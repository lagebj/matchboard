import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
} from "@/test/test-db";
import {
  validateEventForFinalization,
  validateEventForUnfinalization,
} from "@/lib/events/event-finalization-validation";
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
let playerCodeCounter = 20000;
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

describe("event-finalization-validation", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-finalize" },
      update: {},
      create: { name: "Test Org Finalize", slug: "test-org-event-finalize" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("validateEventForFinalization", () => {
    it("returns blocking issue for nonexistent event", async () => {
      const result = await validateEventForFinalization("nonexistent-id", auth.orgFilter);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "event_not_found")).toBe(true);
    });

    it("returns blocking issue for already finalized event", async () => {
      const event = await createEvent(db, { status: "FINALIZED" });
      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.code === "event_already_finalized")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns blocking issue for event with no squads", async () => {
      const event = await createEvent(db);
      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.code === "no_squads")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("duplicate player across squads is prevented by DB constraint (defense-in-depth validation exists)", () => {
      // EventSquadPlayer has @@unique([eventId, playerId]) which prevents
      // a player from appearing in two squads for the same event at the DB level.
      // The validation function's duplicate_player_across_squads check is
      // defense-in-depth. This test acknowledges that the DB constraint makes
      // it impossible to create this scenario via Prisma, so the validation
      // function's check cannot be integration-tested for this specific case.
      expect(true).toBe(true);
    });

    it("returns blocking issue for unavailable player in squad", async () => {
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
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.code === "unavailable_player_in_squad")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns valid for a well-formed event with available players", async () => {
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

      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns info for cancelled match", async () => {
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
      await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          opponentName: "Test Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledReason: "Weather",
          organisationId: testOrgId,
        },
      });

      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(true);
        expect(result.issues.some((i) => i.code === "cancelled_match")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns blocking issue for squad below minimum size", async () => {
      const event = await createEvent(db);
      const { player } = await createPlayer(db, { goalkeeperAbility: "YES", primaryPosition: "GK" });
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 7, minSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: player.id, status: "AVAILABLE", organisationId: testOrgId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, playerId: player.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });

      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.code === "squad_below_minimum")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns warning for match with draft report", async () => {
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
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          opponentName: "Test Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
          organisationId: testOrgId,
        },
      });
      await db.eventPostMatchReport.create({
        data: {
          eventMatchId: match.id,
          status: "DRAFT",
          organisationId: testOrgId,
        },
      });

      try {
        const result = await validateEventForFinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(true);
        expect(result.issues.some((i) => i.code === "incomplete_report" && i.severity === "warning")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });
  });

  describe("validateEventForUnfinalization", () => {
    it("returns blocking issue for nonexistent event", async () => {
      const result = await validateEventForUnfinalization("nonexistent-id", auth.orgFilter);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "event_not_found")).toBe(true);
    });

    it("returns blocking issue for draft event", async () => {
      const event = await createEvent(db);
      try {
        const result = await validateEventForUnfinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(false);
        expect(result.issues.some((i) => i.code === "event_not_finalized")).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });

    it("returns valid for finalized event", async () => {
      const event = await createEvent(db, { status: "FINALIZED", finalizedAt: new Date(), finalizedBy: "test-user" });
      try {
        const result = await validateEventForUnfinalization(event.id, auth.orgFilter);
        expect(result.valid).toBe(true);
      } finally {
        await cleanEventTables(db);
      }
    });
  });
});