import { describe, it, expect } from "vitest";
import { buildDeterministicInsights } from "../build-deterministic-insights";
import type { CurrentPlanInput, MatchInsightFact, PlayerPreparationSummary } from "../types";

const PLAN: CurrentPlanInput = {
  matchId: "m1",
  teamId: "t1",
  organisationId: "org1",
  leagueSeasonId: "ls1",
  opponentTeamId: "opp1",
  formation: "4-3-3",
  matchStartsAt: new Date("2026-10-01T10:00:00Z"),
  squad: [
    { playerId: "p1", role: "CORE", position: "CB" },
    { playerId: "p2", role: "CORE", position: "CB" },
  ],
  plannedRotations: [],
};

const PLAYER_SUMMARIES = new Map<string, PlayerPreparationSummary>();
const PLAYER_NAMES = new Map([
  ["p1", "Noah"],
  ["p2", "Henrik"],
]);

function fact(overrides: Partial<MatchInsightFact> & Pick<MatchInsightFact, "type" | "subjectRefs" | "value">): MatchInsightFact {
  return {
    id: "fact-id",
    evidenceRefs: ["fact:test:x"],
    deterministicPriority: 50,
    ...overrides,
  };
}

function build(facts: MatchInsightFact[]) {
  return buildDeterministicInsights({ facts, plan: PLAN, playerSummaries: PLAYER_SUMMARIES, playerNameById: PLAYER_NAMES });
}

describe("match-insights/build-deterministic-insights", () => {
  it("never surfaces an insight per fact merely because the fact exists (ATTRIBUTE_PROFILE is provenance-only)", () => {
    const result = build([
      fact({ type: "ATTRIBUTE_PROFILE", subjectRefs: ["p1"], value: { passing: 7 } }),
    ]);
    expect(result).toHaveLength(0);
  });

  it("surfaces a starting-pattern insight only when a planned CORE player has zero recent starts", () => {
    const zeroStarts = build([
      fact({ type: "STARTING_PATTERN", subjectRefs: ["p1"], value: { starts: 0, matchesConsidered: 4, plannedRole: "CORE" }, deterministicPriority: 90 }),
    ]);
    expect(zeroStarts).toHaveLength(1);
    expect(zeroStarts[0].observation).toContain("Noah");
    expect(zeroStarts[0].observation).toContain("4 matches");
    expect(zeroStarts[0].relevance).toBe("HIGH");

    const usualStarter = build([
      fact({ type: "STARTING_PATTERN", subjectRefs: ["p1"], value: { starts: 4, matchesConsidered: 4, plannedRole: "CORE" }, deterministicPriority: 40 }),
    ]);
    expect(usualStarter).toHaveLength(0);

    const zeroStartsButBench = build([
      fact({ type: "STARTING_PATTERN", subjectRefs: ["p1"], value: { starts: 0, matchesConsidered: 4, plannedRole: "SUPPORT" }, deterministicPriority: 40 }),
    ]);
    expect(zeroStartsButBench).toHaveLength(0);
  });

  it("never labels a player strong/weak/better/worse in generated text", () => {
    const result = build([
      fact({ type: "STARTING_PATTERN", subjectRefs: ["p1"], value: { starts: 0, matchesConsidered: 4, plannedRole: "CORE" }, deterministicPriority: 90 }),
      fact({ type: "GOAL_INVOLVEMENT", subjectRefs: ["p1"], value: { goals: 4, assists: 2, appearances: 9 }, deterministicPriority: 25 }),
    ]);
    for (const insight of result) {
      expect(insight.observation.toLowerCase()).not.toMatch(/\b(better|worse|strong|weak|good|bad)\b/);
    }
  });

  it("surfaces a new-combination insight unconditionally (it is definitionally novel)", () => {
    const result = build([
      fact({ type: "NEW_COMBINATION", subjectRefs: ["p1", "p2"], value: { position: "CB" }, deterministicPriority: 65 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].observation).toContain("Noah and Henrik");
    expect(result[0].observation).toContain("not previously started together");
  });

  it("only surfaces an established-combination insight at HIGH (ESTABLISHED) confidence, not EMERGING", () => {
    const established = build([
      fact({
        type: "STARTS_TOGETHER",
        subjectRefs: ["p1", "p2"],
        value: { family: "PARTNERSHIP", subtype: null, minutesTogether: 120, matchCount: 3 },
        confidence: "HIGH",
        deterministicPriority: 45,
      }),
    ]);
    expect(established).toHaveLength(1);

    const emerging = build([
      fact({
        type: "STARTS_TOGETHER",
        subjectRefs: ["p1", "p2"],
        value: { family: "PARTNERSHIP", subtype: null, minutesTogether: 20, matchCount: 1 },
        confidence: "MEDIUM",
        deterministicPriority: 30,
      }),
    ]);
    expect(emerging).toHaveLength(0);
  });

  it("gates goal-involvement insights to a minimum combined threshold", () => {
    const belowThreshold = build([
      fact({ type: "GOAL_INVOLVEMENT", subjectRefs: ["p1"], value: { goals: 1, assists: 1, appearances: 5 }, deterministicPriority: 25 }),
    ]);
    expect(belowThreshold).toHaveLength(0);

    const atThreshold = build([
      fact({ type: "GOAL_INVOLVEMENT", subjectRefs: ["p1"], value: { goals: 2, assists: 1, appearances: 5 }, deterministicPriority: 25 }),
    ]);
    expect(atThreshold).toHaveLength(1);
  });

  it("marks an opponent observation's trusted text as attributed, not objective fact", () => {
    const result = build([
      fact({
        type: "OPPONENT_OBSERVATION",
        subjectRefs: ["m1"],
        value: {
          overallEnvironment: "ACCEPTABLE",
          playingStyleTags: ["HIGH_PRESSING"],
          trustedObservation: { text: "Difficult centrally against their press.", source: "OPPONENT_ENCOUNTER_SUMMARY" },
        },
        deterministicPriority: 80,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].observation).toContain("Coach observation");
    expect(result[0].implication).toContain("not a confirmed fact");
  });

  it("orders results by relevance via rankInsightCandidates (HIGH before MEDIUM before CONTEXTUAL)", () => {
    const result = build([
      fact({ type: "GOAL_COMBINATION", subjectRefs: ["p1", "p2"], value: { directGoalContributionsTotal: 1, directAssistContributionsTotal: 1 }, deterministicPriority: 50 }),
      fact({ type: "STARTING_PATTERN", subjectRefs: ["p1"], value: { starts: 0, matchesConsidered: 4, plannedRole: "CORE" }, deterministicPriority: 90 }),
      fact({ type: "OPPONENT_ENCOUNTER", subjectRefs: ["m1"], value: { encounters: [] }, deterministicPriority: 20 }),
    ]);
    expect(result.map((r) => r.relevance)).toEqual(["HIGH", "MEDIUM", "CONTEXTUAL"]);
  });

  it("every candidate traces back to at least one factRef and evidenceRef (AI-grounding parity)", () => {
    const result = build([
      fact({ type: "NEW_COMBINATION", subjectRefs: ["p1", "p2"], value: { position: "CB" }, id: "new-combination:p1:p2", evidenceRefs: ["fact:new-combination:p1:p2"], deterministicPriority: 65 }),
    ]);
    expect(result[0].factRefs.length).toBeGreaterThan(0);
    expect(result[0].evidenceRefs.length).toBeGreaterThan(0);
  });
});
