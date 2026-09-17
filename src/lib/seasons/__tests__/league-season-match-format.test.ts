import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { updateLeagueSeasonMatchFormat } from "../league-season-match-format";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

// ADR-0146: existing/legacy League seasons stay unconfigured (null) until a coach explicitly
// configures a format here — never a guessed default (bundle §06.3).
describe("updateLeagueSeasonMatchFormat", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("the seeded fixture season starts unconfigured", async () => {
    const season = await testDb.leagueSeason.findUnique({ where: { id: fixture.leagueSeasonId } });
    expect(season?.defaultNumberOfPeriods).toBeNull();
    expect(season?.defaultPeriodDurationMinutes).toBeNull();
    expect(season?.defaultBreakDurationMinutes).toBeNull();
  });

  it("configures a previously-unconfigured season", async () => {
    const result = await updateLeagueSeasonMatchFormat(fixture.leagueSeasonId, fixture.organisationId, {
      numberOfPeriods: 2,
      periodDurationMinutes: 25,
      breakDurationMinutes: 10,
    });
    expect(result.success).toBe(true);

    const season = await testDb.leagueSeason.findUnique({ where: { id: fixture.leagueSeasonId } });
    expect(season?.defaultNumberOfPeriods).toBe(2);
    expect(season?.defaultPeriodDurationMinutes).toBe(25);
    expect(season?.defaultBreakDurationMinutes).toBe(10);
  });

  it("replaces a previously-configured format", async () => {
    await updateLeagueSeasonMatchFormat(fixture.leagueSeasonId, fixture.organisationId, {
      numberOfPeriods: 1,
      periodDurationMinutes: 40,
      breakDurationMinutes: 0,
    });
    const season = await testDb.leagueSeason.findUnique({ where: { id: fixture.leagueSeasonId } });
    expect(season?.defaultNumberOfPeriods).toBe(1);
    expect(season?.defaultPeriodDurationMinutes).toBe(40);
  });

  it("rejects an invalid format and leaves the stored value unchanged", async () => {
    await updateLeagueSeasonMatchFormat(fixture.leagueSeasonId, fixture.organisationId, {
      numberOfPeriods: 2,
      periodDurationMinutes: 25,
      breakDurationMinutes: 10,
    });
    const result = await updateLeagueSeasonMatchFormat(fixture.leagueSeasonId, fixture.organisationId, {
      numberOfPeriods: 2,
      periodDurationMinutes: 999,
      breakDurationMinutes: 10,
    });
    expect(result.success).toBe(false);

    const season = await testDb.leagueSeason.findUnique({ where: { id: fixture.leagueSeasonId } });
    expect(season?.defaultPeriodDurationMinutes).toBe(25);
  });

  it("returns an error for a season outside the caller's organisation", async () => {
    const otherOrg = await testDb.organisation.create({ data: { name: "Other org", slug: `other-org-${Date.now()}` } });
    const result = await updateLeagueSeasonMatchFormat(fixture.leagueSeasonId, otherOrg.id, {
      numberOfPeriods: 2,
      periodDurationMinutes: 25,
      breakDurationMinutes: 10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not found");
    }
  });
});
