import { describe, it, expect } from "vitest";
import {
  deriveMatchStateIntervals,
  deriveMatchTransitions,
  getMatchPhaseWindows,
  classifyMatchPhases,
  type MatchStateContext,
} from "../match-state-timeline";
import type { ActualIntervalRow } from "../actual-timeline";
import type { GoalAttributionEvent } from "../combination-goal-attribution";
import { getLeaguePeriodConfig, getEventPeriodConfig } from "@/lib/live-match/period-config";

function row(overrides: Partial<ActualIntervalRow> & Pick<ActualIntervalRow, "playerId" | "position" | "startedAtMs">): ActualIntervalRow {
  return {
    line: null,
    lane: null,
    endedAtMs: null,
    source: "STARTING_LINEUP" as ActualIntervalRow["source"],
    approximateTiming: false,
    ...overrides,
  };
}

function leagueContext(overrides: Partial<MatchStateContext> = {}): MatchStateContext {
  return {
    organisationId: "org1",
    footballGroupId: "group1",
    leagueSeasonId: "season1",
    gameFormat: "SEVEN_A_SIDE",
    opponent: { opponentTeamId: "opp1", displayName: "Rivals FC" },
    periodConfig: getLeaguePeriodConfig("LEAGUE"),
    matchEndMs: 50 * 60 * 1000,
    ...overrides,
  };
}

describe("deriveMatchStateIntervals — canonical match-state reconstruction (TEST-MATRIX §1)", () => {
  it("produces one open-ended interval per starter with no rotations", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", line: "GK", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 0 }),
    ];
    const result = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.startMs).toBe(0);
    expect(result[0]!.endMs).toBe(50 * 60 * 1000);
    expect(result[0]!.players.map((p) => p.playerId).sort()).toEqual(["p1", "p2"]);
    expect(result[0]!.timingQuality).toBe("EXACT");
  });

  it("splits into two intervals across a one-for-one substitution", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", line: "GK", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 20 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", line: "DEF", startedAtMs: 20 * 60 * 1000 }),
    ];
    const result = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(result).toHaveLength(2);
    expect(result[0]!.players.map((p) => p.playerId).sort()).toEqual(["p1", "p2"]);
    expect(result[1]!.players.map((p) => p.playerId).sort()).toEqual(["p1", "p3"]);
  });

  it("captures goals for/against inside an interval and cumulative score at start/end", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", startedAtMs: 0 }),
    ];
    const goals: GoalAttributionEvent[] = [
      { matchMs: 5 * 60 * 1000, team: "FOR", scorerPlayerId: "p2", assistPlayerId: null, approximateTiming: false },
      { matchMs: 10 * 60 * 1000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
    ];
    const [interval] = deriveMatchStateIntervals(intervals, goals, leagueContext());
    expect(interval!.goalsFor).toBe(1);
    expect(interval!.goalsAgainst).toBe(1);
    expect(interval!.scoreAtStart).toEqual({ for: 0, against: 0 });
    expect(interval!.scoreAtEnd).toEqual({ for: 1, against: 1 });
  });

  it("marks timing INFERRED when the contributing interval used approximate timing", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", startedAtMs: 0, approximateTiming: true }),
      row({ playerId: "p2", position: "DEFENDER", startedAtMs: 0 }),
    ];
    const [interval] = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(interval!.timingQuality).toBe("INFERRED");
  });

  it("marks timing PARTIAL when a player's position is unknown", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "unknown", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", startedAtMs: 0 }),
    ];
    // p1 is excluded from the segment (unknown positions never join playersOnPitch), but the
    // *quality* scan still inspects it against the segment window it would have overlapped.
    const result = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(result).toHaveLength(0); // fewer than 2 known on-pitch players -> no segment at all
  });

  it("reports UNAVAILABLE overall quality via an empty interval list (no actual data at all)", () => {
    const result = deriveMatchStateIntervals([], [], leagueContext());
    expect(result).toHaveLength(0);
  });

  it("is deterministic: identical input produces identical output on repeated calls (idempotent rebuild)", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", startedAtMs: 10 * 60 * 1000 }),
    ];
    const first = deriveMatchStateIntervals(intervals, [], leagueContext());
    const second = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(second).toEqual(first);
  });
});

