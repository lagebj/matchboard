import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/selection/compute-plan-integrity", () => ({
  computeRoundPlanIntegrity: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { logger } from "@/lib/logger";
import { buildRoundItem, buildRoundItems, resolveActiveLeagueSeason, type RoundForBuildItem } from "../build-round-item";

const mockedComputeIntegrity = vi.mocked(computeRoundPlanIntegrity);

function makeRound(overrides: Partial<RoundForBuildItem> = {}): RoundForBuildItem {
  return {
    id: "round-1",
    name: "Round 1",
    status: "DRAFT",
    selections: [{ id: "sel-1" }],
    matches: [
      { id: "match-1", status: "SCHEDULED", startsAt: new Date("2026-09-01T10:00:00Z"), team: { name: "A1 Blues" } },
    ],
    ...overrides,
  };
}

function integrityResult(blockerCount: number, decisionRequiredCount = 0) {
  return {
    summary: {
      blockerCount,
      decisionRequiredCount,
      belowMinimumMatchCount: 0,
      unavailableSelectedPlayerCount: 0,
      missingOpportunityPlayerCount: 0,
      integrityFailureCount: 0,
    },
  } as Awaited<ReturnType<typeof computeRoundPlanIntegrity>>;
}

describe("buildRoundItem", () => {
  beforeEach(() => {
    mockedComputeIntegrity.mockReset();
    vi.mocked(logger.error).mockReset();
  });

  it("returns a normal item with no loadError when computeRoundPlanIntegrity succeeds", async () => {
    mockedComputeIntegrity.mockResolvedValue(integrityResult(0));

    const item = await buildRoundItem(makeRound(), new Map());

    expect(item.loadError).toBeUndefined();
    expect(item.derivedStatus).toBe("READY");
    expect(item.id).toBe("round-1");
    expect(item.teamNames).toEqual(["A1 Blues"]);
  });

  it("marks the round BLOCKED when integrity reports blockers", async () => {
    mockedComputeIntegrity.mockResolvedValue(integrityResult(2));

    const item = await buildRoundItem(makeRound(), new Map());

    expect(item.derivedStatus).toBe("BLOCKED");
    expect(item.loadError).toBeUndefined();
  });

  // Regression test: this exact class of failure (computeRoundPlanIntegrity throwing a schema
  // drift/P2022 error for one round) previously crashed the whole /rounds page's Promise.all,
  // rendering zero round cards for every round -- not just the broken one.
  it("does not throw when computeRoundPlanIntegrity rejects -- returns a loadError item instead", async () => {
    mockedComputeIntegrity.mockRejectedValue(new Error("The column `foo` does not exist in the current database."));

    const item = await buildRoundItem(makeRound(), new Map());

    expect(item.loadError).toBe("Couldn't load full status for this round.");
    expect(item.id).toBe("round-1");
    expect(item.matchCount).toBe(1);
    expect(item.teamNames).toEqual(["A1 Blues"]);
    // Under-report (not BLOCKED) is the deliberate safe fallback -- see the function's own comment.
    expect(item.derivedStatus).not.toBe("BLOCKED");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ roundId: "round-1" }),
      expect.stringContaining("computeRoundPlanIntegrity failed"),
    );
  });

  it("computeRoundPlanIntegrity failing for one round never rejects buildRoundItems for the others (the actual page-crash regression)", async () => {
    mockedComputeIntegrity
      .mockResolvedValueOnce(integrityResult(0))
      .mockRejectedValueOnce(new Error("P2022 ColumnNotFound"))
      .mockResolvedValueOnce(integrityResult(1));

    const rounds = [
      makeRound({ id: "round-a" }),
      makeRound({ id: "round-b" }),
      makeRound({ id: "round-c" }),
    ];

    const items = await buildRoundItems(rounds, new Map());

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toEqual(["round-a", "round-b", "round-c"]);
    expect(items[0]!.loadError).toBeUndefined();
    expect(items[1]!.loadError).toBe("Couldn't load full status for this round.");
    expect(items[2]!.loadError).toBeUndefined();
    expect(items[2]!.derivedStatus).toBe("BLOCKED");
  });
});

