import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext();

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { setCoachingIntentAction, removeCoachingIntentAction, getCoachingIntentsAction } from "../actions";
import { setMatchdayResponsibilityAction, removeMatchdayResponsibilityAction } from "../responsibility-actions";

async function cleanup() {
  await testDb.coachingIntent.deleteMany();
  await testDb.selection.deleteMany();
}

describe("Coaching Intent Actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await cleanup();
    await teardownTestDb();
  });

  describe("setCoachingIntentAction", () => {
    it("creates a coaching intent for a match scope", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const result = await setCoachingIntentAction("MATCH", matchId, "TEAM_FIRST", "Prioritize team function");
      expect(result.success).toBe(true);
    });

    it("creates a coaching intent for a match round scope", async () => {
      const result = await setCoachingIntentAction("MATCH_ROUND", fixture.matchRoundId, "SUPPORT_TEAMMATES", null);
      expect(result.success).toBe(true);
    });

    it("creates a coaching intent for a planning period scope", async () => {
      const result = await setCoachingIntentAction("LEAGUE_SEASON", fixture.leagueSeasonId, "CONFIDENCE_REBUILD", null);
      expect(result.success).toBe(true);
    });

    it("updates an existing intent (upsert)", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      await setCoachingIntentAction("MATCH", matchId, "TEAM_FIRST", null);
      const result = await setCoachingIntentAction("MATCH", matchId, "CHALLENGE_EXPOSURE", "Updated intent");
      expect(result.success).toBe(true);

      const intents = await getCoachingIntentsAction("MATCH", matchId);
      expect(intents.success).toBe(true);
      expect(intents.intents).toHaveLength(1);
      expect(intents.intents![0].category).toBe("CHALLENGE_EXPOSURE");
    });

    it("rejects invalid scope type", async () => {
      const result = await setCoachingIntentAction("INVALID_SCOPE", "some-id", "TEAM_FIRST", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid scope type");
    });

    it("rejects invalid category", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const result = await setCoachingIntentAction("MATCH", matchId, "INVALID_CATEGORY", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid intent category");
    });
  });

  describe("getCoachingIntentsAction", () => {
    it("returns intents for a given scope", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      await setCoachingIntentAction("MATCH", matchId, "POSITIONAL_DISCIPLINE", null);
      const result = await getCoachingIntentsAction("MATCH", matchId);
      expect(result.success).toBe(true);
      expect(result.intents!.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty array when no intents exist", async () => {
      const result = await getCoachingIntentsAction("MATCH", "nonexistent-id");
      expect(result.success).toBe(true);
      expect(result.intents).toHaveLength(0);
    });
  });

  describe("removeCoachingIntentAction", () => {
    it("removes an existing intent", async () => {
      const matchId = Object.values(fixture.matches)[1]
        ? Object.values(fixture.matches)[1]!
        : Object.values(fixture.matches)[0]!;
      const created = await setCoachingIntentAction("MATCH", matchId, "DEFENSIVE_RECOVERY", null);
      expect(created.success).toBe(true);

      const intents = await getCoachingIntentsAction("MATCH", matchId);
      const intentId = intents.intents![0].id;

      const result = await removeCoachingIntentAction(intentId);
      expect(result.success).toBe(true);

      const after = await getCoachingIntentsAction("MATCH", matchId);
      expect(after.intents!.filter((i) => i.id === intentId)).toHaveLength(0);
    });

    it("returns error for nonexistent intent", async () => {
      const result = await removeCoachingIntentAction("nonexistent-id");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Intent not found");
    });
  });
});

describe("Matchday Responsibility Actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await cleanup();
    await teardownTestDb();
  });

  describe("setMatchdayResponsibilityAction", () => {
    it("sets a responsibility on a draft selection", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[0].id;
      const selection = await testDb.selection.create({
        data: {
          matchId,
          matchRoundId: fixture.matchRoundId,
          playerId,
          role: "CORE",
          status: "DRAFT",
          explanation: {},
                  organisationId: fixture.organisationId,
},
      });

      const result = await setMatchdayResponsibilityAction(selection.id, "STABILIZER");
      expect(result.success).toBe(true);

      const updated = await testDb.selection.findUnique({ where: { id: selection.id } });
      expect(updated?.matchdayResponsibility).toBe("STABILIZER");
    });

    it("clears a responsibility when set to null", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[1]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {}, matchdayResponsibility: "CONNECTOR" , organisationId: fixture.organisationId},
      });

      const result = await setMatchdayResponsibilityAction(selection.id, null);
      expect(result.success).toBe(true);

      const updated = await testDb.selection.findUnique({ where: { id: selection.id } });
      expect(updated?.matchdayResponsibility).toBeNull();
    });

    it("rejects invalid responsibility", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[2]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {} , organisationId: fixture.organisationId},
      });

      const result = await setMatchdayResponsibilityAction(selection.id, "INVALID_ROLE");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid matchday responsibility");
    });

    it("rejects modification of finalized selection", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[3]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "FINALIZED", explanation: {} , organisationId: fixture.organisationId},
      });

      const result = await setMatchdayResponsibilityAction(selection.id, "STABILIZER");
      expect(result.success).toBe(false);
      expect(result.error).toContain("finalised");
    });
  });

  describe("removeMatchdayResponsibilityAction", () => {
    it("removes responsibility by passing null", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[4]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {}, matchdayResponsibility: "WIDTH_HOLDER" , organisationId: fixture.organisationId},
      });

      const result = await removeMatchdayResponsibilityAction(selection.id);
      expect(result.success).toBe(true);
    });
  });
});