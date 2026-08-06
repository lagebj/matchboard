import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getPlayerAssignmentBoard, movePlayerToTeam } from "../service";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

const unscopedFilter: OrgFilterMode = { type: "unscoped", filter: {}, filterNullable: {} };

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("@/domain/assistant-manager/service", () => ({
  recordDecision: vi.fn().mockResolvedValue({ id: "decision-1" }),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("Player Assignment Service", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getPlayerAssignmentBoard", () => {
    it("returns teams with their core players", async () => {
      const board = await getPlayerAssignmentBoard(unscopedFilter);
      expect(board.teams.length).toBeGreaterThanOrEqual(3);

      const blaTeam = board.teams.find((t) => t.teamId === fixture.teams["Bla"]);
      expect(blaTeam).toBeDefined();
      expect(blaTeam!.name).toBe("Bla");
      expect(blaTeam!.players.length).toBe(12);
    });

    it("includes player display names and rotatable flag", async () => {
      const board = await getPlayerAssignmentBoard(unscopedFilter);
      const firstPlayer = board.teams[0].players[0];
      expect(firstPlayer.playerId).toBeDefined();
      expect(firstPlayer.displayName).toBeTruthy();
      expect(typeof firstPlayer.rotatable).toBe("boolean");
    });

    it("does not include openIssueCount on player objects", async () => {
      const board = await getPlayerAssignmentBoard(unscopedFilter);
      const firstPlayer = board.teams[0].players[0];
      expect(firstPlayer).not.toHaveProperty("openIssueCount");
    });

    it("excludes archived teams", async () => {
      const teamId = fixture.teams["Bla"];
      await testDb.team.update({ where: { id: teamId }, data: { archivedAt: new Date() } });

      const board = await getPlayerAssignmentBoard(unscopedFilter);
      const blaTeam = board.teams.find((t) => t.teamId === teamId);
      expect(blaTeam).toBeUndefined();
    });
  });

  describe("movePlayerToTeam", () => {
    it("moves a player to a new team", async () => {
      const playerId = fixture.players[0].id;
      const targetTeamId = fixture.teams["Hvit"];

      const result = await movePlayerToTeam({
        playerId,
        targetTeamId,
        reason: "Reassigning for balance",
      });

      expect(result.teamId).toBe(targetTeamId);
      expect(result.coreGroup).toBe("Hvit");

      const dbPlayer = await testDb.player.findUniqueOrThrow({ where: { id: playerId } });
      expect(dbPlayer.coreTeamId).toBe(targetTeamId);
    });

    it("records a decision", async () => {
      const { recordDecision } = await import("@/domain/assistant-manager/service");
      const playerId = fixture.players[2].id;
      const targetTeamId = fixture.teams["Rod"];

      await movePlayerToTeam({
        playerId,
        targetTeamId,
        reason: "Coach decision",
        organisationId: "test-org",
      });

      expect(recordDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionType: "PLAYER_ASSIGNMENT",
          action: "MOVE_PLAYER_TO_TEAM",
          entityId: playerId,
        }),
      );
    });

    it("throws for nonexistent player", async () => {
      await expect(
        movePlayerToTeam({ playerId: "nonexistent", targetTeamId: "some-team" }),
      ).rejects.toThrow();
    });
  });
});