import { describe, it, expect } from "vitest";
import {
  classifyDataQuality,
  computePositionSuitability,
  computeEffectivePlayerStrength,
  computeLineupStateStrengths,
  computeEncounterEvidenceFromLineupStates,
  computeWholeMatchEstimate,
  OPPONENT_ENGINE_VERSION,
  type LineupStateStrength,
} from "../opponent-engine";
import { FORMULA_VERSION } from "@/lib/opponents/sporting-level-calculation";

describe("classifyDataQuality", () => {
  it("classifies tier A when exact timeline, reliable positions, and sufficient ratings", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: true,
      hasReliableMinutes: true,
      hasReliablePositions: true,
      participantCount: 7,
      ratedParticipantCount: 5,
    });
    expect(tier).toBe("A");
  });

  it("classifies tier B when reliable minutes and positions without exact timeline", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: false,
      hasReliableMinutes: true,
      hasReliablePositions: true,
      participantCount: 7,
      ratedParticipantCount: 3,
    });
    expect(tier).toBe("B");
  });

  it("classifies tier C when participants exist but no timeline or positions", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: false,
      hasReliableMinutes: false,
      hasReliablePositions: false,
      participantCount: 7,
      ratedParticipantCount: 4,
    });
    expect(tier).toBe("C");
  });

  it("classifies tier D when no rated participants", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: true,
      hasReliableMinutes: true,
      hasReliablePositions: true,
      participantCount: 7,
      ratedParticipantCount: 0,
    });
    expect(tier).toBe("D");
  });

  it("classifies tier D when no participants", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: false,
      hasReliableMinutes: false,
      hasReliablePositions: false,
      participantCount: 0,
      ratedParticipantCount: 0,
    });
    expect(tier).toBe("D");
  });

  it("upgrades to B when minutes and positions are reliable even without timeline", () => {
    const tier = classifyDataQuality({
      hasExactTimeline: false,
      hasReliableMinutes: true,
      hasReliablePositions: true,
      participantCount: 5,
      ratedParticipantCount: 3,
    });
    expect(tier).toBe("B");
  });
});

describe("computePositionSuitability", () => {
  it("returns 1.0 for primary position match", () => {
    expect(computePositionSuitability("Midfielder", "Defender", null, "Midfielder")).toBe(1.0);
  });

  it("returns moderate for secondary position", () => {
    expect(computePositionSuitability("Midfielder", "Defender", null, "Defender")).toBe(0.85);
  });

  it("returns low for tertiary position", () => {
    expect(computePositionSuitability("Midfielder", "Defender", "Forward", "Forward")).toBe(0.7);
  });

  it("returns unsuited for unrecognized position", () => {
    expect(computePositionSuitability("Midfielder", "Defender", null, "Goalkeeper")).toBe(0.55);
  });

  it("returns low when primary position is null", () => {
    expect(computePositionSuitability(null, "Defender", null, "Defender")).toBe(0.7);
  });

  it("is case-insensitive", () => {
    expect(computePositionSuitability("midfielder", "defender", null, "MIDFIELDER")).toBe(1.0);
  });
});

describe("computeEffectivePlayerStrength", () => {
  it("uses rating times suitability when rating exists", () => {
    const strength = computeEffectivePlayerStrength({
      overallRating: 7,
      positionSuitability: 0.85,
    });
    expect(strength).toBeCloseTo(5.95, 1);
  });

  it("falls back to 5.0 times suitability when rating is null", () => {
    const strength = computeEffectivePlayerStrength({
      overallRating: null,
      positionSuitability: 0.85,
    });
    expect(strength).toBeCloseTo(4.25, 1);
  });

  it("returns full rating at primary position", () => {
    const strength = computeEffectivePlayerStrength({
      overallRating: 8,
      positionSuitability: 1.0,
    });
    expect(strength).toBe(8);
  });
});

