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

import { updatePlayerFieldAction } from "../inline-actions";

describe("Player attribute editing", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("updatePlayerFieldAction — attribute fields", () => {
    it("saves ballControl with a valid rating", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "ballControl", "3");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { ballControl: true } });
      expect(updated.ballControl).toBe(3);
    });

    it("saves decisionMaking with a valid rating", async () => {
      const playerId = fixture.players[1]!.id;
      const result = await updatePlayerFieldAction(playerId, "decisionMaking", "5");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { decisionMaking: true } });
      expect(updated.decisionMaking).toBe(5);
    });

    it("clears an attribute to null when set to empty string", async () => {
      const playerId = fixture.players[0].id;
      await updatePlayerFieldAction(playerId, "ballControl", "4");
      const result = await updatePlayerFieldAction(playerId, "ballControl", "");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { ballControl: true } });
      expect(updated.ballControl).toBeNull();
    });

    it("clears an attribute to null when set to dash", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "passing", "—");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { passing: true } });
      expect(updated.passing).toBeNull();
    });

    it("rejects rating values below 1", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "speed", "0");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { speed: true } });
      expect(updated.speed).toBeNull();
    });

    it("rejects rating values above 5", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "strength", "6");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { strength: true } });
      expect(updated.strength).toBeNull();
    });

    it("rejects non-numeric values", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "effort", "abc");
      expect(result.success).toBe(true);

      const updated = await testDb.player.findUniqueOrThrow({ where: { id: playerId }, select: { effort: true } });
      expect(updated.effort).toBeNull();
    });

    it("rejects unknown field names", async () => {
      const playerId = fixture.players[0].id;
      const result = await updatePlayerFieldAction(playerId, "unknownField", "3");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not editable");
    });

    it("does not affect match stats when editing attributes", async () => {
      const playerId = fixture.players[0].id;
      const beforeGoalCount = await testDb.goal.count({ where: { playerId } });

      await updatePlayerFieldAction(playerId, "concentration", "4");

      const afterGoalCount = await testDb.goal.count({ where: { playerId } });
      expect(afterGoalCount).toBe(beforeGoalCount);
    });

    it("allows editing all 12 attribute fields", async () => {
      const playerId = fixture.players[0].id;
      const fields = [
        "ballControl", "passing", "firstTouch", "oneVOneAttacking",
        "positioning", "oneVOneDefending", "decisionMaking",
        "effort", "teamplay", "concentration",
        "speed", "strength",
      ] as const;

      for (const field of fields) {
        const result = await updatePlayerFieldAction(playerId, field, "3");
        expect(result.success, `Field ${field} should succeed`).toBe(true);
      }

      const updated = await testDb.player.findUniqueOrThrow({
        where: { id: playerId },
        select: {
          ballControl: true, passing: true, firstTouch: true, oneVOneAttacking: true,
          positioning: true, oneVOneDefending: true, decisionMaking: true,
          effort: true, teamplay: true, concentration: true,
          speed: true, strength: true,
        },
      });

      for (const field of fields) {
        expect(updated[field], `Field ${field} should be 3`).toBe(3);
      }
    });

    it("does not require creating a new player to edit attributes", async () => {
      const playerId = fixture.players[0].id;
      const beforeUpdate = await testDb.player.findUniqueOrThrow({
        where: { id: playerId },
        select: { firstName: true, coreTeamId: true, ballControl: true },
      });

      expect(beforeUpdate.firstName).toBeTruthy();
      expect(beforeUpdate.coreTeamId).toBeTruthy();

      await updatePlayerFieldAction(playerId, "ballControl", "2");

      const afterUpdate = await testDb.player.findUniqueOrThrow({
        where: { id: playerId },
        select: { firstName: true, coreTeamId: true, ballControl: true },
      });

      expect(afterUpdate.firstName).toBe(beforeUpdate.firstName);
      expect(afterUpdate.coreTeamId).toBe(beforeUpdate.coreTeamId);
      expect(afterUpdate.ballControl).toBe(2);
    });
  });
});