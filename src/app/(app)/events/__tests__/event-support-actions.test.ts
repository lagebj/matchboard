import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient, EventPlayerStatus } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "coach@test.com" }),
}));

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
} from "../event-support-actions";
import { updateEventMatchDurationAction } from "../actions";

async function createEventWithMatches(testDb: PrismaClient, options?: { matchDurationMinutes?: number; matchDates?: Date[] }) {
  const matchDurationMinutes = options?.matchDurationMinutes ?? 25;

  const event = await testDb.event.create({
    data: {
      name: "Support Test Event",
      eventType: "CUP",
      startsAt: new Date("2026-07-01T10:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      matchDurationMinutes,
      squads: {
        create: [
          { name: "Red Squad", intent: "BALANCED", targetSize: 7, generationOrder: 0 },
          { name: "Blue Squad", intent: "BALANCED", targetSize: 7, generationOrder: 1 },
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
    data: { eventId, playerId, status: availabilityStatus },
  });
  await testDb.eventSquadPlayer.create({
    data: {
      eventSquadId: squadId,
      playerId,
      source: "MANUAL",
      locked: false,
      selectionReason: "Test assignment",
    },
  });
}

describe("Event support actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
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
        plannedRole: "Defender cover",
        note: "Covering defense",
      });

      expect(assignment).toBeDefined();
      expect(assignment.playerId).toBe(playerId);
      expect(assignment.sourceEventSquadId).toBe(squads[1]!.id);
      expect(assignment.targetEventSquadId).toBe(squads[0]!.id);
      expect(assignment.plannedRole).toBe("Defender cover");
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
          squads: {
            create: [
              { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0 },
              { name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1 },
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
        data: { eventId: event.id, playerId, status: "AVAILABLE" },
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
      ).rejects.toThrow("not eligible");
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
      ).rejects.toThrow("not eligible");
    });

    it("rejects support assignment with invalid planned role", async () => {
      const { event, squads, match1 } = await createEventWithMatches(testDb);

      const playerId = fixture.players[0]!.id;
      await addPlayerToEventAndSquad(testDb, event.id, squads[1]!.id, playerId);

      await expect(
        addEventMatchSupportAssignmentAction({
          eventMatchId: match1.id,
          playerId,
          plannedRole: "Invalid Role",
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
        plannedRole: "Defender cover",
      });

      const updated = await updateEventMatchSupportAssignmentAction({
        assignmentId: assignment.id,
        plannedRole: "Midfield cover",
        note: "Updated role",
      });

      expect(updated.plannedRole).toBe("Midfield cover");
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
          plannedRole: "Invalid Role",
        }),
      ).rejects.toThrow("Invalid planned role");
    });

    it("throws when assignment does not exist", async () => {
      await expect(
        updateEventMatchSupportAssignmentAction({
          assignmentId: "nonexistent-id",
          plannedRole: "General cover",
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
        plannedRole: "General cover",
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
        plannedRole: "General cover",
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
          squads: {
            create: [
              { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0 },
              { name: "Squad B", intent: "BALANCED", targetSize: 7, generationOrder: 1 },
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
          },
          {
            eventMatchId: match2.id,
            playerId,
            sourceEventSquadId: squads[1]!.id,
            targetEventSquadId: squads[0]!.id,
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
          squads: {
            create: { name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0 },
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
});