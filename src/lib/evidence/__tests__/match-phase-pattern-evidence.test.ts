import { describe, it, expect } from "vitest";
import {
  aggregateMatchPhasePatterns,
  classifyMatchPhaseConfidence,
  type MatchPhaseSample,
} from "../match-phase-pattern-evidence";
import { getMatchPhaseWindows } from "../match-state-timeline";
import type { GoalAttributionEvent } from "../combination-goal-attribution";
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";

function goal(matchMs: number, team: "FOR" | "AGAINST"): GoalAttributionEvent {
  return { matchMs, team, scorerPlayerId: null, assistPlayerId: null, approximateTiming: false };
}

const LEAGUE_WINDOWS = getMatchPhaseWindows(getLeaguePeriodConfig("LEAGUE"));

function sample(sourceId: string, goalEvents: GoalAttributionEvent[]): MatchPhaseSample {
  return { sourceId, goalEvents, phaseWindows: LEAGUE_WINDOWS };
}

describe("classifyMatchPhaseConfidence (TEST-MATRIX §2)", () => {
  it("is INSUFFICIENT below the EMERGING threshold", () => {
    expect(classifyMatchPhaseConfidence(0)).toBe("INSUFFICIENT");
    expect(classifyMatchPhaseConfidence(2)).toBe("INSUFFICIENT");
  });

  it("is EMERGING at the configured threshold", () => {
    expect(classifyMatchPhaseConfidence(3)).toBe("EMERGING");
    expect(classifyMatchPhaseConfidence(5)).toBe("EMERGING");
  });

  it("is ESTABLISHED at the configured threshold", () => {
    expect(classifyMatchPhaseConfidence(6)).toBe("ESTABLISHED");
    expect(classifyMatchPhaseConfidence(20)).toBe("ESTABLISHED");
  });
});

describe("aggregateMatchPhasePatterns — repeated slow starts (TEST-MATRIX §2 Scenario A)", () => {
  it("stays quiet (INSUFFICIENT) with too few matches, even with a goal in every one", () => {
    const samples = [
      sample("m1", [goal(2 * 60 * 1000, "AGAINST")]),
      sample("m2", [goal(3 * 60 * 1000, "AGAINST")]),
    ];
    const rows = aggregateMatchPhasePatterns(samples);
    const opening5FirstHalf = rows.find((r) => r.period === "FIRST_HALF" && r.phase === "OPENING_5");
    expect(opening5FirstHalf!.matches).toBe(2);
    expect(opening5FirstHalf!.confidence).toBe("INSUFFICIENT");
  });

  it("becomes ESTABLISHED once enough matches show the same early-concession pattern", () => {
    const samples = Array.from({ length: 8 }, (_, i) => sample(`m${i}`, [goal(2 * 60 * 1000, "AGAINST")]));
    const rows = aggregateMatchPhasePatterns(samples);
    const opening10FirstHalf = rows.find((r) => r.period === "FIRST_HALF" && r.phase === "OPENING_10");
    expect(opening10FirstHalf!.matches).toBe(8);
    expect(opening10FirstHalf!.goalsAgainst).toBe(8);
    expect(opening10FirstHalf!.confidence).toBe("ESTABLISHED");
  });

  it("retains exposure (matches count) even when no goal ever occurs in the window", () => {
    const samples = Array.from({ length: 6 }, (_, i) => sample(`m${i}`, []));
    const rows = aggregateMatchPhasePatterns(samples);
    const finalFive = rows.find((r) => r.period === "SECOND_HALF" && r.phase === "FINAL_5");
    expect(finalFive!.matches).toBe(6);
    expect(finalFive!.goalsFor).toBe(0);
    expect(finalFive!.goalsAgainst).toBe(0);
    expect(finalFive!.confidence).toBe("ESTABLISHED");
  });
});

describe("aggregateMatchPhasePatterns — window overlap and scope", () => {
  it("a goal inside opening 5 also counts inside opening 10 (overlapping, not partitioned, windows)", () => {
    const samples = [sample("m1", [goal(3 * 60 * 1000, "FOR")])];
    const rows = aggregateMatchPhasePatterns(samples);
    expect(rows.find((r) => r.phase === "OPENING_5" && r.period === "FIRST_HALF")!.goalsFor).toBe(1);
    expect(rows.find((r) => r.phase === "OPENING_10" && r.period === "FIRST_HALF")!.goalsFor).toBe(1);
  });

  it("keeps first-half and second-half openings as distinct rows, not merged", () => {
    const secondHalfOpeningMs = 25 * 60 * 1000 + 2 * 60 * 1000;
    const samples = [sample("m1", [goal(secondHalfOpeningMs, "FOR")])];
    const rows = aggregateMatchPhasePatterns(samples);
    const firstHalfOpening = rows.find((r) => r.phase === "OPENING_5" && r.period === "FIRST_HALF")!;
    const secondHalfOpening = rows.find((r) => r.phase === "OPENING_5" && r.period === "SECOND_HALF")!;
    expect(firstHalfOpening.goalsFor).toBe(0);
    expect(secondHalfOpening.goalsFor).toBe(1);
  });

  it("does not attribute a goal outside every window's range to any bucket", () => {
    // 12 minutes in: past OPENING_10 (0-10min), before LATE_PERIOD (15-25min of a 25-min half).
    const samples = [sample("m1", [goal(12 * 60 * 1000, "FOR")])];
    const rows = aggregateMatchPhasePatterns(samples);
    for (const row of rows) {
      if (row.period === "FIRST_HALF") expect(row.goalsFor).toBe(0);
    }
  });

  it("returns an empty list for no samples", () => {
    expect(aggregateMatchPhasePatterns([])).toEqual([]);
  });
});
