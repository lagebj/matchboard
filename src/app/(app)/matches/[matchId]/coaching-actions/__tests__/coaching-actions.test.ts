import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
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

import { setCoachingIntentAction, removeCoachingIntentAction, getCoachingIntentsAction } from "../actions";
import { setMatchdayResponsibilityAction, removeMatchdayResponsibilityAction } from "../responsibility-actions";
import { createMatchFeedbackAction, updateMatchFeedbackAction, deleteMatchFeedbackAction } from "../../post-match/feedback-actions";

async function cleanup() {
  await testDb.matchExecutionFeedback.deleteMany();
  await testDb.coachingIntent.deleteMany();
  await testDb.selection.deleteMany();
}

describe("Coaching Intent Actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
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
      const result = await setCoachingIntentAction("PLANNING_PERIOD", fixture.planningPeriodId, "CONFIDENCE_REBUILD", null);
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
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {}, matchdayResponsibility: "CONNECTOR" },
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
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {} },
      });

      const result = await setMatchdayResponsibilityAction(selection.id, "INVALID_ROLE");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid matchday responsibility");
    });

    it("rejects modification of finalized selection", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[3]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "FINALIZED", explanation: {} },
      });

      const result = await setMatchdayResponsibilityAction(selection.id, "STABILIZER");
      expect(result.success).toBe(false);
      expect(result.error).toContain("finalized");
    });
  });

  describe("removeMatchdayResponsibilityAction", () => {
    it("removes responsibility by passing null", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[4]!.id;
      const selection = await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status: "DRAFT", explanation: {}, matchdayResponsibility: "WIDTH_HOLDER" },
      });

      const result = await removeMatchdayResponsibilityAction(selection.id);
      expect(result.success).toBe(true);
    });
  });
});

describe("Match Execution Feedback Actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await testDb.matchExecutionFeedback.deleteMany();
    await testDb.selection.deleteMany();
    await teardownTestDb();
  });

  describe("createMatchFeedbackAction", () => {
    it("creates feedback for a player in a match", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[0].id;

      const result = await createMatchFeedbackAction(matchId, playerId, "EFFORT", "POSITIVE", "Helped teammate after ball loss", "MONITOR", null);
      expect(result.success).toBe(true);
    });

    it("rejects invalid category", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[1]!.id;

      const result = await createMatchFeedbackAction(matchId, playerId, "INVALID_CAT", "POSITIVE", null, null, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid feedback category");
    });

    it("rejects disallowed language", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[2]!.id;

      const result = await createMatchFeedbackAction(matchId, playerId, "EFFORT", "NEEDS_ATTENTION", "The player was lazy today", null, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("disallowed language");
    });

    it("rejects duplicate feedback for same player/category/match", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[3]!.id;

      await createMatchFeedbackAction(matchId, playerId, "TEAM_HELP", "POSITIVE", null, null, null);
      const result = await createMatchFeedbackAction(matchId, playerId, "TEAM_HELP", "NEUTRAL", null, null, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("updateMatchFeedbackAction", () => {
    it("updates existing feedback", async () => {
      const matchId = Object.values(fixture.matches)[1]
        ? Object.values(fixture.matches)[1]!
        : Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[4]!.id;

      const created = await createMatchFeedbackAction(matchId, playerId, "RESET_AFTER_MISTAKE", "NEUTRAL", "Recovered quickly", null, null);
      expect(created.success).toBe(true);

      const feedback = await testDb.matchExecutionFeedback.findFirst({
        where: { matchId, playerId, category: "RESET_AFTER_MISTAKE" },
      });
      expect(feedback).not.toBeNull();

      const result = await updateMatchFeedbackAction(feedback!.id, { value: "POSITIVE" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteMatchFeedbackAction", () => {
    it("deletes feedback", async () => {
      const matchId = Object.values(fixture.matches)[0]!;
      const playerId = fixture.players[5]?.id ?? fixture.players[0].id;

      await createMatchFeedbackAction(matchId, playerId, "POSITIONAL_DISCIPLINE", "POSITIVE", null, null, null);
      const feedback = await testDb.matchExecutionFeedback.findFirst({
        where: { matchId, playerId, category: "POSITIONAL_DISCIPLINE" },
      });
      expect(feedback).not.toBeNull();

      const result = await deleteMatchFeedbackAction(feedback!.id);
      expect(result.success).toBe(true);

      const deleted = await testDb.matchExecutionFeedback.findUnique({ where: { id: feedback!.id } });
      expect(deleted).toBeNull();
    });

    it("returns error for nonexistent feedback", async () => {
      const result = await deleteMatchFeedbackAction("nonexistent-id");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});