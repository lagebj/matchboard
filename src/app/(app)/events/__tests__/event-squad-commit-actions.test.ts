import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
} from "@/test/test-db";
import {
  validateEventSquadsBeforeCommit,
  confirmEventSquadsAction,
  unconfirmEventSquadsAction,
  getEventSquadsStatusAction,
} from "../event-squad-commit-actions";

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach-id", email: "test@matchboard.test", name: "Test Coach" }) };
});

vi.mock("@/lib/auth/actor-context", () => {
  const makeCtx = () => ({
    userId: "test-coach-id",
    email: "test@matchboard.test",
    membershipId: "mem-test",
    organisationId: testOrgId,
        footballGroupId: testGroupId,
    organisationSlug: "test-org",
    role: "COACH",
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
let playerCodeCounter = 10000;
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

describe("event-squad-commit-actions", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-commit" },
      update: {},
      create: { name: "Test Org Commit", slug: "test-org-commit" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("validateEventSquadsBeforeCommit", () => {
    it("returns blocking issue for nonexistent event", async () => {
      const result = await validateEventSquadsBeforeCommit("nonexistent-id");
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "event_not_found")).toBe(true);
    });

    it("returns blocking issue for event with no squads", async () => {
      const event = await db.event.create({
        data: {
          name: "No Squads Event",
          eventType: "CUP",
          startsAt: new Date("2028-01-01T09:00:00Z"),
          endsAt: new Date("2028-01-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "no_squads")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns blocking issue for duplicate player across squads", async () => {
      const { player } = await createPlayer(db);
      const event = await db.event.create({
        data: {
          name: "Duplicate Player Event",
          eventType: "CUP",
          startsAt: new Date("2028-02-01T09:00:00Z"),
          endsAt: new Date("2028-02-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squadA = await db.eventSquad.create({
        data: { eventId: event.id, name: "Squad A", intent: "COMPETITIVE", targetSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });
      const squadB = await db.eventSquad.create({
        data: { eventId: event.id, name: "Squad B", intent: "BALANCED", targetSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squadA.id, eventId: event.id, playerId: player.id, source: "AUTO" , organisationId: testOrgId} });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squadB.id, eventId: event.id, playerId: player.id, source: "AUTO" , organisationId: testOrgId} });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "duplicate_player_across_squads")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns blocking issue for unavailable player in squad", async () => {
      const { player } = await createPlayer(db);
      const event = await db.event.create({
        data: {
          name: "Unavailable Player Event",
          eventType: "CUP",
          startsAt: new Date("2028-03-01T09:00:00Z"),
          endsAt: new Date("2028-03-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: player.id, status: "UNAVAILABLE" , organisationId: testOrgId},
      });
      const squad = await db.eventSquad.create({
        data: { eventId: event.id, name: "Squad A", intent: "COMPETITIVE", targetSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squad.id, eventId: event.id, playerId: player.id, source: "AUTO" , organisationId: testOrgId} });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "unavailable_player_in_squad")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns blocking issue for squad below minimum size", async () => {
      const event = await db.event.create({
        data: {
          name: "Small Squad Event",
          eventType: "CUP",
          startsAt: new Date("2028-04-01T09:00:00Z"),
          endsAt: new Date("2028-04-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Tiny Squad", intent: "COMPETITIVE", targetSize: 7, minSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "squad_below_minimum")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns info issue for squad below target but above minimum", async () => {
      const { player } = await createPlayer(db);
      const event = await db.event.create({
        data: {
          name: "Below Target Event",
          eventType: "CUP",
          startsAt: new Date("2028-05-01T09:00:00Z"),
          endsAt: new Date("2028-05-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squad = await db.eventSquad.create({
        data: { eventId: event.id, name: "Short Squad", intent: "BALANCED", targetSize: 7, minSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squad.id, eventId: event.id, playerId: player.id, source: "AUTO" , organisationId: testOrgId} });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.issues.some((i) => i.code === "squad_below_target")).toBe(true);
      expect(result.issues.some((i) => i.severity === "info" && i.code === "squad_below_target")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns blocking issue for squad with no goalkeeper coverage", async () => {
      const { player } = await createPlayer(db, { goalkeeperAbility: "NO", primaryPosition: "MID" });
      const event = await db.event.create({
        data: {
          name: "No GK Event",
          eventType: "CUP",
          startsAt: new Date("2028-06-01T09:00:00Z"),
          endsAt: new Date("2028-06-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squad = await db.eventSquad.create({
        data: { eventId: event.id, name: "No GK Squad", intent: "COMPETITIVE", targetSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squad.id, eventId: event.id, playerId: player.id, source: "AUTO" , organisationId: testOrgId} });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "no_goalkeeper_coverage")).toBe(true);

      await cleanEventTables(db);
    });

    it("returns valid for squad meeting all requirements", async () => {
      const { player: gk } = await createPlayer(db, { goalkeeperAbility: "YES", primaryPosition: "GK" });
      const event = await db.event.create({
        data: {
          name: "Valid Squad Event",
          eventType: "CUP",
          startsAt: new Date("2028-07-01T09:00:00Z"),
          endsAt: new Date("2028-07-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squad = await db.eventSquad.create({
        data: { eventId: event.id, name: "Good Squad", intent: "COMPETITIVE", targetSize: 7, minSize: 1, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squad.id, eventId: event.id, playerId: gk.id, source: "AUTO" , organisationId: testOrgId} });

      const result = await validateEventSquadsBeforeCommit(event.id);
      expect(result.valid).toBe(true);
      expect(result.issues.filter((i) => i.severity === "blocking")).toHaveLength(0);

      await cleanEventTables(db);
    });
  });

  describe("confirmEventSquadsAction", () => {
    it("confirms all DRAFT squads to LOCKED", async () => {
      const event = await db.event.create({
        data: {
          name: "Confirm Event",
          eventType: "CUP",
          startsAt: new Date("2028-08-01T09:00:00Z"),
          endsAt: new Date("2028-08-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const { player: gk } = await createPlayer(db, { goalkeeperAbility: "YES", primaryPosition: "GK" });
      const squad = await db.eventSquad.create({
        data: { eventId: event.id, name: "Ready Squad", intent: "COMPETITIVE", targetSize: 7, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquadPlayer.create({ data: { eventSquadId: squad.id, eventId: event.id, playerId: gk.id, source: "AUTO", organisationId: testOrgId } });

      const result = await confirmEventSquadsAction(event.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.confirmedCount).toBe(1);
      }

      const squads = await db.eventSquad.findMany({ where: { eventId: event.id } });
      expect(squads.every((s) => s.status === "LOCKED")).toBe(true);

      await cleanEventTables(db);
    });

    it("fails when blocking validation issues exist", async () => {
      const event = await db.event.create({
        data: {
          name: "Blocked Confirm Event",
          eventType: "CUP",
          startsAt: new Date("2028-09-01T09:00:00Z"),
          endsAt: new Date("2028-09-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Empty Squad", intent: "COMPETITIVE", targetSize: 7, minSize: 5, status: "DRAFT" , organisationId: testOrgId},
      });

      const result = await confirmEventSquadsAction(event.id);
      expect(result.success).toBe(false);

      await cleanEventTables(db);
    });
  });

  describe("unconfirmEventSquadsAction", () => {
    it("reverts LOCKED squads back to DRAFT", async () => {
      const event = await db.event.create({
        data: {
          name: "Unconfirm Event",
          eventType: "CUP",
          startsAt: new Date("2028-10-01T09:00:00Z"),
          endsAt: new Date("2028-10-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
                  organisationId: testOrgId,
        footballGroupId: testGroupId,
},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Locked Squad", intent: "COMPETITIVE", targetSize: 7, status: "LOCKED", organisationId: testOrgId },
      });

      const result = await unconfirmEventSquadsAction(event.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.unconfirmedCount).toBe(1);
      }

      const squads = await db.eventSquad.findMany({ where: { eventId: event.id } });
      expect(squads.every((s) => s.status === "DRAFT")).toBe(true);

      await cleanEventTables(db);
    });

    it("fails when no locked squads exist", async () => {
      const event = await db.event.create({
        data: {
          name: "Nothing to Unconfirm",
          eventType: "CUP",
          startsAt: new Date("2028-11-01T09:00:00Z"),
          endsAt: new Date("2028-11-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
                  organisationId: testOrgId,
        footballGroupId: testGroupId,
},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Draft Squad", intent: "BALANCED", targetSize: 7, status: "DRAFT", organisationId: testOrgId },
      });

      const result = await unconfirmEventSquadsAction(event.id);
      expect(result.success).toBe(false);

      await cleanEventTables(db);
    });
  });

  describe("getEventSquadsStatusAction", () => {
    it("returns DRAFT aggregate when all squads are DRAFT", async () => {
      const event = await db.event.create({
        data: {
          name: "Status Draft Event",
          eventType: "CUP",
          startsAt: new Date("2028-12-01T09:00:00Z"),
          endsAt: new Date("2028-12-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
                  organisationId: testOrgId,
        footballGroupId: testGroupId,
},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Draft A", intent: "COMPETITIVE", targetSize: 7, status: "DRAFT" , organisationId: testOrgId},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Draft B", intent: "BALANCED", targetSize: 7, status: "DRAFT", organisationId: testOrgId },
      });

      const result = await getEventSquadsStatusAction(event.id);
      expect(result.aggregateStatus).toBe("DRAFT");
      expect(result.allDraft).toBe(true);
      expect(result.allLocked).toBe(false);

      await cleanEventTables(db);
    });

    it("returns LOCKED aggregate when all squads are LOCKED", async () => {
      const event = await db.event.create({
        data: {
          name: "Status Locked Event",
          eventType: "CUP",
          startsAt: new Date("2029-01-01T09:00:00Z"),
          endsAt: new Date("2029-01-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
                  organisationId: testOrgId,
        footballGroupId: testGroupId,
},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Locked A", intent: "COMPETITIVE", targetSize: 7, status: "LOCKED", organisationId: testOrgId },
      });

      const result = await getEventSquadsStatusAction(event.id);
      expect(result.aggregateStatus).toBe("LOCKED");
      expect(result.allLocked).toBe(true);
      expect(result.allDraft).toBe(false);

      await cleanEventTables(db);
    });

    it("returns MIXED aggregate when squads have mixed statuses", async () => {
      const event = await db.event.create({
        data: {
          name: "Mixed Status Event",
          eventType: "CUP",
          startsAt: new Date("2029-02-01T09:00:00Z"),
          endsAt: new Date("2029-02-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
                  organisationId: testOrgId,
        footballGroupId: testGroupId,
},
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Locked Squad", intent: "COMPETITIVE", targetSize: 7, status: "LOCKED", organisationId: testOrgId },
      });
      await db.eventSquad.create({
        data: { eventId: event.id, name: "Draft Squad", intent: "BALANCED", targetSize: 7, status: "DRAFT", organisationId: testOrgId },
      });

      const result = await getEventSquadsStatusAction(event.id);
      expect(result.aggregateStatus).toBe("MIXED");
      expect(result.mixed).toBe(true);

      await cleanEventTables(db);
    });

    it("returns DRAFT aggregate when no squads exist", async () => {
      const event = await db.event.create({
        data: {
          name: "No Squads Status",
          eventType: "CUP",
          startsAt: new Date("2029-03-01T09:00:00Z"),
          endsAt: new Date("2029-03-01T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });

      const result = await getEventSquadsStatusAction(event.id);
      expect(result.aggregateStatus).toBe("DRAFT");
      expect(result.squads).toHaveLength(0);

      await cleanEventTables(db);
    });
  });
});