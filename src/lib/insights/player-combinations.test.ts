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

import { getPlayerCombinations } from "./player-combinations";

describe("getPlayerCombinations (I-005)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns no pairs when no two players are ever co-selected", async () => {
    const rows = await getPlayerCombinations({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });
    expect(rows).toEqual([]);
  });

  it("counts a co-selection when two players are finalized together in the same match", async () => {
    const teamId = fixture.players[0]!.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    if (!match) throw new Error("no match in fixture");

    const [playerA, playerB] = fixture.players.filter((p) => p.coreTeamId === teamId);
    if (!playerA || !playerB) throw new Error("need at least 2 players on the same team");

    for (const player of [playerA, playerB]) {
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

    const rows = await getPlayerCombinations({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.coSelectionCount).toBe(1);
    expect(rows[0]!.realisedCoAppearanceCount).toBe(0);
    expect([rows[0]!.playerAId, rows[0]!.playerBId].sort()).toEqual([playerA.id, playerB.id].sort());
  });

  it("counts a realised co-appearance only when both are actually PRESENT", async () => {
    const teamId = fixture.players[0]!.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    if (!match) throw new Error("no match in fixture");
    const [playerA, playerB] = fixture.players.filter((p) => p.coreTeamId === teamId);
    if (!playerA || !playerB) throw new Error("need at least 2 players on the same team");

    const report = await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: match.id, status: "LOCKED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: { organisationId: fixture.organisationId, matchId: match.id, playerId: playerA.id, reportId: report.id, attendanceStatus: "PRESENT", source: "PLANNED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: { organisationId: fixture.organisationId, matchId: match.id, playerId: playerB.id, reportId: report.id, attendanceStatus: "NO_SHOW", source: "PLANNED" },
    });

    const rows = await getPlayerCombinations({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    expect(rows[0]!.realisedCoAppearanceCount).toBe(0);
  });
});
