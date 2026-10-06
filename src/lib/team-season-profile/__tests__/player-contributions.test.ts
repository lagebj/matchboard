import { describe, it, expect } from "vitest";
import { buildPlayerContributionPatterns, type PlayerMatchExposure } from "@/lib/team-season-profile/player-contributions";
import type { MatchRhythmSample } from "@/lib/team-season-profile/pattern-catalogue";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";

function goal(scorerPlayerId: string | null, assistPlayerId: string | null, matchMs = 1000): GoalAttributionEvent {
  return { matchMs, team: "FOR", scorerPlayerId, assistPlayerId, approximateTiming: false };
}

function sampleWithGoals(matchId: string, startsAt: string, goalEvents: GoalAttributionEvent[]): MatchRhythmSample {
  return { matchId, startsAt: new Date(startsAt), goalEvents, phaseWindows: [], totalExposureMinutes: 50 };
}

function exposure(matchId: string, startsAt: string, playerId: string, minutesPlayed: number, position = "FORWARD"): PlayerMatchExposure {
  return { matchId, startsAt: new Date(startsAt), playerId, minutesPlayed, intervals: [{ position, startedAtMs: 0, endedAtMs: 3_000_000 }] };
}

describe("team-season-profile/player-contributions", () => {
  it("requires actual exposure: under 60 minutes stays INSUFFICIENT even with events", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal("p1", null)]),
      sampleWithGoals("m2", "2026-08-08", [goal("p1", null)]),
      sampleWithGoals("m3", "2026-08-15", [goal("p1", null)]),
    ];
    const exposures = [exposure("m1", "2026-08-01", "p1", 10), exposure("m2", "2026-08-08", "p1", 10), exposure("m3", "2026-08-15", "p1", 10)];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    expect(patterns).toHaveLength(0);
  });

  it("surfaces an EMERGING goal pattern at >=3 matches, >=60 minutes, >=2 goals", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal("p1", null)]),
      sampleWithGoals("m2", "2026-08-08", [goal("p1", null)]),
      sampleWithGoals("m3", "2026-08-15", [goal(null, null)]),
    ];
    const exposures = [exposure("m1", "2026-08-01", "p1", 30), exposure("m2", "2026-08-08", "p1", 30), exposure("m3", "2026-08-15", "p1", 30)];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    const pattern = patterns.find((p) => p.key === "player:p1:goal-contribution");
    expect(pattern?.evidenceStrength).toBe("EMERGING");
  });

  it("never assigns an unattributed (null scorer) goal to any player", () => {
    const samples = [sampleWithGoals("m1", "2026-08-01", [goal(null, null)])];
    const exposures: PlayerMatchExposure[] = [];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    expect(patterns).toHaveLength(0);
  });

  it("excludes a guest player id even if it appears as a scorer", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal("guest1", null)]),
      sampleWithGoals("m2", "2026-08-08", [goal("guest1", null)]),
      sampleWithGoals("m3", "2026-08-15", [goal("guest1", null)]),
    ];
    const exposures = [
      exposure("m1", "2026-08-01", "guest1", 30),
      exposure("m2", "2026-08-08", "guest1", 30),
      exposure("m3", "2026-08-15", "guest1", 30),
    ];
    // realPlayerIds deliberately excludes "guest1"
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    expect(patterns).toHaveLength(0);
  });

  it("produces no teammate ranking (patterns are per-player, order is key-based, not rank-based)", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal("p1", null), goal("p2", null)]),
      sampleWithGoals("m2", "2026-08-08", [goal("p1", null), goal("p2", null)]),
      sampleWithGoals("m3", "2026-08-15", [goal("p1", null), goal("p2", null)]),
    ];
    const exposures = [
      exposure("m1", "2026-08-01", "p1", 30),
      exposure("m2", "2026-08-08", "p1", 30),
      exposure("m3", "2026-08-15", "p1", 30),
      exposure("m1", "2026-08-01", "p2", 30),
      exposure("m2", "2026-08-08", "p2", 30),
      exposure("m3", "2026-08-15", "p2", 30),
    ];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1", "p2"]), new Set());
    const metricsKeys = patterns.flatMap((p) => Object.keys(p.metrics));
    expect(metricsKeys).not.toContain("rank");
    expect(metricsKeys).not.toContain("leagueRank");
  });

  it("includes a position-context clause only when every contributing event resolves to a position", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal(null, "p1", 500)]),
      sampleWithGoals("m2", "2026-08-08", [goal(null, "p1", 500)]),
      sampleWithGoals("m3", "2026-08-15", [goal(null, "p1", 500)]),
    ];
    const exposures = [
      exposure("m1", "2026-08-01", "p1", 30, "RIGHT_WING"),
      exposure("m2", "2026-08-08", "p1", 30, "RIGHT_WING"),
      exposure("m3", "2026-08-15", "p1", 30, "RIGHT_WING"),
    ];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    const pattern = patterns.find((p) => p.key === "player:p1:assist-contribution");
    expect(pattern?.metrics.dominantPosition).toBe("RIGHT_WING");
    expect(pattern?.metrics.dominantPositionCount).toBe(3);
  });

  it("omits the position-context clause when resolution is incomplete", () => {
    const samples = [
      sampleWithGoals("m1", "2026-08-01", [goal(null, "p1", 500)]),
      sampleWithGoals("m2", "2026-08-08", [goal(null, "p1", 500)]),
      sampleWithGoals("m3", "2026-08-15", [goal(null, "p1", 9_999_999)]), // outside the only interval
    ];
    const exposures = [
      exposure("m1", "2026-08-01", "p1", 30, "RIGHT_WING"),
      exposure("m2", "2026-08-08", "p1", 30, "RIGHT_WING"),
      exposure("m3", "2026-08-15", "p1", 30, "RIGHT_WING"),
    ];
    const patterns = buildPlayerContributionPatterns(samples, exposures, new Set(["p1"]), new Set());
    const pattern = patterns.find((p) => p.key === "player:p1:assist-contribution");
    expect(pattern?.metrics.dominantPosition).toBeNull();
  });
});
