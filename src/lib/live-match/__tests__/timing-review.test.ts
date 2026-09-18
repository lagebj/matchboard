import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestUser } from "@/test/support/factories";
import {
  getMatchTimingReviewItems,
  getOutOfRangeEventCount,
  getTimingSubmissionBlockers,
  reviewMatchPeriodTiming,
} from "../timing-review";

/**
 * ADR-0146 §8/§12/D14/D15 — TEST-PLAN §18-20: correcting a recovered period recomputes derived
 * timing deterministically, an event outside the corrected duration blocks submission without
 * being silently shifted, and confirming without changing the duration still marks it reviewed.
 */

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const MIN = 60 * 1000;

describe("timing-review (ADR-0146)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.matchPeriodTimingResolution.deleteMany({});
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
  });

  async function freshMatchId(): Promise<string> {
    const match = await testDb.match.findFirstOrThrow({ where: { matchRoundId: fixtureIds.matchRoundId }, select: { id: true } });
    return match.id;
  }

  async function recoveredResolution(matchId: string, resolvedMinutes = 40) {
    return testDb.matchPeriodTimingResolution.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId,
        period: "FIRST_HALF",
        rawElapsedMs: 4 * 60 * MIN,
        resolvedDurationMs: resolvedMinutes * MIN,
        resolutionSource: "RECOVERED_BOUNDED",
        reviewStatus: "NEEDS_REVIEW",
      },
    });
  }

  it("getTimingSubmissionBlockers is empty when there is nothing to review", async () => {
    const matchId = await freshMatchId();
    expect(await getTimingSubmissionBlockers({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null })).toEqual([]);
  });

  it("TEST-PLAN §20: a NEEDS_REVIEW period blocks submission; the item is listed for the callout", async () => {
    const matchId = await freshMatchId();
    await recoveredResolution(matchId);

    const items = await getMatchTimingReviewItems({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ period: "FIRST_HALF", reviewStatus: "NEEDS_REVIEW", resolvedDurationMs: 40 * MIN });

    const blockers = await getTimingSubmissionBlockers({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/1 period/i);
  });

  it("TEST-PLAN §18: confirming without changing the duration still marks it reviewed and clears the blocker", async () => {
    const matchId = await freshMatchId();
    await recoveredResolution(matchId);

    const result = await reviewMatchPeriodTiming(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "FIRST_HALF",
      fixtureIds.organisationId,
      "coach@example.com",
    );
    expect(result.success).toBe(true);

    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { matchId, period: "FIRST_HALF" } });
    expect(row.reviewStatus).toBe("REVIEWED");
    expect(row.resolvedDurationMs).toBe(40 * MIN); // unchanged -- confirm, not correct
    expect(row.reviewedBy).toBe("coach@example.com");
    expect(row.reviewedAt).not.toBeNull();

    expect(await getTimingSubmissionBlockers({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null })).toEqual([]);
  });

  it("TEST-PLAN §18: correcting the duration persists the coach-supplied value and marks it reviewed", async () => {
    const matchId = await freshMatchId();
    await recoveredResolution(matchId);

    const result = await reviewMatchPeriodTiming(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "FIRST_HALF",
      fixtureIds.organisationId,
      "coach@example.com",
      34,
    );
    expect(result.success).toBe(true);

    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { matchId, period: "FIRST_HALF" } });
    expect(row.reviewStatus).toBe("REVIEWED");
    expect(row.resolvedDurationMs).toBe(34 * MIN);
    // Diagnostic raw value is retained even after a correction (D8's own "preserve raw
    // recovery diagnostic" — the bundle never says a correction erases the original evidence).
    expect(row.rawElapsedMs).toBe(4 * 60 * MIN);
  });

  it("rejects a non-positive or absurd corrected duration", async () => {
    const matchId = await freshMatchId();
    await recoveredResolution(matchId);
    const ref = { kind: "LEAGUE_MATCH" as const, matchId, leagueSeasonId: null };

    expect((await reviewMatchPeriodTiming(ref, "FIRST_HALF", fixtureIds.organisationId, "coach@example.com", 0)).success).toBe(false);
    expect((await reviewMatchPeriodTiming(ref, "FIRST_HALF", fixtureIds.organisationId, "coach@example.com", -5)).success).toBe(false);
    expect((await reviewMatchPeriodTiming(ref, "FIRST_HALF", fixtureIds.organisationId, "coach@example.com", 500)).success).toBe(false);

    // None of the rejected attempts changed anything.
    const row = await testDb.matchPeriodTimingResolution.findFirstOrThrow({ where: { matchId, period: "FIRST_HALF" } });
    expect(row.reviewStatus).toBe("NEEDS_REVIEW");
    expect(row.resolvedDurationMs).toBe(40 * MIN);
  });

  it("TEST-PLAN §19: an event outside the corrected period duration is preserved, counted, and blocks submission — never auto-shifted or deleted", async () => {
    const matchId = await freshMatchId();
    await recoveredResolution(matchId);
    const user = await createTestUser(testDb);
    const session = await testDb.liveMatchSession.create({
      data: { matchId, coachId: user.id, status: "ENDED", organisationId: fixtureIds.organisationId },
    });
    // A goal recorded at 38 minutes into FIRST_HALF (LiveMatchEvent.period is stored as the
    // MATCH_PERIOD_ORDER *index*, not the enum string -- FIRST_HALF is index 1).
    await testDb.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        period: 1,
        matchSeconds: 38 * MIN,
        organisationId: fixtureIds.organisationId,
      },
    });

    // Correct the period down to 34 minutes -- now the 38-minute goal is out of range.
    await reviewMatchPeriodTiming(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "FIRST_HALF",
      fixtureIds.organisationId,
      "coach@example.com",
      34,
    );

    const ref = { kind: "LEAGUE_MATCH" as const, matchId, leagueSeasonId: null };
    expect(await getOutOfRangeEventCount(ref)).toBe(1);

    const blockers = await getTimingSubmissionBlockers(ref);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/1 recorded event/i);

    // The event itself is untouched -- never auto-shifted or deleted.
    const event = await testDb.liveMatchEvent.findFirstOrThrow({ where: { matchId, eventType: "GOAL_FOR" } });
    expect(event.matchSeconds).toBe(38 * MIN);
  });

  it("TEST-PLAN §18: correcting the duration recomputes downstream player-minute evidence, not just the resolution row itself", async () => {
    const match = await testDb.match.findFirstOrThrow({
      where: { matchRoundId: fixtureIds.matchRoundId },
      select: { id: true, teamId: true },
    });
    const matchId = match.id;
    const player = fixtureIds.players.find((p) => p.coreTeamId === match.teamId)!;

    const formation = await testDb.formation.create({
      data: { name: "Timing Review Test Formation", gameFormat: "ELEVEN_A_SIDE", organisationId: fixtureIds.organisationId },
    });
    const lineup = await testDb.matchLineup.create({
      data: { matchId, teamId: match.teamId, formationId: formation.id, status: "CONFIRMED", organisationId: fixtureIds.organisationId },
    });
    const slot = await testDb.formationSlot.create({
      data: { formationId: formation.id, gridX: 0, gridY: 0, label: "Slot 0", shortLabel: "S0", roleType: "GOALKEEPER", organisationId: fixtureIds.organisationId },
    });
    await testDb.matchLineupAssignment.create({
      data: { matchLineupId: lineup.id, slotId: slot.id, playerId: player.id, organisationId: fixtureIds.organisationId },
    });

    // Starts as a 40-minute recovered/clamped FIRST_HALF (NEEDS_REVIEW).
    await recoveredResolution(matchId, 40);
    const user = await createTestUser(testDb);
    // clockPeriod stays at the abandoned period itself -- finishLiveReporting never advances it
    // to FULL_TIME, so `rebuildActualTimeline` reads FIRST_HALF as the match's last-known period
    // and caps the whole match end exactly at FIRST_HALF's own resolved duration (period offset
    // 0, since it is the first playing period).
    await testDb.liveMatchSession.create({
      data: { matchId, coachId: user.id, status: "ENDED", organisationId: fixtureIds.organisationId, clockPeriod: "FIRST_HALF" },
    });

    const { rebuildActualTimeline } = await import("@/lib/evidence/actual-timeline");
    await rebuildActualTimeline(matchId);
    const beforeCorrection = await testDb.actualPositionInterval.findFirstOrThrow({ where: { matchId, playerId: player.id } });
    expect(beforeCorrection.endedAtMs).toBeLessThanOrEqual(40 * MIN);
    expect(beforeCorrection.endedAtMs).toBeGreaterThan(35 * MIN);

    // Correct FIRST_HALF down to 20 minutes -- `reviewMatchPeriodTiming` must itself trigger the
    // same resolved-timeline recompute `finishLiveReporting` uses, not just persist the new
    // duration on the resolution row and leave player minutes stale.
    const result = await reviewMatchPeriodTiming(
      { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null },
      "FIRST_HALF",
      fixtureIds.organisationId,
      "coach@example.com",
      20,
    );
    expect(result.success).toBe(true);

    const afterCorrection = await testDb.actualPositionInterval.findFirstOrThrow({ where: { matchId, playerId: player.id } });
    expect(afterCorrection.endedAtMs).toBe(20 * MIN);
  });
});
