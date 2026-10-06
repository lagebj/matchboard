import { describe, it, expect } from "vitest";
import type { MatchPeriod } from "@/generated/prisma/client";
import type { MatchPhaseWindow } from "@/lib/evidence/match-state-timeline";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import { buildMatchRhythmPatterns, buildCombinationPatterns, type MatchRhythmSample } from "@/lib/team-season-profile/pattern-catalogue";

const FIRST_HALF = "FIRST_HALF" as MatchPeriod;
const SECOND_HALF = "SECOND_HALF" as MatchPeriod;

function goal(matchMs: number, team: "FOR" | "AGAINST", approximateTiming = false): GoalAttributionEvent {
  return { matchMs, team, scorerPlayerId: null, assistPlayerId: null, approximateTiming };
}

function standardPhaseWindows(): MatchPhaseWindow[] {
  // A 25-minute-half league match (REGULATION_ONLY_PERIOD_CONFIG's default) --
  // opening-10 for each half, immediately-after-restart for the second half, final-10 for the
  // second half only (it is the final period).
  return [
    { key: "OPENING_10", period: FIRST_HALF, startMs: 0, endMs: 600_000 },
    { key: "OPENING_10", period: SECOND_HALF, startMs: 1_500_000, endMs: 2_100_000 },
    { key: "IMMEDIATELY_AFTER_RESTART", period: SECOND_HALF, startMs: 1_500_000, endMs: 1_800_000 },
    { key: "FINAL_10", period: SECOND_HALF, startMs: 2_400_000, endMs: 3_000_000 },
  ];
}

function sample(matchId: string, startsAt: Date, goalEvents: GoalAttributionEvent[]): MatchRhythmSample {
  return { matchId, startsAt, goalEvents, phaseWindows: standardPhaseWindows(), totalExposureMinutes: 50 };
}

