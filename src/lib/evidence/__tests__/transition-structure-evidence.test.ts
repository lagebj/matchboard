import { describe, expect, it } from "vitest";
// Importing this registers `vi.mock("server-only", ...)` as a side effect, which the module
// under test needs (it has `import "server-only"` at its top, guarding its DB-bound export) —
// same convention as src/lib/insights/position-exposure.test.ts.
import "@/test/support/auth-mock";
import {
  aggregateTransitionStructurePatterns,
  bucketForSubstitutionCount,
  classifyTransitionStructureConfidence,
} from "../transition-structure-evidence";
import type { MatchStateInterval, MatchStateTimeline, MatchTransition } from "../match-state-timeline";

function makeTransition(overrides: Partial<MatchTransition>): MatchTransition {
  return {
    atMs: 0,
    period: "SECOND_HALF",
    playersOff: [],
    playersOn: [],
    playersRemaining: [],
    positionOnlyChanges: [],
    substitutionCount: 1,
    changedLines: [],
    isSimultaneousSubstitutionAndReshuffle: false,
    disruptionDescriptors: ["SUBSTITUTION_ONLY"],
    scoreBefore: { for: 0, against: 0 },
    scoreAfter: { for: 0, against: 0 },
    isAtNaturalBreak: false,
    ...overrides,
  } as MatchTransition;
}

function makeInterval(overrides: Partial<MatchStateInterval>): MatchStateInterval {
  return {
    startMs: 0,
    endMs: 60000,
    durationMs: 60000,
    period: "SECOND_HALF",
    matchPhases: [],
    players: [],
    structuralSummary: { onPitchCount: 0, byLine: {}, byLane: {} },
    scoreAtStart: { for: 0, against: 0 },
    scoreAtEnd: { for: 0, against: 0 },
    goalsFor: 0,
    goalsAgainst: 0,
    timingQuality: "EXACT",
    ...overrides,
  } as MatchStateInterval;
}

function makeTimeline(transitions: MatchTransition[], intervals: MatchStateInterval[]): MatchStateTimeline {
  return { context: {} as never, intervals, transitions, phaseWindows: [], timingQuality: "EXACT" } as MatchStateTimeline;
}

describe("bucketForSubstitutionCount", () => {
  it("buckets 0 or 1 as SINGLE", () => {
    expect(bucketForSubstitutionCount(0)).toBe("SINGLE");
    expect(bucketForSubstitutionCount(1)).toBe("SINGLE");
  });

  it("buckets 2 as DOUBLE", () => {
    expect(bucketForSubstitutionCount(2)).toBe("DOUBLE");
  });

  it("buckets 3+ as TRIPLE_PLUS", () => {
    expect(bucketForSubstitutionCount(3)).toBe("TRIPLE_PLUS");
    expect(bucketForSubstitutionCount(6)).toBe("TRIPLE_PLUS");
  });
});

describe("classifyTransitionStructureConfidence", () => {
  it("is INSUFFICIENT below 2 occurrences", () => {
    expect(classifyTransitionStructureConfidence(0)).toBe("INSUFFICIENT");
    expect(classifyTransitionStructureConfidence(1)).toBe("INSUFFICIENT");
  });

  it("is EMERGING for 2-3 occurrences", () => {
    expect(classifyTransitionStructureConfidence(2)).toBe("EMERGING");
    expect(classifyTransitionStructureConfidence(3)).toBe("EMERGING");
  });

  it("is ESTABLISHED for 4+ occurrences", () => {
    expect(classifyTransitionStructureConfidence(4)).toBe("ESTABLISHED");
    expect(classifyTransitionStructureConfidence(10)).toBe("ESTABLISHED");
  });
});

describe("aggregateTransitionStructurePatterns", () => {
  it("groups transitions by period + batch-size bucket + natural-break flag", () => {
    const timeline = makeTimeline(
      [
        makeTransition({ atMs: 60_000, substitutionCount: 1, period: "SECOND_HALF", isAtNaturalBreak: false }),
        makeTransition({ atMs: 120_000, substitutionCount: 4, period: "SECOND_HALF", isAtNaturalBreak: true }),
      ],
      [],
    );

    const rows = aggregateTransitionStructurePatterns([timeline]);
    expect(rows).toHaveLength(2);
    const single = rows.find((r) => r.batchSizeBucket === "SINGLE")!;
    const triplePlus = rows.find((r) => r.batchSizeBucket === "TRIPLE_PLUS")!;
    expect(single.isAtNaturalBreak).toBe(false);
    expect(triplePlus.isAtNaturalBreak).toBe(true);
  });

  it("ignores transitions with no resolved period", () => {
    const timeline = makeTimeline([makeTransition({ period: null })], []);
    const rows = aggregateTransitionStructurePatterns([timeline]);
    expect(rows).toHaveLength(0);
  });

  it("sums goals conceded within the observation window after each transition of the same shape", () => {
    const timeline = makeTimeline(
      [
        makeTransition({ atMs: 0, substitutionCount: 1, period: "SECOND_HALF" }),
        makeTransition({ atMs: 400_000, substitutionCount: 1, period: "SECOND_HALF" }),
      ],
      [
        makeInterval({ startMs: 60_000, goalsAgainst: 1 }), // within 5 min of first transition
        makeInterval({ startMs: 401_000, goalsAgainst: 1 }), // within 5 min of second transition
        makeInterval({ startMs: 900_000, goalsAgainst: 1 }), // outside both windows
      ],
    );

    const rows = aggregateTransitionStructurePatterns([timeline]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.occurrences).toBe(2);
    expect(rows[0]!.goalsAgainstInWindow).toBe(2);
  });

  it("aggregates occurrences across multiple matches", () => {
    const timelineA = makeTimeline([makeTransition({ atMs: 0, substitutionCount: 2 })], []);
    const timelineB = makeTimeline([makeTransition({ atMs: 0, substitutionCount: 2 })], []);
    const rows = aggregateTransitionStructurePatterns([timelineA, timelineB]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.occurrences).toBe(2);
    expect(rows[0]!.confidence).toBe("EMERGING");
  });

  it("returns an empty array for no timelines", () => {
    expect(aggregateTransitionStructurePatterns([])).toEqual([]);
  });
});
