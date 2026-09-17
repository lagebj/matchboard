import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

// ADR-0146: newly created League seasons require a complete default match format (bundle §02.3);
// existing/legacy seasons are untouched by this (see league-season-match-format.test.ts).
describe("createLeagueSeason — required match format", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates a season with a valid match format", async () => {
    const { createLeagueSeason } = await import("../create-league-season");
    const result = await createLeagueSeason(fixture.organisationId, {
      year: 2031,
      part: "SPRING",
      matchFormat: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    expect(result.success).toBe(true);

    const season = await testDb.leagueSeason.findUnique({ where: { id: result.leagueSeasonId! } });
    expect(season?.defaultNumberOfPeriods).toBe(2);
    expect(season?.defaultPeriodDurationMinutes).toBe(25);
    expect(season?.defaultBreakDurationMinutes).toBe(10);
  });

  it("rejects an invalid match format (e.g. numberOfPeriods=3, not representable by the live clock today)", async () => {
    const { createLeagueSeason } = await import("../create-league-season");
    const result = await createLeagueSeason(fixture.organisationId, {
      year: 2032,
      part: "SPRING",
      matchFormat: { numberOfPeriods: 3, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid match format");
  });

  it("rejects an out-of-range period duration", async () => {
    const { createLeagueSeason } = await import("../create-league-season");
    const result = await createLeagueSeason(fixture.organisationId, {
      year: 2033,
      part: "SPRING",
      matchFormat: { numberOfPeriods: 2, periodDurationMinutes: 0, breakDurationMinutes: 10 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid match format");
  });
});