describe("computeLineupStateStrengths", () => {
  const basePlayers = [
    { playerId: "p1", overallRating: 7, primaryPosition: "Midfielder", secondaryPosition: "Defender", tertiaryPosition: null },
    { playerId: "p2", overallRating: 6, primaryPosition: "Defender", secondaryPosition: null, tertiaryPosition: null },
    { playerId: "p3", overallRating: 8, primaryPosition: "Forward", secondaryPosition: "Midfielder", tertiaryPosition: null },
  ];

  const baseIntervals: Array<import("@/lib/live-match/live-match-types").PlayerPositionInterval> = [
    { playerId: "p1", position: "Midfielder", startedAtMs: 0, endedAtMs: 2700000 },
    { playerId: "p2", position: "Defender", startedAtMs: 0, endedAtMs: 2700000 },
    { playerId: "p3", position: "Forward", startedAtMs: 0, endedAtMs: 2700000 },
  ];

  it("computes a single state when lineup is stable", () => {
    const states = computeLineupStateStrengths(
      baseIntervals,
      [],
      basePlayers,
      2700000,
    );

    expect(states.length).toBe(1);
    expect(states[0].playerCount).toBe(3);
    expect(states[0].durationMs).toBe(2700000);
    expect(states[0].effectiveStrength).toBeGreaterThan(0);
  });

  it("associates goals with the correct lineup state", () => {
    const goals = [
      { ms: 600000, forUs: true },
      { ms: 1800000, forUs: false },
    ];

    const states = computeLineupStateStrengths(
      baseIntervals,
      goals,
      basePlayers,
      2700000,
    );

    expect(states.length).toBe(1);
    expect(states[0].weightedGoalsFor).toBe(1);
    expect(states[0].weightedGoalsAgainst).toBe(1);
  });

  it("splits into multiple states when lineup changes", () => {
    const intervals: Array<import("@/lib/live-match/live-match-types").PlayerPositionInterval> = [
      { playerId: "p1", position: "Midfielder", startedAtMs: 0, endedAtMs: 1800000 },
      { playerId: "p1", position: "Forward", startedAtMs: 1800000, endedAtMs: 2700000 },
      { playerId: "p2", position: "Defender", startedAtMs: 0, endedAtMs: 2700000 },
      { playerId: "p3", position: "Forward", startedAtMs: 0, endedAtMs: 1800000 },
      { playerId: "p3", position: "Midfielder", startedAtMs: 1800000, endedAtMs: 2700000 },
    ];

    const states = computeLineupStateStrengths(
      intervals,
      [],
      basePlayers,
      2700000,
    );

    expect(states.length).toBe(2);
    expect(states[0].startedAtMs).toBe(0);
    expect(states[1].startedAtMs).toBe(1800000);
  });

  it("returns empty array when no intervals exist", () => {
    const states = computeLineupStateStrengths([], [], [], 2700000);
    expect(states).toEqual([]);
  });

  it("handles unrated players with fallback rating", () => {
    const players = [
      { playerId: "p1", overallRating: null, primaryPosition: "Midfielder", secondaryPosition: null, tertiaryPosition: null },
    ];
    const intervals: Array<import("@/lib/live-match/live-match-types").PlayerPositionInterval> = [
      { playerId: "p1", position: "Midfielder", startedAtMs: 0, endedAtMs: 2700000 },
    ];

    const states = computeLineupStateStrengths(intervals, [], players, 2700000);

    expect(states.length).toBe(1);
    expect(states[0].effectiveStrength).toBeCloseTo(5.0, 0);
  });
});

