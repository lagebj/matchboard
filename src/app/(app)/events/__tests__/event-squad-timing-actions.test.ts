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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { updateEventSquadAction, updateEventBreakDurationAction, createEventAction } from "../actions";

async function createBaseEvent(testDb: PrismaClient) {
  return testDb.event.create({
    data: {
      name: "Timing Override Event",
      eventType: "CUP",
      startsAt: new Date("2026-07-01T10:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      matchDurationMinutes: 25,
      numberOfHalves: 1,
      organisationId: fixture.organisationId,
      footballGroupId: fixture.footballGroupId,
      squads: {
        create: [
          { name: "Squad A", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
        ],
      },
    },
    include: { squads: true },
  });
}

describe("Event squad/timing override actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("updateEventSquadAction", () => {
    it("sets numberOfHalvesOverride, matchDurationMinutesOverride, and breakDurationMinutesOverride", async () => {
      const event = await createBaseEvent(testDb);
      const squadId = event.squads[0]!.id;

      const updated = await updateEventSquadAction(squadId, {
        numberOfHalvesOverride: 2,
        matchDurationMinutesOverride: 17,
        breakDurationMinutesOverride: 1,
      });

      expect(updated.numberOfHalvesOverride).toBe(2);
      expect(updated.matchDurationMinutesOverride).toBe(17);
      expect(updated.breakDurationMinutesOverride).toBe(1);
    });

    it("clears an override back to inheriting the Event default when given an empty string", async () => {
      const event = await createBaseEvent(testDb);
      const squadId = event.squads[0]!.id;

      await updateEventSquadAction(squadId, { numberOfHalvesOverride: 2, matchDurationMinutesOverride: 17 });
      const cleared = await updateEventSquadAction(squadId, { numberOfHalvesOverride: "", matchDurationMinutesOverride: "" });

      expect(cleared.numberOfHalvesOverride).toBeNull();
      expect(cleared.matchDurationMinutesOverride).toBeNull();
    });

    it("rejects an invalid numberOfHalvesOverride rather than silently coercing it", async () => {
      const event = await createBaseEvent(testDb);
      const squadId = event.squads[0]!.id;

      await expect(
        updateEventSquadAction(squadId, { numberOfHalvesOverride: 3 }),
      ).rejects.toThrow("Invalid number of halves: 3");
    });

    it("rejects a zero/negative matchDurationMinutesOverride", async () => {
      const event = await createBaseEvent(testDb);
      const squadId = event.squads[0]!.id;

      await expect(
        updateEventSquadAction(squadId, { matchDurationMinutesOverride: 0 }),
      ).rejects.toThrow();
    });

    it("accepts a zero breakDurationMinutesOverride (a real, explicit no-break override)", async () => {
      const event = await createBaseEvent(testDb);
      const squadId = event.squads[0]!.id;

      const updated = await updateEventSquadAction(squadId, { breakDurationMinutesOverride: 0 });
      expect(updated.breakDurationMinutesOverride).toBe(0);
    });
  });

  describe("updateEventBreakDurationAction", () => {
    it("sets the Event-level breakDurationMinutes", async () => {
      const event = await createBaseEvent(testDb);
      const updated = await updateEventBreakDurationAction(event.id, 2);
      expect(updated.breakDurationMinutes).toBe(2);
    });

    it("clears breakDurationMinutes back to null", async () => {
      const event = await createBaseEvent(testDb);
      await updateEventBreakDurationAction(event.id, 2);
      const cleared = await updateEventBreakDurationAction(event.id, null);
      expect(cleared.breakDurationMinutes).toBeNull();
    });
  });

  describe("createEventAction breakDurationMinutes", () => {
    it("persists a positive breakDurationMinutes from form data", async () => {
      const formData = new FormData();
      formData.set("name", "Break Duration Event");
      formData.set("startsAt", "2026-08-01T10:00");
      formData.set("gameFormat", "SEVEN_A_SIDE");
      formData.set("numberOfHalves", "2");
      formData.set("matchDurationMinutes", "20");
      formData.set("breakDurationMinutes", "1");
      formData.set("squadCount", "1");
      formData.set("targetSize", "7");

      await expect(createEventAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      const created = await testDb.event.findFirst({ where: { name: "Break Duration Event" } });
      expect(created?.breakDurationMinutes).toBe(1);
    });
  });
});
