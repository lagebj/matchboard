import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { getOperationalHealth } from "./operational-health";
import { OPERATIONAL_HEALTH_LABELS } from "./operational-health-helpers";

describe("getOperationalHealth (I-007)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns all 9 categories with non-negative counts", async () => {
    const groups = await getOperationalHealth({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    expect(groups).toHaveLength(9);
    for (const group of groups) {
      expect(group.label).toBe(OPERATIONAL_HEALTH_LABELS[group.category]);
      expect(group.count).toBeGreaterThanOrEqual(0);
      expect(group.entries).toHaveLength(group.count);
    }
  });

  it("flags a self-referencing rotation path as invalid", async () => {
    const teamId = Object.values(fixture.teams)[0]!;
    await testDb.rotationPath.create({
      data: {
        organisationId: fixture.organisationId,
        fromTeamId: teamId,
        toTeamId: teamId,
        role: "SUPPORT",
        purpose: "test self-loop",
        active: true,
      },
    });

    const groups = await getOperationalHealth({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const invalidPaths = groups.find((g) => g.category === "invalid_rotation_paths");
    expect(invalidPaths?.count).toBeGreaterThanOrEqual(1);
  });

  it("flags an overdue movement candidate as a stale assignment", async () => {
    const teamIds = Object.values(fixture.teams);
    const path = await testDb.rotationPath.create({
      data: {
        organisationId: fixture.organisationId,
        fromTeamId: teamIds[0]!,
        toTeamId: teamIds[1]!,
        role: "SUPPORT",
        purpose: "test overdue candidate",
        active: true,
      },
    });
    await testDb.movementCandidate.create({
      data: {
        organisationId: fixture.organisationId,
        playerId: fixture.players[0]!.id,
        rotationPathId: path.id,
        role: "SUPPORT",
        status: "ACTIVE",
        reviewBy: new Date("2020-01-01"),
        rationaleCategory: "COACH_JUDGEMENT",
      },
    });

    const groups = await getOperationalHealth({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const staleAssignments = groups.find((g) => g.category === "stale_assignments");
    expect(staleAssignments?.count).toBeGreaterThanOrEqual(1);
  });
});
