import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getFixturesOverview } from "../service";

const testOrgFilter = (organisationId: string): OrgFilterMode => ({
  type: "org",
  filter: { organisationId },
  filterNullable: { organisationId },
  organisationId,
});

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
      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));
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
      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));
      const match = overview.periods[0].rounds[0].matches[0];
      expect(match.teamId).toBeDefined();
      expect(match.teamName).toBeDefined();
      expect(typeof match.blockerCount).toBe("number");
      expect(typeof match.decisionRequiredCount).toBe("number");
      expect(typeof match.selectedPlayerCount).toBe("number");
    });

    it("reports blockerCount and decisionRequiredCount from live plan integrity", async () => {
      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));
      const round = overview.periods[0].rounds[0];

      expect(typeof round.blockerCount).toBe("number");
      expect(typeof round.decisionRequiredCount).toBe("number");
      expect(round.readinessState).toBeDefined();

      for (const match of round.matches) {
        expect(typeof match.blockerCount).toBe("number");
        expect(typeof match.decisionRequiredCount).toBe("number");
      }
    });

    it("computes readiness from live plan integrity signals", async () => {
      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));

      for (const period of overview.periods) {
        for (const round of period.rounds) {
          if (round.blockerCount > 0) {
            expect(round.readinessState).toBe("NOT_PLAYABLE");
          } else if (round.decisionRequiredCount > 0) {
            expect(round.readinessState).toBe("AT_RISK");
          } else {
            expect(round.readinessState).toBe("READY");
          }

          for (const match of round.matches) {
            if (match.blockerCount > 0) {
              expect(match.readinessState).toBe("NOT_PLAYABLE");
            } else if (match.decisionRequiredCount > 0) {
              expect(match.readinessState).toBe("AT_RISK");
            } else {
              expect(match.readinessState).toBe("READY");
            }
          }
        }
      }
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
          organisationId: fixture.organisationId,
        },
      });

      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.selectedPlayerCount).toBeGreaterThanOrEqual(1);
    });

    it("reports post-match status for matches with reports", async () => {
      const matchId = Object.values(fixture.matches)[0];

      await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "LOCKED",
          organisationId: fixture.organisationId,
        },
      });

      const overview = await getFixturesOverview(testOrgFilter(fixture.organisationId));
      const match = overview.periods[0].rounds[0].matches.find((m) => m.id === matchId);
      expect(match?.postMatchStatus).toBe("LOCKED");
    });
  });
});