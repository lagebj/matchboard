import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getMatchFormatOverrideState, updateMatchFormatOverride } from "../match-format-override";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

/**
 * ADR-0146 (bundle §05.4) — the Match-specific match-format override: highest precedence over
 * Team/LeagueSeason, complete-or-inherit (never partial), and refused once Live Reporting has
 * started for that match (the session's frozen snapshot is then authoritative).
 */
describe("updateMatchFormatOverride / getMatchFormatOverrideState", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("starts with no override and nothing inherited (legacy unconfigured season/team)", async () => {
    const state = await getMatchFormatOverrideState(fixture.matches["Bla"]!, fixture.organisationId);
    expect(state).not.toBeNull();
    expect(state!.matchOverride).toBeNull();
    expect(state!.inheritedFormat).toBeNull();
    expect(state!.effectiveFormat).toBeNull();
    expect(state!.liveReportingStarted).toBe(false);
  });

  it("sets a complete match override and reads it back as effective with MATCH precedence", async () => {
    const result = await updateMatchFormatOverride(fixture.matches["Bla"]!, fixture.organisationId, {
      numberOfPeriods: 2,
      periodDurationMinutes: 30,
      breakDurationMinutes: 8,
    });
    expect(result.success).toBe(true);

    const state = await getMatchFormatOverrideState(fixture.matches["Bla"]!, fixture.organisationId);
    expect(state!.matchOverride).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 8 });
    expect(state!.effectiveFormat).toEqual(state!.matchOverride);
    expect(state!.effectiveSource).toBe("MATCH");
  });

  it("rejects an out-of-bounds format", async () => {
    const result = await updateMatchFormatOverride(fixture.matches["Bla"]!, fixture.organisationId, {
      numberOfPeriods: 2,
      periodDurationMinutes: 300,
      breakDurationMinutes: 8,
    });
    expect(result.success).toBe(false);
  });

  it("clearing the override reverts to inherit", async () => {
    const result = await updateMatchFormatOverride(fixture.matches["Bla"]!, fixture.organisationId, null);
    expect(result.success).toBe(true);

    const state = await getMatchFormatOverrideState(fixture.matches["Bla"]!, fixture.organisationId);
    expect(state!.matchOverride).toBeNull();
    expect(state!.effectiveFormat).toBeNull();
  });

  it("refuses the override once Live Reporting has started — the frozen snapshot is authoritative", async () => {
    const matchId = fixture.matches["Hvit"]!;
    await testDb.liveMatchSession.create({
      data: {
        matchId,
        coachId: "coach-1",
        organisationId: fixture.organisationId,
        status: "ACTIVE",
        formatNumberOfPeriods: 2,
        formatPeriodDurationMinutes: 25,
        formatBreakDurationMinutes: 10,
        formatSource: "SEASON",
        formatSnapshotAt: new Date(),
      },
    });

    try {
      const result = await updateMatchFormatOverride(matchId, fixture.organisationId, {
        numberOfPeriods: 1,
        periodDurationMinutes: 40,
        breakDurationMinutes: 0,
      });
      expect(result.success).toBe(false);
      expect(result.success === false && /frozen/i.test(result.error)).toBe(true);

      const state = await getMatchFormatOverrideState(matchId, fixture.organisationId);
      expect(state!.liveReportingStarted).toBe(true);
      expect(state!.frozenFormat).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 });
    } finally {
      await testDb.liveMatchSession.deleteMany({ where: { matchId } });
    }
  });

  it("denies access for a mismatched organisation", async () => {
    const result = await updateMatchFormatOverride(fixture.matches["Bla"]!, "other-org", {
      numberOfPeriods: 2,
      periodDurationMinutes: 25,
      breakDurationMinutes: 10,
    });
    expect(result.success).toBe(false);
  });
});