import { describe, it, expect } from "vitest";
import { categoryForEvidenceRefs, categoryForFactType, deriveRelevanceFromPriority, rankInsightCandidates } from "../ranking";
import type { MatchInsightCandidate } from "../types";

describe("match-insights/ranking", () => {
  describe("deriveRelevanceFromPriority", () => {
    it("classifies priority >= 70 as HIGH", () => {
      expect(deriveRelevanceFromPriority(70)).toBe("HIGH");
      expect(deriveRelevanceFromPriority(90)).toBe("HIGH");
    });

    it("classifies priority in [35, 70) as MEDIUM", () => {
      expect(deriveRelevanceFromPriority(35)).toBe("MEDIUM");
      expect(deriveRelevanceFromPriority(69)).toBe("MEDIUM");
    });

    it("classifies priority below 35 as CONTEXTUAL", () => {
      expect(deriveRelevanceFromPriority(0)).toBe("CONTEXTUAL");
      expect(deriveRelevanceFromPriority(34)).toBe("CONTEXTUAL");
    });
  });

  describe("categoryForFactType", () => {
    it("maps every fact type to a category with no throw", () => {
      const types: Parameters<typeof categoryForFactType>[0][] = [
        "STARTING_PATTERN",
        "POSITION_PATTERN",
        "POSITION_EXPOSURE",
        "ATTRIBUTE_PROFILE",
        "GOAL_INVOLVEMENT",
        "GOAL_COMBINATION",
        "STARTS_TOGETHER",
        "NEW_COMBINATION",
        "LINEUP_CONTINUITY",
        "FORMATION_PATTERN",
        "DEVELOPMENT_CONTEXT",
        "OPPONENT_ENCOUNTER",
        "OPPONENT_OBSERVATION",
        "OPPONENT_TREND",
        "ROTATION_CONTEXT",
      ];
      for (const type of types) {
        expect(() => categoryForFactType(type)).not.toThrow();
      }
    });

    it("maps opponent fact types to OPPONENT_HISTORY", () => {
      expect(categoryForFactType("OPPONENT_ENCOUNTER")).toBe("OPPONENT_HISTORY");
      expect(categoryForFactType("OPPONENT_OBSERVATION")).toBe("OPPONENT_HISTORY");
      expect(categoryForFactType("OPPONENT_TREND")).toBe("OPPONENT_HISTORY");
    });

    it("maps combination fact types to COMBINATION", () => {
      expect(categoryForFactType("STARTS_TOGETHER")).toBe("COMBINATION");
      expect(categoryForFactType("NEW_COMBINATION")).toBe("COMBINATION");
      expect(categoryForFactType("GOAL_COMBINATION")).toBe("COMBINATION");
    });
  });

  describe("categoryForEvidenceRefs", () => {
    it("derives category from the fact:<slug>:... evidence-ref namespace, never from AI-emitted structure", () => {
      expect(categoryForEvidenceRefs(["fact:opponent-encounter:m1"])).toBe("OPPONENT_HISTORY");
      expect(categoryForEvidenceRefs(["fact:new-combination:p1:p2"])).toBe("COMBINATION");
    });

    it("picks the first recognized namespace when multiple refs are cited", () => {
      expect(categoryForEvidenceRefs(["fact:unknown-namespace:x", "fact:opponent-trend:m1"])).toBe("OPPONENT_HISTORY");
    });

    it("falls back to OBSERVATION_FOCUS for an unrecognized namespace rather than guessing", () => {
      expect(categoryForEvidenceRefs(["fact:not-a-real-slug:x"])).toBe("OBSERVATION_FOCUS");
      expect(categoryForEvidenceRefs([])).toBe("OBSERVATION_FOCUS");
    });
  });

  describe("rankInsightCandidates", () => {
    function candidate(id: string, relevance: MatchInsightCandidate["relevance"]): MatchInsightCandidate {
      return {
        id,
        category: "OBSERVATION_FOCUS",
        relevance,
        title: id,
        observation: id,
        subjectRefs: [],
        factRefs: [],
        evidenceRefs: [],
        source: "DETERMINISTIC",
      };
    }

    it("orders HIGH before MEDIUM before CONTEXTUAL", () => {
      const input = [candidate("c", "CONTEXTUAL"), candidate("h", "HIGH"), candidate("m", "MEDIUM")];
      expect(rankInsightCandidates(input).map((c) => c.id)).toEqual(["h", "m", "c"]);
    });

    it("breaks ties within a relevance tier deterministically by id, not insertion order", () => {
      const input = [candidate("b", "HIGH"), candidate("a", "HIGH")];
      expect(rankInsightCandidates(input).map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("does not mutate the input array", () => {
      const input = [candidate("b", "HIGH"), candidate("a", "HIGH")];
      const frozenIds = input.map((c) => c.id);
      rankInsightCandidates(input);
      expect(input.map((c) => c.id)).toEqual(frozenIds);
    });
  });
});
