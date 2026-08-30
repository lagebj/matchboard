import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { createMatchCore } from "../actions";

describe("createMatchCore — league season resolution", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    // Default fixture seeds a SPRING league season spanning 2025-01-06 to 2025-06-30.
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates a match in an existing season whose exact date range covers startsAt", async () => {
    const result = await createMatchCore(
      { organisationId: fixture.organisationId },
      {
        teamId: fixture.teams.Bla!,
        opponentText: "Mid-season FC",
        startsAt: new Date("2025-03-15T15:00:00Z"),
        homeAway: "HOME",
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
      },
    );

    expect(result.matchId).toBeTruthy();
    const round = await testDb.matchRound.findUnique({ where: { id: result.matchRoundId } });
    expect(round?.leagueSeasonId).toBe(fixture.leagueSeasonId);
  });

  it("regression: does not falsely reject (or misassign) a match whose ISO week straddles an existing season's exact boundary", async () => {
    // The fixture's SPRING season ends 2025-06-30. Wed 2025-07-02 falls in the ISO week of
    // Mon 2025-06-30 - Sun 2025-07-06, which OVERLAPS that SPRING season's date range even
    // though 2025-07-02 itself is after the season's exact endDate. A previous version of
    // createMatchCore looked up the covering season by ISO-week overlap (getWeekRange) instead
    // of the match's exact startsAt, so it incorrectly matched the SPRING season here and then
    // failed resolveOrCreateMatchRoundForDate's own exact-date bounds check with
    // DateOutsideLeagueSeasonError -- confirmed live via repeated e2e flakes on PR #389
    // (2026-08-30) once enough distinct league seasons had accumulated on that PR's long-lived
    // Test-slot branch for a random test-match date to actually land in this boundary window.
    const result = await createMatchCore(
      { organisationId: fixture.organisationId },
      {
        teamId: fixture.teams.Bla!,
        opponentText: "Early Fall FC",
        startsAt: new Date("2025-07-02T15:00:00Z"),
        homeAway: "HOME",
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
      },
    );

    expect(result.matchId).toBeTruthy();
    const round = await testDb.matchRound.findUnique({ where: { id: result.matchRoundId } });
    // Must NOT have been assigned to the SPRING season that doesn't actually cover this date --
    // a new FALL 2025 season (created fresh, its range derived directly from startsAt) is
    // guaranteed to cover it by construction.
    expect(round?.leagueSeasonId).not.toBe(fixture.leagueSeasonId);
    const newSeason = await testDb.leagueSeason.findUnique({ where: { id: round!.leagueSeasonId } });
    expect(newSeason?.part).toBe("FALL");
    expect(newSeason!.startDate.getTime()).toBeLessThanOrEqual(new Date("2025-07-02T15:00:00Z").getTime());
    expect(newSeason!.endDate.getTime()).toBeGreaterThanOrEqual(new Date("2025-07-02T15:00:00Z").getTime());
  });
});
