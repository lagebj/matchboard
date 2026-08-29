import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, createTestGroup, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

function orgFilter(organisationId: string) {
  return {
    type: "org" as const,
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

describe("league-round-guest-participant (ADR-0106)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.leagueMatchGuestAssignment.deleteMany({});
    await testDb.leagueRoundParticipant.deleteMany({});
    await testDb.guestPlayer.deleteMany({});
  });

  describe("assertGuestPlayerBelongsToRoundGroup", () => {
    it("passes for a guest player belonging to the round's own group", async () => {
      const { assertGuestPlayerBelongsToRoundGroup } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Oliver Hansen", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      await expect(
        assertGuestPlayerBelongsToRoundGroup(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId)),
      ).resolves.toBeUndefined();
    });

    it("rejects a guest player from a different group", async () => {
      const { assertGuestPlayerBelongsToRoundGroup } = await import("@/lib/matches/league-round-guest-participant");
      const otherGroupId = await createTestGroup(testDb, fixture.organisationId);
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Other Group Guest", organisationId: fixture.organisationId, footballGroupId: otherGroupId },
      });
      await expect(
        assertGuestPlayerBelongsToRoundGroup(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId)),
      ).rejects.toThrow("does not belong to this Round's Group");
    });

    it("rejects an inactive guest player", async () => {
      const { assertGuestPlayerBelongsToRoundGroup } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Inactive Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId, active: false, deactivatedAt: new Date() },
      });
      await expect(
        assertGuestPlayerBelongsToRoundGroup(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId)),
      ).rejects.toThrow("inactive");
    });
  });

  describe("registerGuestPlayerForRound / unregisterGuestPlayerFromRound", () => {
    it("registers a guest player for a round", async () => {
      const { registerGuestPlayerForRound, getRoundGuestParticipants } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Noah Berg", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      const result = await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));
      expect(result.success).toBe(true);

      const participants = await getRoundGuestParticipants(fixture.matchRoundId, orgFilter(fixture.organisationId));
      expect(participants.map((p) => p.guestPlayerId)).toContain(guestPlayer.id);
    });

    it("registering the same guest player twice does not duplicate (upsert)", async () => {
      const { registerGuestPlayerForRound, getRoundGuestParticipants } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Emil Larsen", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));
      await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));

      const participants = await getRoundGuestParticipants(fixture.matchRoundId, orgFilter(fixture.organisationId));
      expect(participants.filter((p) => p.guestPlayerId === guestPlayer.id).length).toBe(1);
    });

    it("rejects registering a guest player from a different group", async () => {
      const { registerGuestPlayerForRound } = await import("@/lib/matches/league-round-guest-participant");
      const otherGroupId = await createTestGroup(testDb, fixture.organisationId);
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Other Group Guest", organisationId: fixture.organisationId, footballGroupId: otherGroupId },
      });
      await expect(
        registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId)),
      ).rejects.toThrow();
    });

    it("unregisters a guest player with no match assignment", async () => {
      const { registerGuestPlayerForRound, unregisterGuestPlayerFromRound, getRoundGuestParticipants } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Unassigned Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));

      const result = await unregisterGuestPlayerFromRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));
      expect(result.success).toBe(true);

      const participants = await getRoundGuestParticipants(fixture.matchRoundId, orgFilter(fixture.organisationId));
      expect(participants.map((p) => p.guestPlayerId)).not.toContain(guestPlayer.id);
    });

    it("refuses to unregister a guest player already assigned to a match in the round", async () => {
      const { registerGuestPlayerForRound, unregisterGuestPlayerFromRound } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Assigned Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));
      await testDb.leagueMatchGuestAssignment.create({
        data: {
          matchId: fixture.matches.Bla!,
          matchRoundId: fixture.matchRoundId,
          guestPlayerId: guestPlayer.id,
          organisationId: fixture.organisationId,
        },
      });

      const result = await unregisterGuestPlayerFromRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));
      expect(result.success).toBe(false);
    });
  });

  describe("getAvailableGuestPlayersForRound", () => {
    it("excludes already-registered guest players and guests from other groups", async () => {
      const { registerGuestPlayerForRound, getAvailableGuestPlayersForRound } = await import("@/lib/matches/league-round-guest-participant");
      const registered = await testDb.guestPlayer.create({
        data: { name: "Registered Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      const unregistered = await testDb.guestPlayer.create({
        data: { name: "Unregistered Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      const otherGroupId = await createTestGroup(testDb, fixture.organisationId);
      const otherGroupGuest = await testDb.guestPlayer.create({
        data: { name: "Other Group Guest", organisationId: fixture.organisationId, footballGroupId: otherGroupId },
      });
      await registerGuestPlayerForRound(fixture.matchRoundId, registered.id, orgFilter(fixture.organisationId));

      const available = await getAvailableGuestPlayersForRound(fixture.matchRoundId, orgFilter(fixture.organisationId));
      const ids = available.map((g) => g.guestPlayerId);
      expect(ids).toContain(unregistered.id);
      expect(ids).not.toContain(registered.id);
      expect(ids).not.toContain(otherGroupGuest.id);
    });
  });

  describe("assertGuestPlayerRegisteredForMatchRound", () => {
    it("passes for a guest player registered for the match's round", async () => {
      const { registerGuestPlayerForRound, assertGuestPlayerRegisteredForMatchRound } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Registered Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });
      await registerGuestPlayerForRound(fixture.matchRoundId, guestPlayer.id, orgFilter(fixture.organisationId));

      const result = await assertGuestPlayerRegisteredForMatchRound(fixture.matches.Bla!, guestPlayer.id, orgFilter(fixture.organisationId));
      expect(result.matchRoundId).toBe(fixture.matchRoundId);
    });

    it("rejects a guest player not registered for the match's round", async () => {
      const { assertGuestPlayerRegisteredForMatchRound } = await import("@/lib/matches/league-round-guest-participant");
      const guestPlayer = await testDb.guestPlayer.create({
        data: { name: "Unregistered Guest", organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId },
      });

      await expect(
        assertGuestPlayerRegisteredForMatchRound(fixture.matches.Bla!, guestPlayer.id, orgFilter(fixture.organisationId)),
      ).rejects.toThrow("not registered as a participant");
    });
  });
});
