import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const authOrgA = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/review/review-service", () => ({
  supersedePendingReviews: vi.fn().mockResolvedValue({ count: 0, superseded: [] }),
}));

vi.mock("@/lib/email/outbox", () => ({
  enqueueAndSendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/security/audit-log", () => ({
  logEventSquadLock: vi.fn().mockResolvedValue(undefined),
  logEventSquadUnlock: vi.fn().mockResolvedValue(undefined),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  addPlayersToEventPoolAction,
  removePlayersFromEventPoolAction,
  assignPlayerToEventSquadAction,
} from "../actions";
import {
  confirmEventSquadsAction,
  unconfirmEventSquadsAction,
} from "../event-squad-commit-actions";
import {
  getEventActiveSessionAction,
  getEventMatchEventsAction,
  getRecentEventEventsAction,
  startEventLiveSessionAction,
} from "../[eventId]/event-live-actions";

describe("Event IDOR security: cross-tenant access denied", () => {
  let orgBEventId: string;
  let orgBEventSquadId: string;
  let orgAPlayerId: string;
  let otherOrgId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    authOrgA.updateOrganisationId(fixture.organisationId);

    orgAPlayerId = fixture.players[0]!.id;

    const otherOrg = await testDb.organisation.create({
      data: { name: "Org B IDOR", slug: "org-b-idor-" + Date.now() },
    });
    otherOrgId = otherOrg.id;

    const otherGroup = await testDb.footballGroup.create({
      data: { name: "Group B IDOR", slug: "group-b-idor-" + Date.now(), organisationId: otherOrg.id },
    });

    const otherEvent = await testDb.event.create({
      data: {
        name: "Org B Event",
        eventType: "CUP",
        startsAt: new Date("2026-09-15"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: otherOrg.id,
        footballGroupId: otherGroup.id,
      },
    });
    orgBEventId = otherEvent.id;

    const otherSquad = await testDb.eventSquad.create({
      data: {
        eventId: otherEvent.id,
        name: "Squad B",
        intent: "BALANCED",
        targetSize: 7,
        generationOrder: 0,
        organisationId: otherOrg.id,
      },
    });
    orgBEventSquadId = otherSquad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("Event CRUD cross-tenant denial", () => {
    it("prevents adding players to another org's event pool", async () => {
      await expect(
        addPlayersToEventPoolAction(orgBEventId, [orgAPlayerId], "AVAILABLE")
      ).rejects.toThrow("not found or access denied");
    });

    it("prevents removing players from another org's event pool", async () => {
      await expect(
        removePlayersFromEventPoolAction(orgBEventId, [orgAPlayerId])
      ).rejects.toThrow("not found or access denied");
    });

    it("prevents assigning a player to a squad in another org's event", async () => {
      await expect(
        assignPlayerToEventSquadAction(orgBEventId, orgBEventSquadId, orgAPlayerId)
      ).rejects.toThrow("not found or access denied");
    });

    it("prevents locking squads in another org's event", async () => {
      await expect(
        confirmEventSquadsAction(orgBEventId)
      ).rejects.toThrow("not found or access denied");
    });

    it("prevents unlocking squads in another org's event", async () => {
      await expect(
        unconfirmEventSquadsAction(orgBEventId)
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("Live session cross-tenant denial", () => {
    it("prevents starting a live session for a match in another org", async () => {
      const otherOrgMatch = await testDb.eventMatch.create({
        data: {
          eventId: orgBEventId,
          eventSquadId: orgBEventSquadId,
          opponentName: "Other Opponent",
          startsAt: new Date("2026-09-15T11:00:00Z"),
          organisationId: otherOrgId,
        },
      });
      const result = await startEventLiveSessionAction(otherOrgMatch.id);
      expect(result.success).toBe(false);
    });

    it("getEventActiveSessionAction denies access to another org's match", async () => {
      const otherOrgMatch = await testDb.eventMatch.create({
        data: {
          eventId: orgBEventId,
          eventSquadId: orgBEventSquadId,
          opponentName: "Other Opponent 2",
          startsAt: new Date("2026-09-15T12:00:00Z"),
          organisationId: otherOrgId,
        },
      });
      const result = await getEventActiveSessionAction(otherOrgMatch.id);
      expect(result.success).toBe(false);
    });

    it("getEventMatchEventsAction denies access to another org's match", async () => {
      const otherOrgMatch = await testDb.eventMatch.create({
        data: {
          eventId: orgBEventId,
          eventSquadId: orgBEventSquadId,
          opponentName: "Other Opponent 3",
          startsAt: new Date("2026-09-15T13:00:00Z"),
          organisationId: otherOrgId,
        },
      });
      const result = await getEventMatchEventsAction(otherOrgMatch.id);
      expect(result.success).toBe(false);
    });

    it("getRecentEventEventsAction denies access to another org's match", async () => {
      const otherOrgMatch = await testDb.eventMatch.create({
        data: {
          eventId: orgBEventId,
          eventSquadId: orgBEventSquadId,
          opponentName: "Other Opponent 4",
          startsAt: new Date("2026-09-15T14:00:00Z"),
          organisationId: otherOrgId,
        },
      });
      const result = await getRecentEventEventsAction(otherOrgMatch.id);
      expect(result.success).toBe(false);
    });
  });
});