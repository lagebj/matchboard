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

import { getPositionExposure } from "./position-exposure";

describe("getPositionExposure (I-004)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("excludes players with zero finalized selections in the period", async () => {
    const rows = await getPositionExposure({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });
    expect(rows).toEqual([]);
  });

  it("does not count an unused lineup assignment as realised exposure", async () => {
    const player = fixture.players[0]!;
    const teamId = player.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    if (!match) throw new Error("no match in fixture");

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

    const rows = await getPositionExposure({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const row = rows.find((r) => r.playerId === player.id)!;
    expect(row.sampleSize).toBe(1);
    expect(row.plannedPositions).toEqual({});
    expect(row.realisedPositions).toEqual({});
    expect(row.evidenceCompleteness).toBe(0);
  });

  it("counts a recorded actualPositions entry as realised exposure evidence", async () => {
    const player = fixture.players[1]!;
    const teamId = player.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    if (!match) throw new Error("no match in fixture");

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
    const report = await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: match.id, status: "LOCKED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: match.id,
        playerId: player.id,
        reportId: report.id,
        attendanceStatus: "PRESENT",
        source: "PLANNED",
        actualPositions: ["CENTRE_MIDFIELD"],
      },
    });

    const rows = await getPositionExposure({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const row = rows.find((r) => r.playerId === player.id)!;
    expect(row.realisedPositions).toEqual({ CENTRE_MIDFIELD: 1 });
    expect(row.evidenceCompleteness).toBe(1);
  });
});
