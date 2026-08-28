import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/selection/compute-plan-integrity", () => ({
  computeRoundPlanIntegrity: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { logger } from "@/lib/logger";
import { buildRoundItem, buildRoundItems, type RoundForBuildItem } from "../build-round-item";

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