describe("team-season-profile/pattern-catalogue — match rhythm", () => {
  it("surfaces nothing with fewer than 3 matches (INSUFFICIENT)", () => {
    const samples = [
      sample("m1", new Date("2026-08-01"), [goal(60_000, "FOR"), goal(90_000, "FOR")]),
      sample("m2", new Date("2026-08-08"), [goal(60_000, "FOR"), goal(90_000, "FOR")]),
    ];
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    expect(patterns.find((p) => p.key === "rhythm:opening-first-half:for")).toBeUndefined();
  });

  it("surfaces an EMERGING opening-for pattern at 3-5 matches with concentrated goals", () => {
    const samples = [
      sample("m1", new Date("2026-08-01"), [goal(60_000, "FOR")]),
      sample("m2", new Date("2026-08-08"), [goal(60_000, "FOR")]),
      sample("m3", new Date("2026-08-15"), [goal(60_000, "FOR")]),
    ];
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    const pattern = patterns.find((p) => p.key === "rhythm:opening-first-half:for");
    expect(pattern?.evidenceStrength).toBe("EMERGING");
  });

  it("surfaces an ESTABLISHED opening-for pattern at 6+ matches", () => {
    const samples = Array.from({ length: 6 }, (_, i) => sample(`m${i}`, new Date(2026, 7, i + 1), [goal(60_000, "FOR")]));
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    const pattern = patterns.find((p) => p.key === "rhythm:opening-first-half:for");
    expect(pattern?.evidenceStrength).toBe("ESTABLISHED");
  });

  it("does not surface a pattern from a single isolated event even if the raw percentage is high", () => {
    const samples = [
      sample("m1", new Date("2026-08-01"), [goal(60_000, "FOR")]),
      sample("m2", new Date("2026-08-08"), []),
      sample("m3", new Date("2026-08-15"), []),
      sample("m4", new Date("2026-08-22"), []),
    ];
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    expect(patterns.find((p) => p.key === "rhythm:opening-first-half:for")).toBeUndefined();
  });

  it("keeps first-half-opening and restart-opening windows distinct", () => {
    const samples = Array.from({ length: 4 }, (_, i) =>
      sample(`m${i}`, new Date(2026, 7, i + 1), [goal(60_000, "FOR"), goal(1_550_000, "FOR")]),
    );
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    const firstHalf = patterns.find((p) => p.key === "rhythm:opening-first-half:for");
    const restart = patterns.find((p) => p.key === "rhythm:opening-restart:for");
    expect(firstHalf).toBeDefined();
    expect(restart).toBeDefined();
    expect(firstHalf?.key).not.toBe(restart?.key);
  });

  it("uses the configured final period, not a fixed 90-minute assumption", () => {
    const samples = Array.from({ length: 4 }, (_, i) => sample(`m${i}`, new Date(2026, 7, i + 1), [goal(2_450_000, "FOR")]));
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    expect(patterns.find((p) => p.key === "rhythm:late-final:for")).toBeDefined();
  });

  it("marks approximate timing when a contributing goal event has approximate timing", () => {
    const samples = Array.from({ length: 4 }, (_, i) => sample(`m${i}`, new Date(2026, 7, i + 1), [goal(60_000, "FOR", true)]));
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    expect(patterns.find((p) => p.key === "rhythm:opening-first-half:for")?.approximateTiming).toBe(true);
  });

  it("requires at least 4 matches with an identifiable first goal before surfacing first-goal-direction", () => {
    const samples = [
      sample("m1", new Date("2026-08-01"), [goal(1000, "FOR")]),
      sample("m2", new Date("2026-08-08"), [goal(1000, "FOR")]),
      sample("m3", new Date("2026-08-15"), [goal(1000, "AGAINST")]),
    ];
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    expect(patterns.find((p) => p.key === "rhythm:first-goal-direction")).toBeUndefined();
  });

  it("counts scored-first vs conceded-first once 4+ matches have an identifiable first goal", () => {
    const samples = [
      sample("m1", new Date("2026-08-01"), [goal(1000, "FOR"), goal(500_000, "AGAINST")]),
      sample("m2", new Date("2026-08-08"), [goal(1000, "FOR")]),
      sample("m3", new Date("2026-08-15"), [goal(1000, "AGAINST")]),
      sample("m4", new Date("2026-08-22"), [goal(1000, "FOR")]),
    ];
    const patterns = buildMatchRhythmPatterns(samples, new Set());
    const pattern = patterns.find((p) => p.key === "rhythm:first-goal-direction");
    expect(pattern?.metrics.scoredFirst).toBe(3);
    expect(pattern?.metrics.concededFirst).toBe(1);
  });
});

