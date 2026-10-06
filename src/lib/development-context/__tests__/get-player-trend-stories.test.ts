import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getPlayerTrendStories } from "../get-player-trend-stories";
import { recomputePlayerTrends } from "../recompute-player-trends";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

describe("getPlayerTrendStories (ADR-0157 slice C5)", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createMatch(teamId: string, startsAt: Date, opponent: string) {
    return testDb.match.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        teamId,
        opponent,
        startsAt,
        homeAway: "HOME",
        squadSize: 11,
        matchType: "LEAGUE",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixtureIds.organisationId,
      },
    });
  }

  it("returns [] for a player with no development-context measurements at all", async () => {
    const stories = await getPlayerTrendStories("no-such-player");
    expect(stories).toEqual([]);
  });

  it("renders a NOT_ENOUGH_EVIDENCE entry for a group with 1-5 eligible matches, never a fabricated zero/stable trend", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const teamId = fixtureIds.teams["Bla"];

    for (let i = 0; i < 3; i++) {
      const match = await createMatch(teamId, new Date(2025, 2, i + 1), `Pending Opponent ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: 600,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "RW" },
          sourceRefs: [],
          inputRevision: `pending-${i}`,
        },
      });
    }

    const stories = await getPlayerTrendStories(playerId);
    const pending = stories.find((s) => s.kind === "NOT_ENOUGH_EVIDENCE" && s.dimensions.position === "RW");
    expect(pending).toBeDefined();
    if (pending?.kind === "NOT_ENOUGH_EVIDENCE") {
      expect(pending.eligibleSampleCount).toBe(3);
      expect(pending.neededSampleCount).toBe(6);
      expect(pending.headline).toContain("Not enough eligible matches");
      expect(pending.headline).not.toMatch(/\bstable\b/i);
    }
    // No trend row exists yet for this group -- confirms this is the honest "not enough
    // evidence" path, not a side effect of a trend that was somehow already computed.
    expect(stories.some((s) => s.kind === "TREND" && s.dimensions.position === "RW")).toBe(false);
  });

  it("renders a TREND entry straight from the persisted DerivedTrend row once recomputePlayerTrends has run, using the stored direction verbatim", async () => {
    const playerId = fixtureIds.players[1]!.id;
    const teamId = fixtureIds.teams["Hvit"];
    const values = [100, 100, 100, 200, 200, 200]; // previous window 300, latest window 600 -> UP

    for (let i = 0; i < 6; i++) {
      const match = await createMatch(teamId, new Date(2025, 3, i + 1), `Trend Opponent ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "role_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: values[i]!,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { position: "CM" },
          sourceRefs: [],
          inputRevision: `trend-${i}`,
        },
      });
    }

    await recomputePlayerTrends(playerId, fixtureIds.organisationId);

    const stories = await getPlayerTrendStories(playerId);
    const trend = stories.find((s) => s.kind === "TREND" && s.metricKey === "role_seconds" && s.dimensions.position === "CM");
    expect(trend).toBeDefined();
    if (trend?.kind === "TREND") {
      expect(trend.direction).toBe("UP");
      expect(trend.sampleWindow).toEqual({ previousMatches: 3, latestMatches: 3 });
      expect(trend.dimensionLabel).toBe("Central Midfield exposure");
      expect(trend.headline).toContain("increased");
      expect(trend.rateContext).toBeNull(); // role_seconds is a plain exposure sum, not a rate.
    }
  });

  it("describes a teammate co-presence trend as exposure only, never chemistry/partnership language (ADR-0155 §9)", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const teammateId = fixtureIds.players[1]!.id;
    const teamId = fixtureIds.teams["Bla"];
    const values = [100, 100, 100, 200, 200, 200];

    for (let i = 0; i < 6; i++) {
      const match = await createMatch(teamId, new Date(2025, 5, i + 1), `Copresence Opponent ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "teammate_copresence_seconds",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: values[i]!,
          unit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { teammateId },
          sourceRefs: [],
          inputRevision: `copresence-${i}`,
        },
      });
    }

    await recomputePlayerTrends(playerId, fixtureIds.organisationId);
    const stories = await getPlayerTrendStories(playerId);
    const trend = stories.find((s) => s.kind === "TREND" && s.metricKey === "teammate_copresence_seconds");
    expect(trend).toBeDefined();
    if (trend?.kind === "TREND") {
      expect(trend.dimensionLabel).toMatch(/^Shared pitch time with/);
      const lower = trend.headline.toLowerCase();
      expect(lower).not.toContain("chemistry");
      expect(lower).not.toContain("partnership");
      expect(lower).not.toContain("compatib");
    }
  });

  it("recovers numerator/denominator exposure context for a rate trend (event_rate), since DerivedTrend itself only persists the aggregated ratio", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const teamId = fixtureIds.teams["Bla"];
    // A deliberately large jump (not a realistic match count) to clear event_rate's
    // materialityThreshold (0.5 events/second) in this synthetic test -- the raw
    // numerator/denominator must be recoverable even though DerivedTrend only stored the
    // already-aggregated ratio.
    const counts = [1, 1, 1, 302, 302, 302];

    for (let i = 0; i < 6; i++) {
      const match = await createMatch(teamId, new Date(2025, 6, i + 1), `Rate Opponent ${i}`);
      await testDb.derivedMeasurement.create({
        data: {
          organisationId: fixtureIds.organisationId,
          matchId: match.id,
          playerId,
          metricKey: "event_rate",
          metricVersion: 1,
          scopeType: "MATCH",
          scopeKey: match.id,
          value: counts[i]! / 600,
          unit: "count_per_exposure",
          numerator: counts[i],
          denominator: 600,
          denominatorUnit: "seconds",
          coverage: "COMPLETE",
          eligible: true,
          missingInputs: [],
          warnings: [],
          dimensions: { eventType: "GOAL_FOR" },
          sourceRefs: [],
          inputRevision: `rate-${i}`,
        },
      });
    }

    await recomputePlayerTrends(playerId, fixtureIds.organisationId);
    const stories = await getPlayerTrendStories(playerId);
    const trend = stories.find((s) => s.kind === "TREND" && s.metricKey === "event_rate");
    expect(trend).toBeDefined();
    if (trend?.kind === "TREND") {
      expect(trend.direction).toBe("UP");
      expect(trend.dimensionLabel).toBe("Goals rate");
      expect(trend.rateContext).toEqual({
        previousNumerator: 3,
        previousDenominator: 1800,
        latestNumerator: 906,
        latestDenominator: 1800,
        denominatorUnit: "seconds",
      });
      expect(trend.headline).toContain("recorded minutes");
    }
  });

  it("never renders a story for a metric+dimension group with zero eligible rows (e.g. the permanently-inert zone_event_share)", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const match = await createMatch(fixtureIds.teams["Bla"], new Date(2025, 4, 1), "Inert Zone Opponent");
    await testDb.derivedMeasurement.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: match.id,
        playerId,
        metricKey: "zone_event_share",
        metricVersion: 1,
        scopeType: "MATCH",
        scopeKey: match.id,
        value: 0,
        unit: "ratio",
        numerator: 0,
        denominator: 2,
        coverage: "UNKNOWN",
        eligible: false, // ADR-0155 §3: zone_event_share rows are never eligible today.
        missingInputs: ["eventCoordinates"],
        warnings: [],
        dimensions: {},
        sourceRefs: [],
        inputRevision: "inert-zone-1",
      },
    });

    const stories = await getPlayerTrendStories(playerId);
    expect(stories.some((s) => s.metricKey === "zone_event_share")).toBe(false);
  });
});
