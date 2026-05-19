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

import { setReadinessSignalAction, deleteReadinessSignalAction, getReadinessSignalsAction } from "../actions";

async function cleanup() {
  await testDb.playerReadinessSignal.deleteMany();
}

describe("Readiness Signal Actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await cleanup();
    await teardownTestDb();
  });

  describe("setReadinessSignalAction", () => {
    it("creates a readiness signal", async () => {
      const playerId = fixture.players[0].id;
      const result = await setReadinessSignalAction(playerId, "EFFORT_TREND", "RISING", null);
      expect(result.success).toBe(true);
    });

    it("upserts an existing signal", async () => {
      const playerId = fixture.players[1]!.id;
      await setReadinessSignalAction(playerId, "COACH_TRUST", "MEDIUM", null);
      const result = await setReadinessSignalAction(playerId, "COACH_TRUST", "HIGH", "Improved trust");
      expect(result.success).toBe(true);

      const signals = await getReadinessSignalsAction(playerId);
      expect(signals.success).toBe(true);
      const trustSignal = signals.signals!.find((s) => s.signalType === "COACH_TRUST");
      expect(trustSignal?.value).toBe("HIGH");
      expect(trustSignal?.note).toBe("Improved trust");
    });

    it("rejects invalid signal type", async () => {
      const playerId = fixture.players[2]!.id;
      const result = await setReadinessSignalAction(playerId, "INVALID_TYPE", "HIGH", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid readiness signal type");
    });

    it("rejects invalid value for signal type", async () => {
      const playerId = fixture.players[3]!.id;
      const result = await setReadinessSignalAction(playerId, "EFFORT_TREND", "HIGH", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid value");
    });

    it("rejects value that does not match signal type", async () => {
      const playerId = fixture.players[4]!.id;
      const result = await setReadinessSignalAction(playerId, "ATTENDANCE_RELIABILITY", "RISING", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid value");
    });

    it("accepts all valid values for each signal type", async () => {
      const playerId = fixture.players[5]?.id ?? fixture.players[0].id;
      const validPairs: Array<[string, string]> = [
        ["EFFORT_TREND", "RISING"],
        ["EFFORT_TREND", "STABLE"],
        ["EFFORT_TREND", "FALLING"],
        ["ATTENDANCE_RELIABILITY", "HIGH"],
        ["ATTENDANCE_RELIABILITY", "MEDIUM"],
        ["ATTENDANCE_RELIABILITY", "LOW"],
        ["LEARNING_BEHAVIOR", "STRONG"],
        ["LEARNING_BEHAVIOR", "OK"],
        ["LEARNING_BEHAVIOR", "NEEDS_ATTENTION"],
      ];

      for (const [signalType, value] of validPairs) {
        const result = await setReadinessSignalAction(playerId, signalType, value, null);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("getReadinessSignalsAction", () => {
    it("returns signals for a player", async () => {
      const playerId = fixture.players[0].id;
      const result = await getReadinessSignalsAction(playerId);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.signals)).toBe(true);
    });

    it("returns empty array for player with no signals", async () => {
      const playerId = fixture.players[2]!.id;
      await cleanup();
      const result = await getReadinessSignalsAction(playerId);
      expect(result.success).toBe(true);
      expect(result.signals).toHaveLength(0);
    });
  });

  describe("deleteReadinessSignalAction", () => {
    it("deletes a signal", async () => {
      const playerId = fixture.players[1]!.id;
      await setReadinessSignalAction(playerId, "TEAM_FIRST_BEHAVIOR", "STRONG", null);
      const result = await deleteReadinessSignalAction(playerId, "TEAM_FIRST_BEHAVIOR");
      expect(result.success).toBe(true);

      const signals = await getReadinessSignalsAction(playerId);
      const deleted = signals.signals!.find((s) => s.signalType === "TEAM_FIRST_BEHAVIOR");
      expect(deleted).toBeUndefined();
    });

    it("returns error for nonexistent signal", async () => {
      const playerId = fixture.players[0].id;
      const result = await deleteReadinessSignalAction(playerId, "COACH_TRUST");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});