describe("computeEncounterEvidenceFromLineupStates", () => {
  it("returns tier D result when data quality is D", () => {
    const result = computeEncounterEvidenceFromLineupStates(
      [],
      6.5,
      2,
      1,
      "D",
      null,
      null,
    );

    expect(result.dataQuality).toBe("D");
    expect(result.confidence).toBe("unknown");
    expect(result.lineupStateCount).toBe(0);
    expect(result.estimate).toBe(6.5);
  });

  it("returns match-level estimate when no lineup states exist but fielded rating is available", () => {
    const result = computeEncounterEvidenceFromLineupStates(
      [],
      7.0,
      3,
      1,
      "B",
      null,
      null,
    );

    expect(result.estimate).toBeGreaterThan(0);
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.engineVersion).toBe(OPPONENT_ENGINE_VERSION);
    expect(result.dataQuality).toBe("B");
    expect(result.confidence).toBe("medium");
    expect(result.lineupStateCount).toBe(0);
  });

  it("produces different estimates for different lineup states with same final score", () => {
    const strongState: LineupStateStrength = {
      startedAtMs: 0,
      endedAtMs: 1800000,
      durationMs: 1800000,
      effectiveStrength: 7.5,
      weightedGoalsFor: 0,
      weightedGoalsAgainst: 3,
      playerCount: 7,
      dataQuality: "A",
    };

    const weakState: LineupStateStrength = {
      startedAtMs: 1800000,
      endedAtMs: 2700000,
      durationMs: 900000,
      effectiveStrength: 4.0,
      weightedGoalsFor: 2,
      weightedGoalsAgainst: 0,
      playerCount: 7,
      dataQuality: "A",
    };

    const result = computeEncounterEvidenceFromLineupStates(
      [strongState, weakState],
      6.5,
      2,
      3,
      "A",
      null,
      null,
    );

    expect(result.lineupStateCount).toBe(2);
    expect(result.dominantLineupStrength).toBe(7.5);
    expect(result.confidence).toBe("high");
    expect(result.estimate).toBeGreaterThan(0);
  });

  it("adds lineup variability context when states differ significantly", () => {
    const states: LineupStateStrength[] = [
      {
        startedAtMs: 0,
        endedAtMs: 1350000,
        durationMs: 1350000,
        effectiveStrength: 8.0,
        weightedGoalsFor: 2,
        weightedGoalsAgainst: 0,
        playerCount: 7,
        dataQuality: "A",
      },
      {
        startedAtMs: 1350000,
        endedAtMs: 2700000,
        durationMs: 1350000,
        effectiveStrength: 5.5,
        weightedGoalsFor: 0,
        weightedGoalsAgainst: 3,
        playerCount: 7,
        dataQuality: "A",
      },
    ];

    const result = computeEncounterEvidenceFromLineupStates(
      states,
      6.5,
      2,
      3,
      "A",
      null,
      null,
    );

    const variabilitySignal = result.contextSignals.find(
      (s) => s.type === "lineup_state_variability",
    );
    expect(variabilitySignal).toBeDefined();
    expect(variabilitySignal!.influence).toBe("context");
  });

  it("adds match environment context signal when present", () => {
    const result = computeEncounterEvidenceFromLineupStates(
      [],
      6.5,
      2,
      1,
      "B",
      "POSITIVE",
      null,
    );

    const envSignal = result.contextSignals.find(
      (s) => s.type === "match_environment",
    );
    expect(envSignal).toBeDefined();
    expect(envSignal!.value).toBe("POSITIVE");
  });

  it("adds match fit context signal for non-good-fit values", () => {
    const result = computeEncounterEvidenceFromLineupStates(
      [],
      6.5,
      2,
      1,
      "B",
      null,
      "TOO_HARD",
    );

    const fitSignal = result.contextSignals.find(
      (s) => s.type === "match_fit",
    );
    expect(fitSignal).toBeDefined();
    expect(fitSignal!.value).toBe("TOO_HARD");
  });

  it("does not add match fit signal for GOOD_FIT", () => {
    const result = computeEncounterEvidenceFromLineupStates(
      [],
      6.5,
      2,
      1,
      "A",
      null,
      "GOOD_FIT",
    );

    const fitSignal = result.contextSignals.find(
      (s) => s.type === "match_fit",
    );
    expect(fitSignal).toBeUndefined();
  });
});

describe("computeWholeMatchEstimate", () => {
  it("computes estimate from fielded rating and goals", () => {
    const result = computeWholeMatchEstimate(
      7.0,
      3,
      1,
      7,
      5,
      null,
      "B",
      null,
    );

    expect(result.estimate).toBeGreaterThan(0);
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.engineVersion).toBe(OPPONENT_ENGINE_VERSION);
  });

  it("returns fallback estimate when fielded rating is null", () => {
    const result = computeWholeMatchEstimate(
      null,
      2,
      1,
      7,
      0,
      null,
      "C",
      null,
    );

    expect(result.estimate).toBe(5.0);
    expect(result.confidence).toBe("unknown");
  });

  it("downgrades tier A to B for whole-match estimate", () => {
    const result = computeWholeMatchEstimate(
      6.5,
      2,
      1,
      7,
      5,
      null,
      "A",
      null,
    );

    expect(result.dataQuality).toBe("B");
  });

  it("preserves lower data quality tiers", () => {
    const result = computeWholeMatchEstimate(
      6.5,
      2,
      1,
      7,
      3,
      null,
      "C",
      null,
    );

    expect(result.dataQuality).toBe("C");
  });
});

