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

import { getOpportunityQuality } from "./opportunity-quality";

describe("getOpportunityQuality (I-002)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns no entries when no finalized selections exist", async () => {
    const entries = await getOpportunityQuality({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });
    expect(entries).toEqual([]);
  });

  it("produces one factual entry per finalized selection, honestly untracked minutes", async () => {
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

    const entries = await getOpportunityQuality({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.playerId).toBe(player.id);
    expect(entries[0]!.isCore).toBe(true);
    expect(entries[0]!.supportBurden).toBe(false);
    expect(entries[0]!.realisedAttendance).toBe("unknown");
    expect(entries[0]!.realisedMinutes).toBeNull();
    expect(entries[0]!.minutesEvidence).toBe("not_tracked");
  });

  it("marks non-CORE role selections as support burden", async () => {
    const teamIds = Object.values(fixture.teams);
    const player = fixture.players.find((p) => p.coreTeamId === teamIds[0]);
    const otherTeamMatch = await testDb.match.findFirst({ where: { teamId: teamIds[1], matchRoundId: fixture.matchRoundId } });
    if (!player || !otherTeamMatch) throw new Error("fixture missing expected data");

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: otherTeamMatch.id,
        matchRoundId: fixture.matchRoundId,
        playerId: player.id,
        role: "SUPPORT",
        status: "FINALIZED",
      },
    });

    const entries = await getOpportunityQuality({
      leagueSeasonId: fixture.leagueSeasonId,
      scope: "full_year",
      context: "league",
    });

    const supportEntry = entries.find((e) => e.playerId === player.id && e.matchId === otherTeamMatch.id);
    expect(supportEntry?.supportBurden).toBe(true);
    expect(supportEntry?.isCore).toBe(false);
  });
});
