import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import { rebuildActualTimeline } from "../actual-timeline";
import { finishLiveReporting } from "@/lib/live-match/finish-live-reporting";

/**
 * ADR-0146 §4/§11 — player minutes must derive from the resolved period timeline, not an
 * unbounded raw running clock: a starter never explicitly subbed off during a period that gets
 * `RECOVERED_BOUNDED` at `finishLiveReporting` must have their `ActualPositionInterval` capped at
 * the *resolved* duration, not left open-ended (the direct mechanism behind "four hours of player
 * minutes from a forgotten clock").
 */

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const MIN = 60 * 1000;

describe("rebuildActualTimeline — resolved period capping (ADR-0146)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.actualPositionInterval.deleteMany({});
    await testDb.matchPeriodTimingResolution.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
  });

  async function buildStartingLineup(matchId: string, teamId: string, playerIds: string[]) {
    const formation = await testDb.formation.create({
      data: { name: "Capping Test Formation", gameFormat: "ELEVEN_A_SIDE", organisationId: fixtureIds.organisationId },
    });
    const lineup = await testDb.matchLineup.create({
      data: { matchId, teamId, formationId: formation.id, status: "CONFIRMED", organisationId: fixtureIds.organisationId },
    });
    for (let i = 0; i < playerIds.length; i++) {
      const slot = await testDb.formationSlot.create({
        data: {
          formationId: formation.id,
          gridX: i,
          gridY: 0,
          label: `Slot ${i}`,
          shortLabel: `S${i}`,
          roleType: i === 0 ? "GOALKEEPER" : "DEFENDER",
          organisationId: fixtureIds.organisationId,
        },
      });
      await testDb.matchLineupAssignment.create({
        data: { matchLineupId: lineup.id, slotId: slot.id, playerId: playerIds[i]!, organisationId: fixtureIds.organisationId },
      });
    }
  }

  it("caps a starter never subbed off during an abandoned, RECOVERED_BOUNDED period at the resolved duration — not unbounded", async () => {
    const match = await testDb.match.findFirstOrThrow({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, teamId: true },
    });
    const players = fixtureIds.players.filter((p) => p.coreTeamId === match.teamId).slice(0, 2);
    await buildStartingLineup(match.id, match.teamId, players.map((p) => p.id));

    const user = await createTestUser(testDb);
    await testDb.liveMatchSession.create({
      data: {
        matchId: match.id,
        coachId: user.id,
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
        clockPeriod: "FIRST_HALF",
        clockRunning: true,
        clockPeriodStartedAt: new Date(Date.now() - 4 * 60 * MIN), // abandoned for 4 hours
        clockElapsedBeforeMs: 0,
        formatNumberOfPeriods: 2,
        formatPeriodDurationMinutes: 30,
        formatBreakDurationMinutes: 5,
      },
    });

    const result = await finishLiveReporting(
      { kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null },
      "MANUAL",
      { organisationId: fixtureIds.organisationId },
    );
    expect(result.activePeriodResolution?.resolutionSource).toBe("RECOVERED_BOUNDED");
    expect(result.activePeriodResolution?.resolvedDurationMs).toBe(40 * MIN); // 30m + max(10m, 25%*30m)

    // finishLiveReporting already calls rebuildActualTimelineForRef -- re-invoke directly too,
    // to assert this function's own behavior independent of the orchestrator around it.
    await rebuildActualTimeline(match.id);

    const intervals = await testDb.actualPositionInterval.findMany({ where: { matchId: match.id } });
    expect(intervals.length).toBeGreaterThan(0);
    for (const interval of intervals) {
      expect(interval.endedAtMs).not.toBeNull();
      // Bounded at the *resolved* (clamped) duration -- not the 4-hour raw elapsed, and not
      // left open-ended (`endedAtMs: null`, the pre-ADR-0146 behavior that let a downstream
      // "still playing" interpretation run to whatever wall-clock instant it was later read at).
      expect(interval.endedAtMs).toBeLessThanOrEqual(40 * MIN);
      expect(interval.endedAtMs).toBeGreaterThan(35 * MIN); // comfortably above the un-clamped ceiling boundary, confirms the cap is the 40m ceiling, not some smaller accident
    }
  });
});