describe("resolveActiveLeagueSeason", () => {
  const now = new Date("2026-08-29T12:00:00Z");

  it("returns null when there are no seasons at all", () => {
    expect(resolveActiveLeagueSeason([], now)).toBeNull();
  });

  it("picks the season whose range contains now", () => {
    const current = { id: "current", startDate: new Date("2026-08-01"), endDate: new Date("2026-10-31") };
    const past = { id: "past", startDate: new Date("2026-01-01"), endDate: new Date("2026-05-31") };

    expect(resolveActiveLeagueSeason([past, current], now)?.id).toBe("current");
  });

  // Regression test: e2e specs create throwaway matches dated up to ~100 years in the future
  // (e2e/helpers/live-match-fixtures.ts), each auto-creating its own far-future LeagueSeason.
  // "Most recent startDate" alone would keep picking one of those instead of the real current
  // season, which is exactly the bug this function replaces.
  it("does not pick a far-future season over the one actually containing now", () => {
    const current = { id: "current", startDate: new Date("2026-08-01"), endDate: new Date("2026-10-31") };
    const farFuture = { id: "far-future", startDate: new Date("2095-01-01"), endDate: new Date("2095-05-31") };

    expect(resolveActiveLeagueSeason([current, farFuture], now)?.id).toBe("current");
  });

  it("falls back to the most recently started season when none spans now", () => {
    const older = { id: "older", startDate: new Date("2025-01-01"), endDate: new Date("2025-05-31") };
    const newer = { id: "newer", startDate: new Date("2025-08-01"), endDate: new Date("2025-10-31") };

    expect(resolveActiveLeagueSeason([older, newer], now)?.id).toBe("newer");
  });

  // Regression test for this repo's own seed dataset (scripts/seed-test-dataset.ts): "Test A1
  // Spring 2026" has a fixed 2026-04-01..2026-06-30 range that has already ended by the time
  // `now` is 2026-08-29 (no season contains now), and e2e specs auto-create far-future seasons
  // (up to ~100 years out) alongside it in the same organisation. The already-ended real season
  // must still win over the far-future test noise -- this is the exact scenario an unfiltered
  // "most recent startDate" fallback would get wrong.
  it("prefers an already-ended real season over far-future test-generated seasons", () => {
    const realSeason = { id: "real-spring-2026", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") };
    const testSeasonA = { id: "test-season-a", startDate: new Date("2062-03-01"), endDate: new Date("2062-05-31") };
    const testSeasonB = { id: "test-season-b", startDate: new Date("2095-01-01"), endDate: new Date("2095-05-31") };

    expect(resolveActiveLeagueSeason([realSeason, testSeasonA, testSeasonB], now)?.id).toBe("real-spring-2026");
  });

  it("falls back to plain most-recent-by-startDate when every season is implausibly far out", () => {
    const testSeasonA = { id: "test-season-a", startDate: new Date("2062-03-01"), endDate: new Date("2062-05-31") };
    const testSeasonB = { id: "test-season-b", startDate: new Date("2095-01-01"), endDate: new Date("2095-05-31") };

    expect(resolveActiveLeagueSeason([testSeasonA, testSeasonB], now)?.id).toBe("test-season-b");
  });

  it("prefers the most recently started season among multiple that contain now", () => {
    const wider = { id: "wider", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };
    const narrower = { id: "narrower", startDate: new Date("2026-08-01"), endDate: new Date("2026-09-30") };

    expect(resolveActiveLeagueSeason([wider, narrower], now)?.id).toBe("narrower");
  });

  // Regression test for a real bug this exact function had, found live in CI: an earlier ~2-year
  // plausibility window was wider than live-match-fixtures.ts's randomFutureMatchDate() minimum
  // offset (60 weeks / ~420 days), so a test-generated season landing e.g. ~1.2 years out still
  // counted as "plausible" and outranked the real seed season purely by having a more recent
  // startDate -- round-mutation.spec.ts's target round disappeared from the page entirely. The
  // window must stay well under 420 days for this to never recur.
  it("does not let a near-term (but still test-generated) far-future season outrank the real one", () => {
    const realSeason = { id: "real-spring-2026", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") };
    // ~1.2 years out from `now` -- inside live-match-fixtures.ts's minimum random offset, and
    // would have wrongly qualified as "plausible" under the old ~2-year window.
    const nearTermTestNoise = { id: "near-term-test-noise", startDate: new Date("2027-10-01"), endDate: new Date("2027-12-31") };

    expect(resolveActiveLeagueSeason([realSeason, nearTermTestNoise], now)?.id).toBe("real-spring-2026");
  });
});
