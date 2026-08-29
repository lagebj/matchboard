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
let playerCodeCounter = 30000;

async function cleanTables(db: PrismaClient) {
  await db.eventMatchAvailability.deleteMany();
  await db.eventPlayerAvailability.deleteMany();
  await db.eventMatchSupportAssignment.deleteMany();
  await db.eventMatch.deleteMany();
  await db.eventSquadPlayer.deleteMany();
  await db.eventSquad.deleteMany();
  await db.event.deleteMany();
  await db.guestPlayer.deleteMany();
  await db.player.deleteMany();
  await db.team.deleteMany();
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

async function createPlayer(db: PrismaClient, overrides: Record<string, unknown> = {}) {
  const team = await db.team.create({
    data: { name: `Team-${Math.random().toString(36).slice(2, 8)}`, organisationId: testOrgId, footballGroupId: testGroupId },
  });
  return db.player.create({
    data: {
      firstName: `Player-${Math.random().toString(36).slice(2, 6)}`,
      lastName: "Test",
      primaryPosition: "MID",
      playerCode: playerCodeCounter++,
      preferredFoot: "RIGHT",
      secondaryFoot: "WEAK",
      bestSide: "CENTER",
      coreTeamId: team.id,
      organisationId: testOrgId,
      ...overrides,
    },
  });
}

describe("event-match-eligibility (ADR-0106 GuestPlayer-aware)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-match-eligibility" },
      update: {},
      create: { name: "Test Org Event Match Eligibility", slug: "test-org-event-match-eligibility" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    auth.updateOrganisationId(testOrgId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getEligibleEventMatchPlayers", () => {
    it("includes a GuestPlayer assigned to the match's squad", async () => {
      const { getEligibleEventMatchPlayers } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Oliver Hansen", sourceLabel: "G2016", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const eligible = await getEligibleEventMatchPlayers(match.id, auth.orgFilter);
        const entry = eligible.find((p) => p.guestPlayerId === guestPlayer.id);
        expect(entry).toBeDefined();
        expect(entry?.participantType).toBe("GUEST_PLAYER");
        expect(entry?.playerId).toBeNull();
        expect(entry?.displayName).toBe("Oliver Hansen");
        expect(entry?.source).toBe("squad");
      } finally {
        await cleanTables(db);
      }
    });

    it("never fabricates a rating for a GuestPlayer", async () => {
      const { getEligibleEventMatchPlayers } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Noah Berg", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const eligible = await getEligibleEventMatchPlayers(match.id, auth.orgFilter);
        const entry = eligible.find((p) => p.guestPlayerId === guestPlayer.id);
        expect(entry?.overallLevel).toBeNull();
        expect(entry?.isGK).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });

    it("still includes real Players from the squad alongside a GuestPlayer", async () => {
      const { getEligibleEventMatchPlayers } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const player = await createPlayer(db, { goalkeeperAbility: "YES", primaryPosition: "GK" });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Emil Larsen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, playerId: player.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const eligible = await getEligibleEventMatchPlayers(match.id, auth.orgFilter);
        expect(eligible.some((p) => p.playerId === player.id && p.participantType === "PLAYER")).toBe(true);
        expect(eligible.some((p) => p.guestPlayerId === guestPlayer.id && p.participantType === "GUEST_PLAYER")).toBe(true);
      } finally {
        await cleanTables(db);
      }
    });
  });

  describe("assertEligibleEventMatchPlayer", () => {
    it("returns eligible for a GuestPlayer in the squad", async () => {
      const { assertEligibleEventMatchPlayer } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Oliver Hansen", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const result = await assertEligibleEventMatchPlayer(match.id, guestPlayer.id, auth.orgFilter);
        expect(result.eligible).toBe(true);
        expect(result.source).toBe("squad");
      } finally {
        await cleanTables(db);
      }
    });

    it("returns not eligible for a GuestPlayer not assigned anywhere in the match", async () => {
      const { assertEligibleEventMatchPlayer } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Unassigned Guest", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const result = await assertEligibleEventMatchPlayer(match.id, guestPlayer.id, auth.orgFilter);
        expect(result.eligible).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });

    it("rejects a participant in the squad but marked unavailable for this specific match (ADR-0106 PR 5b)", async () => {
      const { assertEligibleEventMatchPlayer } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Match-unavailable Guest", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });
      await db.eventMatchAvailability.create({
        data: { eventMatchId: match.id, guestPlayerId: guestPlayer.id, organisationId: testOrgId },
      });

      try {
        const result = await assertEligibleEventMatchPlayer(match.id, guestPlayer.id, auth.orgFilter);
        expect(result.eligible).toBe(false);
        expect(result.reason).toMatch(/unavailable/i);
      } finally {
        await cleanTables(db);
      }
    });

    it("rejects a participant whose Event-level status is UNAVAILABLE, even without a per-match exception", async () => {
      const { assertEligibleEventMatchPlayer } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Event-unavailable Guest", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      await db.eventPlayerAvailability.create({
        data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "UNAVAILABLE", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });

      try {
        const result = await assertEligibleEventMatchPlayer(match.id, guestPlayer.id, auth.orgFilter);
        expect(result.eligible).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });
  });

  describe("getEligibleEventMatchPlayers excludes match-unavailable participants (ADR-0106 PR 5b)", () => {
    it("excludes a squad participant with a per-match unavailability exception", async () => {
      const { getEligibleEventMatchPlayers } = await import("@/lib/events/event-match-eligibility");
      const event = await createEvent(db);
      const squad = await db.eventSquad.create({
        data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
      });
      const guestPlayer = await db.guestPlayer.create({
        data: { name: "Match-unavailable Guest", organisationId: testOrgId, footballGroupId: testGroupId },
      });
      await db.eventSquadPlayer.create({
        data: { eventId: event.id, eventSquadId: squad.id, guestPlayerId: guestPlayer.id, source: "MANUAL", selectionReason: "Test", organisationId: testOrgId },
      });
      const match = await db.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          category: "CUP",
          organisationId: testOrgId,
          opponentName: "Opponent",
          startsAt: new Date("2028-01-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });
      await db.eventMatchAvailability.create({
        data: { eventMatchId: match.id, guestPlayerId: guestPlayer.id, organisationId: testOrgId },
      });

      try {
        const eligible = await getEligibleEventMatchPlayers(match.id, auth.orgFilter);
        expect(eligible.some((p) => p.guestPlayerId === guestPlayer.id)).toBe(false);
      } finally {
        await cleanTables(db);
      }
    });
  });
});