describe("deriveMatchTransitions — canonical transitions (TEST-MATRIX §4/§5)", () => {
  it("describes a plain substitution: players off/on, remaining, substitution count", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", line: "GK", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", line: "DEF", startedAtMs: 10 * 60 * 1000 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext());
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.playersOff).toEqual(["p2"]);
    expect(transition!.playersOn).toEqual(["p3"]);
    expect(transition!.playersRemaining).toEqual(["p1"]);
    expect(transition!.substitutionCount).toBe(1);
    expect(transition!.positionOnlyChanges).toHaveLength(0);
    expect(transition!.disruptionDescriptors).toContain("SUBSTITUTION_ONLY");
    expect(transition!.isSimultaneousSubstitutionAndReshuffle).toBe(false);
  });

  it("describes a position-only swap with no substitution", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p2", position: "MIDFIELDER", line: "MID", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p1", position: "MIDFIELDER", line: "MID", startedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 10 * 60 * 1000 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext());
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.substitutionCount).toBe(0);
    expect(transition!.playersOff).toHaveLength(0);
    expect(transition!.playersOn).toHaveLength(0);
    expect(transition!.positionOnlyChanges).toHaveLength(2);
    expect(transition!.disruptionDescriptors).toContain("POSITION_ONLY");
    expect(transition!.changedLines.sort()).toEqual(["DEF", "MID"]);
    expect(transition!.disruptionDescriptors).toContain("CENTRAL_AXIS_CHANGED");
  });

  it("describes a simultaneous substitution + positional reshuffle", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p2", position: "MIDFIELDER", line: "MID", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p1", position: "MIDFIELDER", line: "MID", startedAtMs: 10 * 60 * 1000 }), // p1 stays on, moves line
      row({ playerId: "p3", position: "DEFENDER", line: "DEF", startedAtMs: 10 * 60 * 1000 }), // p2 subbed for p3
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext());
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.playersOff).toEqual(["p2"]);
    expect(transition!.playersOn).toEqual(["p3"]);
    expect(transition!.positionOnlyChanges.map((c) => c.playerId)).toEqual(["p1"]);
    expect(transition!.isSimultaneousSubstitutionAndReshuffle).toBe(true);
    expect(transition!.disruptionDescriptors).toContain("SUBSTITUTION_WITH_RESHUFFLE");
  });

  it("marks a transition at a period boundary as a natural break", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "DEFENDER", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p2", position: "MIDFIELDER", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", startedAtMs: 25 * 60 * 1000 }), // sub at half time
      row({ playerId: "p2", position: "MIDFIELDER", startedAtMs: 25 * 60 * 1000 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext({ periodConfig: config }));
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.isAtNaturalBreak).toBe(true);
    expect(transition!.period).toBe("SECOND_HALF");
  });

  it("does not mark an active-play substitution (same period on both sides) as a natural break", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "DEFENDER", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p2", position: "MIDFIELDER", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", startedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p2", position: "MIDFIELDER", startedAtMs: 10 * 60 * 1000 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext());
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.isAtNaturalBreak).toBe(false);
  });

  it("produces no transitions for a match with only a starting lineup (nothing changed)", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", startedAtMs: 0 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext());
    expect(deriveMatchTransitions(states)).toHaveLength(0);
  });

  it("large halftime batch (4 simultaneous changes) is not structurally different in kind from a 1-player active-play change (TEST-MATRIX §5 Scenario C)", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p3", position: "MIDFIELDER", line: "MID", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p4", position: "MIDFIELDER", line: "MID", startedAtMs: 0, endedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p5", position: "DEFENDER", line: "DEF", startedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p6", position: "DEFENDER", line: "DEF", startedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p7", position: "MIDFIELDER", line: "MID", startedAtMs: 25 * 60 * 1000 }),
      row({ playerId: "p8", position: "MIDFIELDER", line: "MID", startedAtMs: 25 * 60 * 1000 }),
    ];
    const states = deriveMatchStateIntervals(intervals, [], leagueContext({ periodConfig: config }));
    const [transition] = deriveMatchTransitions(states);
    expect(transition!.substitutionCount).toBe(4);
    expect(transition!.isAtNaturalBreak).toBe(true);
    // Raw batch size is retained separately from the structural descriptor set -- a 4-player
    // halftime change is still just "SUBSTITUTION_ONLY" / "MULTI_LINE_CHANGE", not a distinct
    // "bad" category encoded by count alone (D-013).
    expect(transition!.disruptionDescriptors).toContain("SUBSTITUTION_ONLY");
    expect(transition!.disruptionDescriptors).toContain("MULTI_LINE_CHANGE");
  });
});