describe("calibration gate: same score different lineup timing", () => {
  it("produces different per-state estimates when goals are conceded against different strength lineups", () => {
    const strongConcede4: LineupStateStrength = {
      startedAtMs: 0,
      endedAtMs: 1350000,
      durationMs: 1350000,
      effectiveStrength: 6.7,
      weightedGoalsFor: 1,
      weightedGoalsAgainst: 4,
      playerCount: 7,
      dataQuality: "A",
    };

    const weakScore0: LineupStateStrength = {
      startedAtMs: 1350000,
      endedAtMs: 2700000,
      durationMs: 1350000,
      effectiveStrength: 5.2,
      weightedGoalsFor: 0,
      weightedGoalsAgainst: 0,
      playerCount: 7,
      dataQuality: "A",
    };

    const result1 = computeEncounterEvidenceFromLineupStates(
      [strongConcede4, weakScore0],
      6.5,
      1,
      4,
      "A",
      null,
      null,
    );

    expect(result1.estimate).toBeGreaterThan(0);
    expect(result1.lineupStateCount).toBe(2);
    expect(result1.dominantLineupStrength).toBe(6.7);

    const weakConcede4: LineupStateStrength = {
      startedAtMs: 0,
      endedAtMs: 1350000,
      durationMs: 1350000,
      effectiveStrength: 5.2,
      weightedGoalsFor: 0,
      weightedGoalsAgainst: 4,
      playerCount: 7,
      dataQuality: "A",
    };

    const strongScore1: LineupStateStrength = {
      startedAtMs: 1350000,
      endedAtMs: 2700000,
      durationMs: 1350000,
      effectiveStrength: 6.7,
      weightedGoalsFor: 1,
      weightedGoalsAgainst: 0,
      playerCount: 7,
      dataQuality: "A",
    };

    const result2 = computeEncounterEvidenceFromLineupStates(
      [weakConcede4, strongScore1],
      6.5,
      1,
      4,
      "A",
      null,
      null,
    );

    expect(result2.lineupStateCount).toBe(2);
    expect(result2.dominantLineupStrength).toBe(5.2);

    expect(result1.estimate).not.toBeCloseTo(result2.estimate, 1);
  });

  it("produces different overall estimates when lineup duration weights are unequal", () => {
    const longStrong: LineupStateStrength = {
      startedAtMs: 0,
      endedAtMs: 2200000,
      durationMs: 2200000,
      effectiveStrength: 7.0,
      weightedGoalsFor: 2,
      weightedGoalsAgainst: 1,
      playerCount: 7,
      dataQuality: "A",
    };

    const shortWeak: LineupStateStrength = {
      startedAtMs: 2200000,
      endedAtMs: 2700000,
      durationMs: 500000,
      effectiveStrength: 4.5,
      weightedGoalsFor: 0,
      weightedGoalsAgainst: 2,
      playerCount: 7,
      dataQuality: "A",
    };

    const resultLongStrong = computeEncounterEvidenceFromLineupStates(
      [longStrong, shortWeak],
      6.5,
      2,
      3,
      "A",
      null,
      null,
    );

    const longWeak: LineupStateStrength = {
      startedAtMs: 0,
      endedAtMs: 2200000,
      durationMs: 2200000,
      effectiveStrength: 4.5,
      weightedGoalsFor: 0,
      weightedGoalsAgainst: 2,
      playerCount: 7,
      dataQuality: "A",
    };

    const shortStrong: LineupStateStrength = {
      startedAtMs: 2200000,
      endedAtMs: 2700000,
      durationMs: 500000,
      effectiveStrength: 7.0,
      weightedGoalsFor: 2,
      weightedGoalsAgainst: 1,
      playerCount: 7,
      dataQuality: "A",
    };

    const resultLongWeak = computeEncounterEvidenceFromLineupStates(
      [longWeak, shortStrong],
      6.5,
      2,
      3,
      "A",
      null,
      null,
    );

    expect(resultLongStrong.estimate).not.toBeCloseTo(resultLongWeak.estimate, 1);
  });
});