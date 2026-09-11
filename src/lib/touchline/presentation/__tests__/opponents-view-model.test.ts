import { describe, it, expect } from "vitest";
import { buildOpponentsViewModel, type OpponentRowInput } from "../opponents-view-model";

function opponent(overrides: Partial<OpponentRowInput> & { opponentTeamId: string }): OpponentRowInput {
  return {
    displayName: "Opponent",
    encounterCount: 1,
    lastEncounterDate: null,
    lastEncounterResult: null,
    sportingLevel: "unknown",
    latestFollowUp: null,
    ...overrides,
  };
}

describe("buildOpponentsViewModel", () => {
  it("counts opponents faced within the last 90 days as recently faced", () => {
    const now = new Date("2026-09-11T00:00:00Z");
    const vm = buildOpponentsViewModel({
      nowIso: now.toISOString(),
      opponents: [
        opponent({ opponentTeamId: "a", lastEncounterDate: "2026-09-01T00:00:00Z" }), // 10 days ago
        opponent({ opponentTeamId: "b", lastEncounterDate: "2026-01-01T00:00:00Z" }), // long ago
        opponent({ opponentTeamId: "c", lastEncounterDate: null }),
      ],
    });
    expect(vm.recentlyFacedCount).toBe(1);
  });

  it("counts opponents whose latest follow-up is not a terminal state as needing follow-up", () => {
    const vm = buildOpponentsViewModel({
      nowIso: "2026-09-11T00:00:00Z",
      opponents: [
        opponent({ opponentTeamId: "a", latestFollowUp: "DISCUSSED_AFTER_MATCH" }),
        opponent({ opponentTeamId: "b", latestFollowUp: "NO_FURTHER_ACTION_REQUIRED" }),
        opponent({ opponentTeamId: "c", latestFollowUp: "NONE" }),
        opponent({ opponentTeamId: "d", latestFollowUp: null }),
      ],
    });
    expect(vm.needsFollowUpCount).toBe(1);
  });

  it("never invents a percentage strength score onto the row (passthrough only)", () => {
    const vm = buildOpponentsViewModel({
      nowIso: "2026-09-11T00:00:00Z",
      opponents: [opponent({ opponentTeamId: "a", sportingLevel: "high" })],
    });
    expect(vm.opponents[0].sportingLevel).toBe("high");
    expect(vm.opponents[0]).not.toHaveProperty("sportingLevelPercent");
  });
});