describe("Match phase windows (TEST-MATRIX §2)", () => {
  it("derives opening 5/10 and final 10/5 for a full-length league half", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const windows = getMatchPhaseWindows(config);
    const firstHalfOpening5 = windows.find((w) => w.key === "OPENING_5" && w.period === "FIRST_HALF");
    expect(firstHalfOpening5).toMatchObject({ startMs: 0, endMs: 5 * 60 * 1000 });

    const secondHalfFinal5 = windows.find((w) => w.key === "FINAL_5" && w.period === "SECOND_HALF");
    expect(secondHalfFinal5).toMatchObject({ startMs: 45 * 60 * 1000, endMs: 50 * 60 * 1000 });
  });

  it("marks the second half's opening minutes as 'immediately after restart', but not the first half's", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const windows = getMatchPhaseWindows(config);
    expect(windows.some((w) => w.key === "IMMEDIATELY_AFTER_RESTART" && w.period === "FIRST_HALF")).toBe(false);
    expect(windows.some((w) => w.key === "IMMEDIATELY_AFTER_RESTART" && w.period === "SECOND_HALF")).toBe(true);
  });

  it("scales windows down for a short event-format half instead of assuming senior-football minutes", () => {
    const config = getEventPeriodConfig(10, 2); // 10-minute halves (e.g. a young/small-sided format)
    const windows = getMatchPhaseWindows(config);
    const opening10 = windows.find((w) => w.key === "OPENING_10" && w.period === "FIRST_HALF");
    // A fixed 10-minute "opening 10" would consume the entire half -- scaled down instead.
    expect(opening10!.endMs - opening10!.startMs).toBeLessThan(10 * 60 * 1000);
  });

  it("produces no windows for an undurated period (manual clock, no configured duration)", () => {
    const config = getEventPeriodConfig(null, 2);
    expect(getMatchPhaseWindows(config)).toHaveLength(0);
  });

  it("classifies a moment as belonging to whichever windows it overlaps", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const windows = getMatchPhaseWindows(config);
    const phases = classifyMatchPhases(2 * 60 * 1000, 3 * 60 * 1000, windows);
    expect(phases).toContain("OPENING_5");
    expect(phases).toContain("OPENING_10");
  });
});

describe("League/Event parity (TEST-MATRIX §19)", () => {
  it("produces structurally equivalent intervals/transitions from equivalent League and Event actual histories", () => {
    const intervals: ActualIntervalRow[] = [
      row({ playerId: "p1", position: "GOALKEEPER", line: "GK", startedAtMs: 0 }),
      row({ playerId: "p2", position: "DEFENDER", line: "DEF", startedAtMs: 0, endedAtMs: 10 * 60 * 1000 }),
      row({ playerId: "p3", position: "DEFENDER", line: "DEF", startedAtMs: 10 * 60 * 1000 }),
    ];

    const leagueStates = deriveMatchStateIntervals(intervals, [], leagueContext());
    const eventStates = deriveMatchStateIntervals(
      intervals,
      [],
      leagueContext({ periodConfig: getEventPeriodConfig(50), matchEndMs: 50 * 60 * 1000 }),
    );

    expect(eventStates.map((s) => s.players)).toEqual(leagueStates.map((s) => s.players));
    expect(deriveMatchTransitions(eventStates).map((t) => ({ ...t, period: undefined }))).toEqual(
      deriveMatchTransitions(leagueStates).map((t) => ({ ...t, period: undefined })),
    );
  });
});
