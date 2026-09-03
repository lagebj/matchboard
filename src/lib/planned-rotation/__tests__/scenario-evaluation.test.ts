import { describe, it, expect } from "vitest";
import {
  buildPlannedScenarioIntervals,
  buildPlannedScenarioTransitions,
  evaluatePlannedScenario,
  type PlannedScenarioChange,
  type PlannedScenarioPlayer,
} from "../scenario-evaluation";
import { getMatchPhaseWindows } from "@/lib/evidence/match-state-timeline";
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";
import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import type { MatchPhasePatternRow } from "@/lib/evidence/match-phase-pattern-evidence";
import type { OpponentTacticalTendency } from "@/lib/opponents/playing-style-aggregation";

const STARTERS: PlannedScenarioPlayer[] = [
  { playerId: "p1", position: "GK" },
  { playerId: "p2", position: "CB" },
  { playerId: "p3", position: "CM" },
  { playerId: "p4", position: "ST" },
];

function change(overrides: Partial<PlannedScenarioChange>): PlannedScenarioChange {
  return {
    outPlayerId: null,
    inPlayerId: null,
    outPosition: null,
    inPosition: null,
    positionOnly: false,
    approximateMatchSeconds: null,
    ...overrides,
  };
}

describe("buildPlannedScenarioIntervals (TEST-MATRIX §12)", () => {
  it("returns one open-ended interval when there are no timed changes", () => {
    const intervals = buildPlannedScenarioIntervals(STARTERS, [], null);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.players.map((p) => p.playerId).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("splits into two intervals across a timed substitution", () => {
    const changes = [change({ outPlayerId: "p4", inPlayerId: "p5", inPosition: "ST", approximateMatchSeconds: 1500 })];
    const intervals = buildPlannedScenarioIntervals(STARTERS, changes, 3000);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]!.players.map((p) => p.playerId)).toContain("p4");
    expect(intervals[1]!.players.map((p) => p.playerId)).toContain("p5");
    expect(intervals[1]!.players.map((p) => p.playerId)).not.toContain("p4");
  });

  it("reacts to moving a transition's time earlier (TEST-MATRIX §12 Scenario H)", () => {
    const early = buildPlannedScenarioIntervals(
      STARTERS,
      [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 600 })],
      3000,
    );
    const late = buildPlannedScenarioIntervals(
      STARTERS,
      [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 2400 })],
      3000,
    );
    expect(early[0]!.endSeconds).toBe(600);
    expect(late[0]!.endSeconds).toBe(2400);
  });

  it("reacts to changing the incoming player", () => {
    const changes = [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 })];
    const withP5 = buildPlannedScenarioIntervals(STARTERS, changes, 3000);
    changes[0]!.inPlayerId = "p6";
    const withP6 = buildPlannedScenarioIntervals(STARTERS, changes, 3000);
    expect(withP5[1]!.players.map((p) => p.playerId)).toContain("p5");
    expect(withP6[1]!.players.map((p) => p.playerId)).toContain("p6");
  });
});

describe("buildPlannedScenarioTransitions", () => {
  it("describes a plain substitution using the shared diff primitive", () => {
    const intervals = buildPlannedScenarioIntervals(
      STARTERS,
      [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 })],
      3000,
    );
    const [transition] = buildPlannedScenarioTransitions(intervals);
    expect(transition!.playersOff).toEqual(["p4"]);
    expect(transition!.playersOn).toEqual(["p5"]);
    expect(transition!.substitutionCount).toBe(1);
    expect(transition!.atSeconds).toBe(1500);
  });

  it("produces no transitions for an unchanging plan", () => {
    const intervals = buildPlannedScenarioIntervals(STARTERS, [], null);
    expect(buildPlannedScenarioTransitions(intervals)).toHaveLength(0);
  });
});

