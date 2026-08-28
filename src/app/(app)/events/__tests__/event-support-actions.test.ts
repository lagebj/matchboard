import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient, EventPlayerStatus } from "@/generated/prisma/client";
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
  addEventMatchSupportAssignmentAction,
  removeEventMatchSupportAssignmentAction,
  updateEventMatchSupportAssignmentAction,
  getEventMatchSupportAssignmentsAction,
  getSupportCandidatesForMatchAction,
} from "../event-support-actions";
import { updateEventMatchDurationAction, updateEventNumberOfHalvesAction } from "../actions";

async function createEventWithMatches(testDb: PrismaClient, options?: { matchDurationMinutes?: number; matchDates?: Date[] }) {
  const matchDurationMinutes = options?.matchDurationMinutes ?? 25;

  const event = await testDb.event.create({
    data: {
      name: "Support Test Event",
      eventType: "CUP",
      startsAt: new Date("2026-07-01T10:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      matchDurationMinutes,
      organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      squads: {
        create: [
          { name: "Red Squad", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
          { name: "Blue Squad", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
        ],
      },
    },
  });

  const squads = await testDb.eventSquad.findMany({
    where: { eventId: event.id },
    orderBy: { generationOrder: "asc" },
  });

  const baseDate = options?.matchDates?.[0] ?? new Date("2026-07-01T10:00:00Z");
  const match1 = await testDb.eventMatch.create({
    data: {
      eventId: event.id,
      eventSquadId: squads[0]!.id,
      category: "CUP",
      opponentName: "Opponent A",
      startsAt: baseDate,
          organisationId: fixture.organisationId,
},
  });

  const match2Date = options?.matchDates?.[1] ?? new Date("2026-07-01T12:00:00Z");
  const match2 = await testDb.eventMatch.create({
    data: {
      eventId: event.id,
      eventSquadId: squads[1]!.id,
      category: "CUP",
      opponentName: "Opponent B",
      startsAt: match2Date,
          organisationId: fixture.organisationId,
},
  });

  return { event, squads, match1, match2 };
}

async function addPlayerToEventAndSquad(
  testDb: PrismaClient,
  eventId: string,
  squadId: string,
  playerId: string,
  availabilityStatus: EventPlayerStatus = "AVAILABLE",
) {
  await testDb.eventPlayerAvailability.create({
    data: { eventId, playerId, status: availabilityStatus , organisationId: fixture.organisationId},
  });
  await testDb.eventSquadPlayer.create({
    data: {
      eventId,
      eventSquadId: squadId,
      playerId,
      source: "MANUAL",
      locked: false,
      selectionReason: "Test assignment",
          organisationId: fixture.organisationId,
},
  });
}

describe("Event support actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("addEventMatchSupportAssignmentAction", () => {
    it("creates a support assignment successfully", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      const assignment = await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
        plannedRole: "DEFENDER_COVER",
        note: "Covering defense",
      });

      expect(assignment).toBeDefined();
      expect(assignment.playerId).toBe(playerId);
      expect(assignment.sourceEventSquadId).toBe(squads[1]!.id);
      expect(assignment.targetEventSquadId).toBe(squads[0]!.id);
      expect(assignment.plannedRole).toBe("DEFENDER_COVER");
      expect(assignment.note).toBe("Covering defense");
    });

    it("rejects duplicate support assignment for same match and player", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
      });

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
        }),
      ).rejects.toThrow("Already assigned");
    });

    it("rejects support assignment when match duration is not set", async () => {
      const event = await testDb.event.create({
        data: {
          name: "No Duration Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: null,
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
              { name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
            ],
          },
        },
      });

      const squads = await testDb.eventSquad.findMany({
        where: { eventId: event.id },
        orderBy: { generationOrder: "asc" },
      });

      const match = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squads[0]!.id,
          category: "CUP",
          opponentName: "Opponent",
          startsAt: new Date("2026-07-01T10:00:00Z"),
                  organisationId: fixture.organisationId,
},
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match.id,
          playerId,
        }),
      ).rejects.toThrow("match duration not set");
    });

    it("rejects support assignment for cancelled match", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const cancelledMatch = await testDb.eventMatch.update({
        where: { id: match1.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: "Weather" },
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: cancelledMatch.id,
          playerId,
        }),
      ).rejects.toThrow("cancelled");
    });

    it("rejects support assignment when player is not in any squad", async () => {
      const { event, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId, status: "AVAILABLE" , organisationId: fixture.organisationId},
      });

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
        }),
      ).rejects.toThrow("not assigned to any event squad");
    });

    it("validates eligibility via isPlayerAvailableForSupport", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await testDb.eventPlayerAvailability.update({
        where: { eventId_playerId: { eventId: event.id, playerId } },
        data: { status: "UNAVAILABLE" },
      });

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
        }),
      ).rejects.toThrow(/Cannot add helper.*unavailable/i);
    });

    it("rejects support assignment when player is in the target squad (same squad)", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[0]!.id, playerId);

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
        }),
      ).rejects.toThrow(/Cannot add helper.*target squad/i);
    });

    it("rejects support assignment with invalid planned role", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
          plannedRole: "Invalid Role" as never,
        }),
      ).rejects.toThrow("Invalid planned role");
    });
  });

  describe("removeEventMatchSupportAssignmentAction", () => {
    it("removes a support assignment successfully", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      const assignment = await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
      });

      await removeEventMatchSupportAssignmentAction(assignment.id);

      const found = await testDb.eventMatchSupportAssignment.findUnique({
        where: { id: assignment.id },
      });
      expect(found).toBeNull();
    });

    it("throws when assignment does not exist", async () => {
      await expect(
        removeEventMatchSupportAssignmentAction("nonexistent-id"),
      ).rejects.toThrow("not found");
    });
  });

  describe("updateEventMatchSupportAssignmentAction", () => {
    it("updates planned role and note successfully", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      const assignment = await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
        plannedRole: "DEFENDER_COVER",
      });

      const updated = await updateEventMatchSupportAssignmentAction({
        assignmentId: assignment.id,
        plannedRole: "MIDFIELD_COVER",
        note: "Updated role",
      });

      expect(updated.plannedRole).toBe("MIDFIELD_COVER");
      expect(updated.note).toBe("Updated role");
    });

    it("validates planned role on update", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      const assignment = await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
      });

      await expect(
        updateEventMatchSupportAssignmentAction({
          assignmentId: assignment.id,
          plannedRole: "Invalid Role" as never,
        }),
      ).rejects.toThrow("Invalid planned role");
    });

    it("throws when assignment does not exist", async () => {
      await expect(
        updateEventMatchSupportAssignmentAction({
          assignmentId: "nonexistent-id",
          plannedRole: "GENERAL_COVER",
        }),
      ).rejects.toThrow("not found");
    });

    it("clears planned role when set to null", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      const assignment = await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
        plannedRole: "GENERAL_COVER",
      });

      const updated = await updateEventMatchSupportAssignmentAction({
        assignmentId: assignment.id,
        plannedRole: undefined,
      });

      expect(updated.plannedRole).toBeNull();
    });
  });

  describe("getEventMatchSupportAssignmentsAction", () => {
    it("returns empty array when no assignments exist", async () => {
      const { event } = await createEventWithMatches(testDb);

      const result = await getEventMatchSupportAssignmentsAction(event.id);
      expect(result).toEqual([]);
    });

    it("returns assignments with conflict detection", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
        plannedRole: "GENERAL_COVER",
      });

      const result = await getEventMatchSupportAssignmentsAction(event.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.playerId).toBe(playerId);
      expect(result[0]!.isConflict).toBe(false);
      expect(result[0]!.conflictReason).toBeNull();
    });

    it("detects conflict when player is removed from source squad", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
      });

      await testDb.eventSquadPlayer.deleteMany({
        where: { eventSquadId: squads[1]!.id, playerId },
      });

      const result = await getEventMatchSupportAssignmentsAction(event.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.isConflict).toBe(true);
      expect(result[0]!.conflictReason).toBe("Player removed from source squad");
    });

    it("detects conflict when player is unavailable", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await addEventMatchSupportAssignmentAction({
        eventMatchId: match1.id,
        playerId,
      });

      await testDb.eventPlayerAvailability.update({
        where: { eventId_playerId: { eventId: event.id, playerId } },
        data: { status: "UNAVAILABLE" },
      });

      const result = await getEventMatchSupportAssignmentsAction(event.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.isConflict).toBe(true);
      expect(result[0]!.conflictReason).toBe("Player unavailable for event");
    });

    it("detects conflict when match duration is not set", async () => {
      const event = await testDb.event.create({
        data: {
          name: "No Duration Conflict Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: null,
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
              { name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
            ],
          },
        },
      });

      const squads = await testDb.eventSquad.findMany({
        where: { eventId: event.id },
        orderBy: { generationOrder: "asc" },
      });

      const match = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squads[0]!.id,
          category: "CUP",
          opponentName: "Opponent",
          startsAt: new Date("2026-07-01T10:00:00Z"),
                  organisationId: fixture.organisationId,
},
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await testDb.eventMatchSupportAssignment.create({
        data: {
          eventMatchId: match.id,
          playerId,
          sourceEventSquadId: squads[1]!.id,
          targetEventSquadId: squads[0]!.id,
                  organisationId: fixture.organisationId,
},
      });

      const result = await getEventMatchSupportAssignmentsAction(event.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.isConflict).toBe(true);
      expect(result[0]!.conflictReason).toBe("Event match duration not set");
    });

    it("detects overlap conflict when player supports two overlapping matches", async () => {
      const match1Start = new Date("2026-07-01T10:00:00Z");
      const match2Start = new Date("2026-07-01T10:10:00Z");
      const { event, squads, match1, match2 } = await createEventWithMatches(testDb, {
        matchDurationMinutes: 25,
        matchDates: [match1Start, match2Start],
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await testDb.eventMatchSupportAssignment.createMany({
        data: [
          {
            eventMatchId: match1.id,
            playerId,
            sourceEventSquadId: squads[1]!.id,
            targetEventSquadId: squads[0]!.id,
                      organisationId: fixture.organisationId,
},
          {
            eventMatchId: match2.id,
            playerId,
            sourceEventSquadId: squads[1]!.id,
            targetEventSquadId: squads[0]!.id,
                      organisationId: fixture.organisationId,
},
        ],
      });

      const result = await getEventMatchSupportAssignmentsAction(event.id);

      const overlappingAssignments = result.filter((a) => a.isConflict && a.conflictReason?.includes("overlapping"));
      expect(overlappingAssignments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateEventMatchMatchDurationAction", () => {
    it("sets match duration successfully", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Duration Update Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: null,
          organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
          squads: {
            create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
          },
        },
      });

      const updated = await updateEventMatchDurationAction(event.id, 30);

      expect(updated.matchDurationMinutes).toBe(30);
    });

    it("clears match duration when set to null", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });

      const updated = await updateEventMatchDurationAction(event.id, null);

      expect(updated.matchDurationMinutes).toBeNull();
    });

    it("sets match duration to null when zero is passed", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });

      const updated = await updateEventMatchDurationAction(event.id, 0);

      expect(updated.matchDurationMinutes).toBeNull();
    });
  });

  describe("updateEventNumberOfHalvesAction", () => {
    it("defaults to 1 (single continuous period) for a newly created event", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });
      expect(event.numberOfHalves).toBe(1);
    });

    it("sets numberOfHalves to 2", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });

      const updated = await updateEventNumberOfHalvesAction(event.id, 2);

      expect(updated.numberOfHalves).toBe(2);
    });

    it("sets numberOfHalves back to 1", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });
      await updateEventNumberOfHalvesAction(event.id, 2);

      const updated = await updateEventNumberOfHalvesAction(event.id, 1);

      expect(updated.numberOfHalves).toBe(1);
    });

    it("rejects an out-of-range value by falling back to 1, not persisting garbage", async () => {
      const { event } = await createEventWithMatches(testDb, { matchDurationMinutes: 25 });
      await updateEventNumberOfHalvesAction(event.id, 2);

      const updated = await updateEventNumberOfHalvesAction(event.id, 5);

      expect(updated.numberOfHalves).toBe(1);
    });
  });

  describe("support-planning overlap detection with numberOfHalves=2", () => {
    it("a 2-half event's match window covers 2 × half duration, not just one half", async () => {
      // Two 25-minute halves starting 40 minutes apart: match A's real window (10:00-10:50)
      // overlaps match B's start (10:40) only when the full 2-half length is used -- a
      // single-half (25 min) window would wrongly report no overlap.
      const event = await testDb.event.create({
        data: {
          name: "Two Halves Overlap Event",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: 25,
          numberOfHalves: 2,
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
              { name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
            ],
          },
        },
        include: { squads: true },
      });
      const [squadA, squadB] = event.squads;

      await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squadA.id,
          opponentName: "Opponent A",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          organisationId: fixture.organisationId,
        },
      });
      const matchB = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squadB.id,
          opponentName: "Opponent B",
          startsAt: new Date("2026-07-01T10:40:00Z"),
          organisationId: fixture.organisationId,
        },
      });

      const playerAId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squadA.id, playerAId);

      const candidates = await getSupportCandidatesForMatchAction(matchB.id);
      const candidate = candidates.find((c) => c.playerId === playerAId);

      expect(candidate?.available).toBe(false);
      expect(candidate?.unavailableReason).toBe("Own squad has overlapping match");
    });
  });

  describe("per-squad match timing overrides (7v7 2x17+1min break vs 9v9 2x20+1min break)", () => {
    it("resolves each squad's helper-overlap window from its OWN override, not the event default or the other squad's", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Mixed Format Cup",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: 25,
          numberOfHalves: 1,
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              {
                name: "7v7 Squad",
                intent: "BALANCED",
                targetSize: 7,
                generationOrder: 0,
                organisationId: fixture.organisationId,
                gameFormatOverride: "SEVEN_A_SIDE",
                numberOfHalvesOverride: 2,
                matchDurationMinutesOverride: 17,
                breakDurationMinutesOverride: 1,
              },
              {
                name: "9v9 Squad",
                intent: "BALANCED",
                targetSize: 9,
                generationOrder: 1,
                organisationId: fixture.organisationId,
                gameFormatOverride: "NINE_A_SIDE",
                numberOfHalvesOverride: 2,
                matchDurationMinutesOverride: 20,
                breakDurationMinutesOverride: 1,
              },
            ],
          },
        },
        include: { squads: true },
      });
      const squad7v7 = event.squads.find((s) => s.name === "7v7 Squad")!;
      const squad9v9 = event.squads.find((s) => s.name === "9v9 Squad")!;

      // 7v7 squad's real window: 2x17+1 break = 35 min -> 10:00-10:35.
      await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad7v7.id,
          opponentName: "Opponent A",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          organisationId: fixture.organisationId,
        },
      });
      // 9v9 squad's match starts at 10:36 -- one minute AFTER the 7v7 squad's real 35-minute
      // window ends. If the resolver incorrectly applied the 9v9 squad's own 41-minute window
      // (2x20+1) to the 7v7 match instead, or applied the event-level default duration (25 min,
      // giving 10:00-10:25) to either match, the overlap outcome would differ from reality.
      const match9v9 = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad9v9.id,
          opponentName: "Opponent B",
          startsAt: new Date("2026-07-01T10:36:00Z"),
          organisationId: fixture.organisationId,
        },
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squad7v7.id, playerId);

      const candidates = await getSupportCandidatesForMatchAction(match9v9.id);
      const candidate = candidates.find((c) => c.playerId === playerId);

      expect(candidate?.available).toBe(true);
    });

    it("blocks the helper once the source squad's own override window actually overlaps", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Mixed Format Cup Overlap",
          eventType: "CUP",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          matchDurationMinutes: 25,
          numberOfHalves: 1,
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              {
                name: "7v7 Squad",
                intent: "BALANCED",
                targetSize: 7,
                generationOrder: 0,
                organisationId: fixture.organisationId,
                numberOfHalvesOverride: 2,
                matchDurationMinutesOverride: 17,
                breakDurationMinutesOverride: 1,
              },
              {
                name: "9v9 Squad",
                intent: "BALANCED",
                targetSize: 9,
                generationOrder: 1,
                organisationId: fixture.organisationId,
                numberOfHalvesOverride: 2,
                matchDurationMinutesOverride: 20,
                breakDurationMinutesOverride: 1,
              },
            ],
          },
        },
        include: { squads: true },
      });
      const squad7v7 = event.squads.find((s) => s.name === "7v7 Squad")!;
      const squad9v9 = event.squads.find((s) => s.name === "9v9 Squad")!;

      // 7v7 squad's real window: 10:00-10:35 (2x17+1 break).
      await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad7v7.id,
          opponentName: "Opponent A",
          startsAt: new Date("2026-07-01T10:00:00Z"),
          organisationId: fixture.organisationId,
        },
      });
      // 9v9 match starts at 10:30 -- inside the 7v7 squad's real 10:00-10:35 window.
      const match9v9 = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad9v9.id,
          opponentName: "Opponent B",
          startsAt: new Date("2026-07-01T10:30:00Z"),
          organisationId: fixture.organisationId,
        },
      });

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squad7v7.id, playerId);

      const candidates = await getSupportCandidatesForMatchAction(match9v9.id);
      const candidate = candidates.find((c) => c.playerId === playerId);

      expect(candidate?.available).toBe(false);
      expect(candidate?.unavailableReason).toBe("Own squad has overlapping match");
    });
  });
});