import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getTeamConfiguration, updateTeamConfiguration } from "../service";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("Team Configuration Service", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getTeamConfiguration", () => {
    it("returns null for nonexistent team", async () => {
      const config = await getTeamConfiguration("nonexistent-team");
      expect(config).toBeNull();
    });

    it("returns team configuration from seeded data", async () => {
      const teamId = fixture.teams["Bla"];
      const config = await getTeamConfiguration(teamId);
      expect(config).not.toBeNull();
      expect(config!.teamId).toBe(teamId);
      expect(config!.name).toBe("Bla");
      expect(config!.targetSquadSize).toBe(11);
      expect(config!.maxSquadSize).toBe(14);
      expect(config!.supportPriority).toBe(3);
      expect(config!.rules.length).toBeGreaterThanOrEqual(5);
    });

    it("includes active core player count", async () => {
      const teamId = fixture.teams["Bla"];
      const config = await getTeamConfiguration(teamId);
      expect(config!.coreGroup).toContain("active players");
    });

    it("populates support-priority rule with team value", async () => {
      const teamId = fixture.teams["Bla"];
      const config = await getTeamConfiguration(teamId);
      const supportRule = config!.rules.find((r) => r.ruleId === "support-priority");
      expect(supportRule).toBeDefined();
      expect(supportRule!.value).toBe("Priority 3");
      expect(supportRule!.editable).toBe(true);
    });

    it("populates squad-size-cap rule with team value", async () => {
      const teamId = fixture.teams["Bla"];
      const config = await getTeamConfiguration(teamId);
      const squadRule = config!.rules.find((r) => r.ruleId === "squad-size-cap");
      expect(squadRule).toBeDefined();
      expect(squadRule!.value).toBe("Max 14 players");
      expect(squadRule!.editable).toBe(true);
    });

    it("marks global rules as not editable", async () => {
      const teamId = fixture.teams["Bla"];
      const config = await getTeamConfiguration(teamId);
      const globalRules = config!.rules.filter((r) => r.scope === "GLOBAL");
      for (const rule of globalRules) {
        expect(rule.editable).toBe(false);
      }
    });
  });

  describe("updateTeamConfiguration", () => {
    it("updates target squad size", async () => {
      const teamId = fixture.teams["Bla"];
      const result = await updateTeamConfiguration(teamId, { targetSquadSize: 12 });
      expect(result.targetSquadSize).toBe(12);
    });

    it("updates support priority", async () => {
      const teamId = fixture.teams["Hvit"];
      const result = await updateTeamConfiguration(teamId, { supportPriority: 1 });
      expect(result.supportPriority).toBe(1);
    });

    it("rejects target squad size <= 0", async () => {
      const teamId = fixture.teams["Bla"];
      await expect(updateTeamConfiguration(teamId, { targetSquadSize: 0 })).rejects.toThrow(
        "Target squad size must be greater than 0",
      );
    });

    it("rejects max squad size less than target", async () => {
      const teamId = fixture.teams["Bla"];
      await expect(
        updateTeamConfiguration(teamId, { targetSquadSize: 15, maxSquadSize: 10 }),
      ).rejects.toThrow("Max squad size must be >= target squad size");
    });

    it("rejects max squad size less than existing target when target not provided", async () => {
      const teamId = fixture.teams["Rod"];
      await expect(updateTeamConfiguration(teamId, { maxSquadSize: 5 })).rejects.toThrow(
        "Max squad size must be >= target squad size",
      );
    });

    it("archives team when active is set to false", async () => {
      const teamId = fixture.teams["Rod"];
      const result = await updateTeamConfiguration(teamId, { active: false });
      expect(result.active).toBe(false);
    });

    it("allows max squad size equal to target", async () => {
      const teamId = fixture.teams["Hvit"];
      const result = await updateTeamConfiguration(teamId, { targetSquadSize: 11, maxSquadSize: 11 });
      expect(result.targetSquadSize).toBe(11);
      expect(result.maxSquadSize).toBe(11);
    });
  });
});