describe("evaluatePlannedScenario — reactive full evaluator (TEST-MATRIX §12)", () => {
  const leagueWindows = getMatchPhaseWindows(getLeaguePeriodConfig("LEAGUE"));

  it("attaches an OBSERVED_FACT signal for a non-insufficient partnership remaining after a transition", () => {
    const combinationEvidence: SeasonCombinationSummary[] = [
      {
        playerIds: ["p1", "p2"],
        positions: ["GK", "CB"],
        family: "PARTNERSHIP",
        subtype: "GOALKEEPER_LINK",
        totalMinutesTogether: 180,
        matchCount: 4,
        goalsForTotal: 2,
        goalsAgainstTotal: 1,
        directGoalContributionsTotal: 0,
        directAssistContributionsTotal: 0,
        opponentDiversity: 3,
        confidence: "ESTABLISHED",
        approximateTiming: false,
      },
    ];

    const result = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 })],
      totalMatchSeconds: 3000,
      combinationEvidence,
    });

    const [transition] = result.transitions;
    expect(transition!.signals.some((s) => s.kind === "OBSERVED_FACT" && s.text.includes("4 matches"))).toBe(true);
  });

  it("does not surface a signal for INSUFFICIENT-confidence evidence (limited evidence stays quiet)", () => {
    const combinationEvidence: SeasonCombinationSummary[] = [
      {
        playerIds: ["p1", "p2"],
        positions: ["GK", "CB"],
        family: "PARTNERSHIP",
        subtype: "GOALKEEPER_LINK",
        totalMinutesTogether: 14,
        matchCount: 1,
        goalsForTotal: 0,
        goalsAgainstTotal: 0,
        directGoalContributionsTotal: 0,
        directAssistContributionsTotal: 0,
        opponentDiversity: 1,
        confidence: "INSUFFICIENT",
        approximateTiming: false,
      },
    ];

    const result = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 })],
      totalMatchSeconds: 3000,
      combinationEvidence,
    });

    expect(result.transitions[0]!.signals).toHaveLength(0);
  });

  it("attaches a HISTORICAL_PATTERN signal when a transition falls inside an established match-phase window", () => {
    const matchPhasePatterns: MatchPhasePatternRow[] = [
      { period: "SECOND_HALF", phase: "FINAL_5", matches: 8, exposureMinutes: 40, goalsFor: 1, goalsAgainst: 6, confidence: "ESTABLISHED" },
    ];

    // 47 minutes in -- inside the final 5 minutes of a 50-minute league match.
    const result = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 47 * 60 })],
      totalMatchSeconds: 50 * 60,
      phaseWindows: leagueWindows,
      matchPhasePatterns,
    });

    expect(
      result.transitions[0]!.signals.some((s) => s.kind === "HISTORICAL_PATTERN" && s.text.includes("6 against")),
    ).toBe(true);
  });

  it("does not attach a pattern signal for a transition outside any established window", () => {
    const matchPhasePatterns: MatchPhasePatternRow[] = [
      { period: "SECOND_HALF", phase: "FINAL_5", matches: 8, exposureMinutes: 40, goalsFor: 1, goalsAgainst: 6, confidence: "ESTABLISHED" },
    ];

    // 30 minutes in -- well outside the final 5 minutes.
    const result = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 30 * 60 })],
      totalMatchSeconds: 50 * 60,
      phaseWindows: leagueWindows,
      matchPhasePatterns,
    });

    expect(result.transitions[0]!.signals.some((s) => s.kind === "HISTORICAL_PATTERN")).toBe(false);
  });

  it("surfaces opponent tendency as match-level context, not attached to any single transition", () => {
    const opponentTendencies: OpponentTacticalTendency[] = [
      {
        opponentTeamId: "opp1",
        tag: "HIGH_PRESSING",
        occurrences: 4,
        confidence: "ESTABLISHED",
        firstObservedAt: new Date("2026-01-01"),
        lastObservedAt: new Date("2026-04-01"),
        sourceMatchIds: ["m1", "m2", "m3", "m4"],
      },
    ];

    const result = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [],
      totalMatchSeconds: null,
      opponentTendencies,
    });

    expect(result.opponentContext).toHaveLength(1);
    expect(result.opponentContext[0]!.text).toContain("high pressing");
    expect(result.transitions.every((t) => t.signals.length === 0)).toBe(true);
  });

  it("excludes an INSUFFICIENT-confidence opponent tendency from context", () => {
    const opponentTendencies: OpponentTacticalTendency[] = [
      {
        opponentTeamId: "opp1",
        tag: "DIRECT_PLAY",
        occurrences: 1,
        confidence: "INSUFFICIENT",
        firstObservedAt: new Date("2026-01-01"),
        lastObservedAt: new Date("2026-01-01"),
        sourceMatchIds: ["m1"],
      },
    ];

    const result = evaluatePlannedScenario({ starters: STARTERS, changes: [], totalMatchSeconds: null, opponentTendencies });
    expect(result.opponentContext).toEqual([]);
  });

  it("is reactive: changing an earlier transition changes downstream signals", () => {
    const combinationEvidence: SeasonCombinationSummary[] = [
      {
        playerIds: ["p2", "p3"],
        positions: ["CB", "CM"],
        family: "PARTNERSHIP",
        subtype: "VERTICAL",
        totalMinutesTogether: 200,
        matchCount: 5,
        goalsForTotal: 0,
        goalsAgainstTotal: 0,
        directGoalContributionsTotal: 0,
        directAssistContributionsTotal: 0,
        opponentDiversity: 2,
        confidence: "ESTABLISHED",
        approximateTiming: false,
      },
    ];

    // Baseline: p2 and p3 both remain on the pitch after the (only) transition.
    const baseline = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 })],
      totalMatchSeconds: 3000,
      combinationEvidence,
    });
    expect(baseline.transitions[0]!.signals.some((s) => s.text.includes("5 matches"))).toBe(true);

    // Change: an EARLIER transition now removes p3 before the timed substitution above, so p2/p3
    // are no longer both "remaining" at that later transition.
    const changed = evaluatePlannedScenario({
      starters: STARTERS,
      changes: [
        change({ outPlayerId: "p3", inPlayerId: "p6", approximateMatchSeconds: 600 }),
        change({ outPlayerId: "p4", inPlayerId: "p5", approximateMatchSeconds: 1500 }),
      ],
      totalMatchSeconds: 3000,
      combinationEvidence,
    });
    const laterTransition = changed.transitions.find((t) => t.atSeconds === 1500);
    expect(laterTransition!.signals.some((s) => s.text.includes("5 matches"))).toBe(false);
  });
});
