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

import { getContinuityReview } from "./continuity-review";

describe("getContinuityReview (I-006)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("treats every player in a team's first round as new (no prior round to compare)", async () => {
    const teamId = fixture.players[0]!.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    if (!match) throw new Error("no match in fixture");

    const teamPlayers = fixture.players.filter((p) => p.coreTeamId === teamId);
    for (const player of teamPlayers) {
      await testDb.selection.create({
        data: {
          organisationId: fixture.organisationId,
          matchId: match.id,
          matchRoundId: fixture.matchRoundId,
          playerId: player.id,
          role: "CORE",
          status: "FINALIZED",
        },
      });
    }

    const rows = await getContinuityReview({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const teamRow = rows.find((r) => r.teamId === teamId);
    expect(teamRow).toBeDefined();
    expect(teamRow!.previousMatchRoundId).toBeNull();
    expect(teamRow!.retainedFormation).toBeNull();
    expect(teamRow!.newPlayerCount).toBe(teamPlayers.length);
    expect(teamRow!.retainedStarterCount).toBe(0);
  });
});
