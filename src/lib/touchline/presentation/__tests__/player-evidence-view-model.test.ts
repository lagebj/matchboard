import { describe, it, expect } from "vitest";
import { buildPlayerEvidenceViewModel, type PlayerEvidenceStoryData } from "../player-evidence-view-model";

describe("buildPlayerEvidenceViewModel", () => {
  it("groups stories under OPPORTUNITY/POSITION/MATCH_CONTEXT/TREND in fixed key order, including the ADR-0157 C5 TREND group", () => {
    const stories: PlayerEvidenceStoryData[] = [
      { id: "a", group: "MATCH_CONTEXT", question: "q", title: "t", confidence: null },
      { id: "b", group: "TREND", question: "q", title: "t", confidence: "Established" },
      { id: "c", group: "OPPORTUNITY", question: "q", title: "t", confidence: null },
    ];
    const vm = buildPlayerEvidenceViewModel({ stories });
    expect(Object.keys(vm.storiesByGroup)).toEqual(["OPPORTUNITY", "POSITION", "MATCH_CONTEXT", "TREND"]);
    expect(vm.storiesByGroup.TREND).toHaveLength(1);
    expect(vm.storiesByGroup.TREND[0]!.id).toBe("b");
    expect(vm.storiesByGroup.POSITION).toHaveLength(0);
  });

  it("is an empty TREND group when no trend stories exist, not an absent key", () => {
    const vm = buildPlayerEvidenceViewModel({ stories: [] });
    expect(vm.storiesByGroup.TREND).toEqual([]);
  });
});