describe("team-season-profile/pattern-catalogue — combinations", () => {
  function combinationRow(overrides: Partial<CombinationEvidenceRow>): CombinationEvidenceRow {
    return {
      id: "row1",
      organisationId: "org1",
      matchId: "m1",
      eventMatchId: null,
      family: "CORRIDOR",
      subtype: "RIGHT",
      playerIds: ["p2", "p1"],
      positions: ["RW", "RB"],
      minutesTogether: 30,
      goalsForWhilePresent: 1,
      goalsAgainstWhilePresent: 0,
      directGoalContributions: 1,
      directAssistContributions: 0,
      opponentDiversity: 1,
      confidence: "EMERGING",
      approximateTiming: false,
      leagueSeasonId: "season1",
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("reuses aggregated season combination confidence verbatim (no second scoring system)", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 50, opponentDiversity: 1 }),
      combinationRow({ matchId: "m2", minutesTogether: 50, opponentDiversity: 1 }),
      combinationRow({ matchId: "m3", minutesTogether: 50, opponentDiversity: 1 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
        ["m3", "opp2"],
      ]),
      recentMatchIds: new Set(["m3"]),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    const corridor = patterns.find((p) => p.family === "COMBINATION" && p.subtype.startsWith("CORRIDOR"));
    expect(corridor).toBeDefined();
    expect(corridor?.evidenceStrength).toBe("EMERGING");
    expect(corridor?.subjects.corridor).toBe("RIGHT");
    expect(corridor?.subjects.playerIds).toEqual(["p1", "p2"]);
  });

  it("excludes an INSUFFICIENT combination from the surfaced patterns", () => {
    const rows = [combinationRow({ matchId: "m1", minutesTogether: 10, matchCount: 1 } as never)];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map(),
      recentMatchIds: new Set(),
      matchDatesById: new Map([["m1", new Date("2026-08-01")]]),
    });
    expect(patterns).toHaveLength(0);
  });

  it("preserves opponent diversity in the sample", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 70 }),
      combinationRow({ matchId: "m2", minutesTogether: 70 }),
      combinationRow({ matchId: "m3", minutesTogether: 70 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
        ["m3", "opp3"],
      ]),
      recentMatchIds: new Set(),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    const corridor = patterns.find((p) => p.family === "COMBINATION");
    expect(corridor?.sample.opponentDiversity).toBe(3);
  });

  it("preserves the approximate-timing marker", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 70, approximateTiming: true }),
      combinationRow({ matchId: "m2", minutesTogether: 70 }),
      combinationRow({ matchId: "m3", minutesTogether: 70 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
      ]),
      recentMatchIds: new Set(),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    expect(patterns.find((p) => p.family === "COMBINATION")?.approximateTiming).toBe(true);
  });

  it("copies goals for/against descriptively without deriving a chemistry score", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 70, goalsForWhilePresent: 4, goalsAgainstWhilePresent: 2 }),
      combinationRow({ matchId: "m2", minutesTogether: 70, goalsForWhilePresent: 1, goalsAgainstWhilePresent: 0 }),
      combinationRow({ matchId: "m3", minutesTogether: 70, goalsForWhilePresent: 1, goalsAgainstWhilePresent: 1 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
      ]),
      recentMatchIds: new Set(),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    const pattern = patterns.find((p) => p.family === "COMBINATION");
    expect(pattern?.metrics.goalsForWhilePresent).toBe(6);
    expect(pattern?.metrics.goalsAgainstWhilePresent).toBe(3);
    expect(Object.keys(pattern?.metrics ?? {})).not.toContain("chemistryScore");
  });

  it("keeps the same combination key stable across matches despite player ordering", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 70, playerIds: ["p1", "p2"] }),
      combinationRow({ matchId: "m2", minutesTogether: 70, playerIds: ["p2", "p1"] }),
      combinationRow({ matchId: "m3", minutesTogether: 70, playerIds: ["p1", "p2"] }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
      ]),
      recentMatchIds: new Set(),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    expect(patterns).toHaveLength(1);
  });

  it("excludes FULL_CONFIGURATION from the surfaced combination patterns", () => {
    const rows = [
      combinationRow({ matchId: "m1", family: "FULL_CONFIGURATION", subtype: null, minutesTogether: 200 }),
      combinationRow({ matchId: "m2", family: "FULL_CONFIGURATION", subtype: null, minutesTogether: 200 }),
      combinationRow({ matchId: "m3", family: "FULL_CONFIGURATION", subtype: null, minutesTogether: 200 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
      ]),
      recentMatchIds: new Set(),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    expect(patterns).toHaveLength(0);
  });

  it("classifies trajectory as NEW when the combination only appears in the recent window", () => {
    const rows = [
      combinationRow({ matchId: "m1", minutesTogether: 70 }),
      combinationRow({ matchId: "m2", minutesTogether: 70 }),
      combinationRow({ matchId: "m3", minutesTogether: 70 }),
    ];
    const patterns = buildCombinationPatterns({
      evidenceRows: rows,
      opponentByMatch: new Map([
        ["m1", "opp1"],
        ["m2", "opp2"],
      ]),
      recentMatchIds: new Set(["m1", "m2", "m3"]),
      matchDatesById: new Map([
        ["m1", new Date("2026-08-01")],
        ["m2", new Date("2026-08-08")],
        ["m3", new Date("2026-08-15")],
      ]),
    });
    expect(patterns.find((p) => p.family === "COMBINATION")?.trajectory).toBe("NEW");
  });
});
