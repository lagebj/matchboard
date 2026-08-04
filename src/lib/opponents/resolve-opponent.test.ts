import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb, createTestGroup } from "@/test/test-db";
import type { PrismaClient } from "@/generated/prisma/client";
import { resolveOpponentOnReportCompletion, resolveEventOpponentOnReportCompletion } from "@/lib/opponents/resolve-opponent";

let testDb: PrismaClient;
let testOrgId: string;
let testGroupId: string;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  getCurrentCoach: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  isAllowedCoach: vi.fn().mockReturnValue(true),
}));

async function createTestRound(testDb: PrismaClient) {
  const season = await testDb.season.create({
    data: { name: "Test Season 2026", year: 2026 , organisationId: testOrgId, footballGroupId: testGroupId },
  });
  const leagueSeason = await testDb.leagueSeason.create({
    data: {
      name: "Spring 2026",
      part: "SPRING",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-09-30"),
      seasonId: season.id,
      organisationId: testOrgId,
        footballGroupId: testGroupId,
    },
  });
  const round = await testDb.matchRound.create({
    data: {
      name: "W1",
      leagueSeasonId: leagueSeason.id,
      status: "DRAFT",
      organisationId: testOrgId,
    },
  });
  return { season, leagueSeason, round };
}

describe("Opponent resolution on report completion", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    const org = await testDb.organisation.create({
      data: { name: "Test Org", slug: `test-org-resolve-${Date.now()}` },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(testDb, testOrgId);
  });
  afterAll(async () => { await teardownTestDb(); });

  describe("resolveOpponentOnReportCompletion (league match)", () => {
    it("creates a canonical opponent when match has no opponentTeamId", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "Resolution Test Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Brand New Opponent FC",
          opponentTeamId: null,
          startsAt: new Date("2026-08-01T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result = await resolveOpponentOnReportCompletion(match.id);

      expect(result).not.toBeNull();

      const opponent = await testDb.opponentTeam.findUnique({
        where: { id: result! },
      });
      expect(opponent).not.toBeNull();
      expect(opponent!.displayName).toBe("Brand New Opponent FC");
      expect(opponent!.normalizedName).toBe("brand new opponent fc");

      const updatedMatch = await testDb.match.findUnique({
        where: { id: match.id },
        select: { opponentTeamId: true },
      });
      expect(updatedMatch!.opponentTeamId).toBe(result);
    });

    it("reuses existing canonical opponent by normalised name", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "Reuse Test Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const existing = await testDb.opponentTeam.create({
        data: { displayName: "Existing FC", normalizedName: "existing fc" , organisationId: testOrgId, footballGroupId: testGroupId },
      });

      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Existing FC",
          opponentTeamId: null,
          startsAt: new Date("2026-08-02T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result = await resolveOpponentOnReportCompletion(match.id);

      expect(result).toBe(existing.id);

      const updatedMatch = await testDb.match.findUnique({
        where: { id: match.id },
        select: { opponentTeamId: true },
      });
      expect(updatedMatch!.opponentTeamId).toBe(existing.id);
    });

    it("keeps existing opponentTeamId if already set", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "Already Linked Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const existing = await testDb.opponentTeam.create({
        data: { displayName: "Already Linked FC", normalizedName: "already linked fc" , organisationId: testOrgId, footballGroupId: testGroupId },
      });

      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Already Linked FC",
          opponentTeamId: existing.id,
          startsAt: new Date("2026-08-03T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result = await resolveOpponentOnReportCompletion(match.id);

      expect(result).toBe(existing.id);
    });

    it("returns null for nonexistent match", async () => {
      const result = await resolveOpponentOnReportCompletion("nonexistent-match-id");
      expect(result).toBeNull();
    });

    it("returns null when opponent name is empty", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "Empty Opponent Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "   ",
          opponentTeamId: null,
          startsAt: new Date("2026-08-04T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result = await resolveOpponentOnReportCompletion(match.id);
      expect(result).toBeNull();
    });

    it("is idempotent — calling twice produces the same result", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "Idempotent Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Idempotent FC",
          opponentTeamId: null,
          startsAt: new Date("2026-08-05T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result1 = await resolveOpponentOnReportCompletion(match.id);
      const result2 = await resolveOpponentOnReportCompletion(match.id);

      expect(result1).toBe(result2);
    });

    it("uses exact normalised matching — no fuzzy merge", async () => {
      const { round } = await createTestRound(testDb);
      const team = await testDb.team.create({
        data: { name: "No Fuzzy Team", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1 , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const existing = await testDb.opponentTeam.create({
        data: { displayName: "Slemmestad Blå", normalizedName: "slemmestad blå" , organisationId: testOrgId, footballGroupId: testGroupId },
      });

      const match = await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: team.id,
          opponent: "Slemmestad Hvit",
          opponentTeamId: null,
          startsAt: new Date("2026-08-06T10:00:00Z"),
          homeAway: "HOME",
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: testOrgId,
        },
      });

      const result = await resolveOpponentOnReportCompletion(match.id);

      expect(result).not.toBe(existing.id);

      const newOpponent = await testDb.opponentTeam.findUnique({
        where: { id: result! },
      });
      expect(newOpponent!.displayName).toBe("Slemmestad Hvit");
      expect(newOpponent!.normalizedName).toBe("slemmestad hvit");
    });
  });

  describe("resolveEventOpponentOnReportCompletion (event match)", () => {
    it("creates a canonical opponent when event match has no opponentTeamId", async () => {
      const event = await testDb.event.create({
        data: {
          name: "Test Tournament",
          eventType: "TOURNAMENT",
          startsAt: new Date("2026-08-10T09:00:00Z"),
          endsAt: new Date("2026-08-10T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squad = await testDb.eventSquad.create({
        data: {
          eventId: event.id,
          name: "Team A",
          intent: "BALANCED",
          targetSize: 7,
          minSize: 5,
          maxSize: 9,
          status: "DRAFT",
          organisationId: testOrgId,
        },
      });
      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          opponentName: "Event Opponent FC",
          opponentTeamId: null,
          startsAt: new Date("2026-08-10T10:00:00Z"),
          status: "SCHEDULED",
          organisationId: testOrgId,
        },
      });

      const result = await resolveEventOpponentOnReportCompletion(eventMatch.id);

      expect(result).not.toBeNull();

      const opponent = await testDb.opponentTeam.findUnique({
        where: { id: result! },
      });
      expect(opponent!.displayName).toBe("Event Opponent FC");

      const updated = await testDb.eventMatch.findUnique({
        where: { id: eventMatch.id },
        select: { opponentTeamId: true },
      });
      expect(updated!.opponentTeamId).toBe(result);
    });

    it("keeps existing opponentTeamId if already set", async () => {
      const existing = await testDb.opponentTeam.create({
        data: { displayName: "Linked Event FC", normalizedName: "linked event fc" , organisationId: testOrgId, footballGroupId: testGroupId },
      });
      const event = await testDb.event.create({
        data: {
          name: "Test Cup",
          eventType: "CUP",
          startsAt: new Date("2026-08-11T09:00:00Z"),
          endsAt: new Date("2026-08-11T17:00:00Z"),
          gameFormat: "SEVEN_A_SIDE",
          organisationId: testOrgId,
        footballGroupId: testGroupId,
        },
      });
      const squad = await testDb.eventSquad.create({
        data: {
          eventId: event.id,
          name: "Team B",
          intent: "COMPETITIVE",
          targetSize: 7,
          minSize: 5,
          maxSize: 9,
          status: "DRAFT",
          organisationId: testOrgId,
        },
      });
      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId: event.id,
          eventSquadId: squad.id,
          opponentName: "Linked Event FC",
          opponentTeamId: existing.id,
          startsAt: new Date("2026-08-11T10:00:00Z"),
          status: "SCHEDULED",
          organisationId: testOrgId,
        },
      });

      const result = await resolveEventOpponentOnReportCompletion(eventMatch.id);

      expect(result).toBe(existing.id);
    });

    it("returns null for nonexistent event match", async () => {
      const result = await resolveEventOpponentOnReportCompletion("nonexistent-id");
      expect(result).toBeNull();
    });
  });
});