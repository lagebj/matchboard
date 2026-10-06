import { describe, it, expect } from "vitest";
import { buildOpponentMemoryViewModel } from "../opponent-memory-view-model";
import type { OpponentPreparationContext, OpponentPattern, PreviousEncounterSummary } from "../types";

function encounter(overrides: Partial<PreviousEncounterSummary> = {}): PreviousEncounterSummary {
  return {
    matchId: "m1",
    occurredAt: new Date("2026-08-01"),
    goalsFor: 2,
    goalsAgainst: 1,
    formation: null,
    overallEnvironment: "NEUTRAL",
    sportingLevel: null,
    playingStyleTags: [],
    concernCategories: [],
    trustedObservation: null,
    ...overrides,
  };
}

function pattern(overrides: Partial<OpponentPattern> = {}): OpponentPattern {
  return {
    phase: "IN_POSSESSION",
    summary: "Pressing described as a problem in 3 of 4 recorded meetings.",
    encounterCount: 3,
    observedInMatchIds: ["m1", "m2", "m3"],
    recency: "RECENT",
    consistency: "CONSISTENT",
    ...overrides,
  };
}

function context(overrides: Partial<OpponentPreparationContext> = {}): OpponentPreparationContext {
  return {
    opponentTeamId: "o1",
    exactOpponentHistoryAvailable: true,
    previousEncounterCount: 1,
    previousEncounters: [encounter()],
    establishedCombinationsAgainstOpponent: [],
    opponentPatterns: [],
    ...overrides,
  };
}

describe("buildOpponentMemoryViewModel", () => {
  it("reports no history when there is no exact-opponent history", () => {
    const result = buildOpponentMemoryViewModel(context({ exactOpponentHistoryAvailable: false, previousEncounters: [] }));
    expect(result).toEqual({ hasHistory: false, recentEncounters: [], patterns: [] });
  });

  it("caps recent encounters at 3 and labels win/loss/draw correctly", () => {
    const result = buildOpponentMemoryViewModel(
      context({
        previousEncounters: [
          encounter({ matchId: "m1", goalsFor: 2, goalsAgainst: 1 }),
          encounter({ matchId: "m2", goalsFor: 1, goalsAgainst: 1 }),
          encounter({ matchId: "m3", goalsFor: 0, goalsAgainst: 2 }),
          encounter({ matchId: "m4", goalsFor: 3, goalsAgainst: 0 }),
        ],
      }),
    );
    expect(result.recentEncounters).toHaveLength(3);
    expect(result.recentEncounters.map((e) => e.resultLabel)).toEqual(["Won 2-1", "Drew 1-1", "Lost 0-2"]);
  });

  it("excludes single-observation patterns — not yet recurring", () => {
    const result = buildOpponentMemoryViewModel(
      context({ opponentPatterns: [pattern({ consistency: "SINGLE_OBSERVATION", encounterCount: 1 })] }),
    );
    expect(result.patterns).toEqual([]);
  });

  it("prefers CONSISTENT patterns over MIXED and caps at 2", () => {
    const result = buildOpponentMemoryViewModel(
      context({
        opponentPatterns: [
          pattern({ phase: "OUT_OF_POSSESSION", summary: "Mixed pattern", consistency: "MIXED", encounterCount: 2 }),
          pattern({ phase: "IN_POSSESSION", summary: "Consistent pattern A", consistency: "CONSISTENT", encounterCount: 4 }),
          pattern({ phase: "SET_PIECE", summary: "Consistent pattern B", consistency: "CONSISTENT", encounterCount: 3 }),
        ],
      }),
    );
    expect(result.patterns.map((p) => p.summary)).toEqual(["Consistent pattern A", "Consistent pattern B"]);
  });

  it("builds a qualifier combining consistency and recency", () => {
    const result = buildOpponentMemoryViewModel(
      context({ opponentPatterns: [pattern({ consistency: "MIXED", recency: "OLD" })] }),
    );
    expect(result.patterns[0]?.qualifier).toBe("Mixed · not seen in the most recent meeting");
  });
});
