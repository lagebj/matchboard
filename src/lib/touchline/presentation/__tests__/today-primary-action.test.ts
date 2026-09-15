import { describe, expect, it } from "vitest";
import { resolveTodayPrimaryAction } from "@/lib/touchline/presentation/today-primary-action";
import type { CoachDecision } from "@/lib/situational/situation-types";

function makeDecision(overrides: Partial<CoachDecision> & Pick<CoachDecision, "candidateId">): CoachDecision {
  return {
    title: "Some decision",
    summary: "Summary",
    recommendedAction: null,
    deepLink: null,
    ...overrides,
  } as CoachDecision;
}

describe("resolveTodayPrimaryAction excludedCandidateIds", () => {
  it("takes the projection's first decision when nothing is excluded", () => {
    const result = resolveTodayPrimaryAction({
      projectionDecisions: [makeDecision({ candidateId: "a" }), makeDecision({ candidateId: "b" })],
      selectionDecisions: [],
      roundPlanIntegrities: {},
      todayMatches: [],
    });
    expect(result.kind).toBe("GENERIC");
    if (result.kind === "GENERIC") expect(result.decision.candidateId).toBe("a");
  });

  it("skips an excluded candidate without reranking the rest", () => {
    const result = resolveTodayPrimaryAction({
      projectionDecisions: [makeDecision({ candidateId: "a" }), makeDecision({ candidateId: "b" })],
      selectionDecisions: [],
      roundPlanIntegrities: {},
      todayMatches: [],
      excludedCandidateIds: new Set(["a"]),
    });
    expect(result.kind).toBe("GENERIC");
    if (result.kind === "GENERIC") expect(result.decision.candidateId).toBe("b");
  });

  it("returns NONE when every decision is excluded", () => {
    const result = resolveTodayPrimaryAction({
      projectionDecisions: [makeDecision({ candidateId: "a" })],
      selectionDecisions: [],
      roundPlanIntegrities: {},
      todayMatches: [],
      excludedCandidateIds: new Set(["a"]),
    });
    expect(result.kind).toBe("NONE");
  });
});
