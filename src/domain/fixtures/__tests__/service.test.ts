import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getFixturesOverview } from "../service";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("Fixtures Service", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getFixturesOverview", () => {
    it("returns periods with rounds and matches from seeded data", async () => {
      const overview = await getFixturesOverview();
      expect(overview.periods.length).toBeGreaterThanOrEqual(1);

      const period = overview.periods[0];
      expect(period.rounds.length).toBeGreaterThanOrEqual(1);

      const round = period.rounds[0];
      expect(round.matches.length).toBeGreaterThanOrEqual(1);
      expect(round.selectionState).toBeDefined();
      expect(round.hasDraftSelections).toBeDefined();
      expect(round.hasMatches).toBe(true);
    });

    it("includes match details", async () => {
      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches[0];
      expect(match.teamId).toBeDefined();
      expect(match.teamName).toBeDefined();
      expect(match.blockerCount).toBe(0);
      expect(match.decisionRequiredCount).toBe(0);
      expect(match.selectedPlayerCount).toBe(0);
    });

    it("aggregates warning counts for rounds and matches", async () => {
      const matchId = Object.values(fixture.matches)[0];
      const roundId = fixture.matchRoundId;

      await testDb.warning.create({
        data: {
          matchRoundId: roundId,
          severity: "WARNING",
          rule: "test_rule",
          message: "Test round warning",
        },
      });

      await testDb.warning.create({
        data: {
          matchRoundId: roundId,
          matchId,
          severity: "REQUIRES_OVERRIDE",
          rule: "test_rule",
          message: "Test match warning",
        },
      });

      const overview = await getFixturesOverview();
      const round = overview.periods[0].rounds.find((r) => r.id === roundId);
      expect(round).toBeDefined();
      expect(round!.blockerCount + round!.decisionRequiredCount).toBeGreaterThanOrEqual(2);

      const match = round!.matches.find((m) => m.id === matchId);
      expect(match).toBeDefined();
      expect(match!.blockerCount + match!.decisionRequiredCount).toBeGreaterThanOrEqual(1);
    });

    it("maps HARD_BLOCK severity to NOT_PLAYABLE readiness", async () => {
      const matchId = Object.values(fixture.matches)[0];

      await testDb.warning.create({
        data: {
          matchRoundId: fixture.matchRoundId,
          matchId,
          severity: "HARD_BLOCK",
          rule: "test_block",
          message: "Hard block",
        },
      });

      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.readinessState).toBe("NOT_PLAYABLE");
    });

    it("maps REQUIRES_OVERRIDE severity to AT_RISK readiness", async () => {
      const matchId = Object.values(fixture.matches)[1] ?? Object.values(fixture.matches)[0];

      await testDb.warning.create({
        data: {
          matchRoundId: fixture.matchRoundId,
          matchId,
          severity: "REQUIRES_OVERRIDE",
          rule: "test_override",
          message: "Override needed",
        },
      });

      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.readinessState).toBe("AT_RISK");
    });

    it("maps WARNING severity to WATCH readiness", async () => {
      const matchId = Object.values(fixture.matches)[2] ?? Object.values(fixture.matches)[0];

      await testDb.warning.create({
        data: {
          matchRoundId: fixture.matchRoundId,
          matchId,
          severity: "WARNING",
          rule: "test_advisory",
          message: "Advisory",
        },
      });

      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.readinessState).toBe("WATCH");
    });

    it("counts draft selections per match", async () => {
      const matchId = Object.values(fixture.matches)[0];
      const player = fixture.players[0];

      await testDb.selection.create({
        data: {
          matchId,
          matchRoundId: fixture.matchRoundId,
          playerId: player.id,
          role: "CORE",
          status: "DRAFT",
        },
      });

      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.selectedPlayerCount).toBeGreaterThanOrEqual(1);
    });

    it("reports post-match status for matches with reports", async () => {
      const matchId = Object.values(fixture.matches)[0];

      await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "LOCKED",
        },
      });

      const overview = await getFixturesOverview();
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.postMatchStatus).toBe("LOCKED");
    });
  });
});