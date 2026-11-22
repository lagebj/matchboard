import { describe, it, expect } from "vitest";
import { summarizePositionEvidence, NO_POSITION_EVIDENCE } from "../position-evidence";
import type { PlayerMatchPositionUsage } from "@/lib/player-development/position-usage-history";

function usage(overrides: Partial<PlayerMatchPositionUsage>): PlayerMatchPositionUsage {
  return {
    matchKey: "m1",
    source: "LEAGUE_MATCH",
    playedAt: new Date("2026-01-01"),
    minutesByPosition: {},
    startedAtKickoff: true,
    ...overrides,
  };
}

describe("summarizePositionEvidence", () => {
  it("returns NO_POSITION_EVIDENCE for an empty usage array", () => {
    expect(summarizePositionEvidence([], "CM")).toEqual(NO_POSITION_EVIDENCE);
  });

  it("returns NO_POSITION_EVIDENCE when the position was never recorded for this player", () => {
    const history = [usage({ minutesByPosition: { CB: 90 } })];
    expect(summarizePositionEvidence(history, "CM")).toEqual(NO_POSITION_EVIDENCE);
  });

  it("sums minutes and counts distinct matches for a position played across several matches", () => {
    const history = [
      usage({ matchKey: "m1", playedAt: new Date("2026-01-01"), minutesByPosition: { CM: 60 } }),
      usage({ matchKey: "m2", playedAt: new Date("2026-01-08"), minutesByPosition: { CM: 45 } }),
    ];
    const result = summarizePositionEvidence(history, "CM");
    expect(result.totalMinutes).toBe(105);
    expect(result.matchCount).toBe(2);
    expect(result.mostRecentPlayedAt).toEqual(new Date("2026-01-08"));
  });

  it("only counts the exact requested position, never collapsing a sided code onto its unsided sibling (ADR-0154 §13)", () => {
    const history = [usage({ minutesByPosition: { LCM: 90, CM: 30 } })];
    expect(summarizePositionEvidence(history, "LCM").totalMinutes).toBe(90);
    expect(summarizePositionEvidence(history, "CM").totalMinutes).toBe(30);
    expect(summarizePositionEvidence(history, "RCM")).toEqual(NO_POSITION_EVIDENCE);
  });

  it("ignores a zero-minute entry for the position (treats it the same as absent)", () => {
    const history = [usage({ minutesByPosition: { CM: 0 } })];
    expect(summarizePositionEvidence(history, "CM")).toEqual(NO_POSITION_EVIDENCE);
  });

  it("picks the most recent playedAt across matches regardless of input order", () => {
    const history = [
      usage({ matchKey: "m1", playedAt: new Date("2026-02-01"), minutesByPosition: { CF: 10 } }),
      usage({ matchKey: "m2", playedAt: new Date("2026-01-01"), minutesByPosition: { CF: 10 } }),
    ];
    expect(summarizePositionEvidence(history, "CF").mostRecentPlayedAt).toEqual(new Date("2026-02-01"));
  });

  it("rounds fractional total minutes to the nearest whole minute", () => {
    const history = [usage({ minutesByPosition: { CB: 44.6 } })];
    expect(summarizePositionEvidence(history, "CB").totalMinutes).toBe(45);
  });
});
