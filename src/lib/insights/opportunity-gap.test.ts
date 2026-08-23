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

import { getOpportunityGap } from "./opportunity-gap";

describe("getOpportunityGap (I-003)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns a zeroed row for a player with no finalized selections", async () => {
    const rows = await getOpportunityGap({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    expect(rows.length).toBeGreaterThan(0);
    const row = rows.find((r) => r.playerId === fixture.players[0]!.id);
    expect(row).toBeDefined();
    expect(row!.plannedOpportunities).toBe(0);
    expect(row!.gap).toBe(0);
  });

  it("counts a realised opportunity when a PRESENT actual exists for a finalized selection", async () => {
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
      },
    });

    const rows = await getOpportunityGap({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });
    const row = rows.find((r) => r.playerId === player.id)!;
    expect(row.plannedOpportunities).toBe(1);
    expect(row.realisedOpportunities).toBe(1);
    expect(row.gap).toBe(0);
  });
});
