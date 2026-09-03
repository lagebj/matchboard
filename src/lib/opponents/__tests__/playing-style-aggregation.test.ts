import { describe, it, expect } from "vitest";
import {
  aggregatePlayingStyleTendencies,
  classifyTacticalConfidence,
  deriveOpponentTendencyOutcomes,
  TACTICAL_EVIDENCE_WINDOW_MONTHS,
  type TacticalObservationInput,
} from "../playing-style-aggregation";

describe("classifyTacticalConfidence (TEST-MATRIX §14)", () => {
  it("is INSUFFICIENT for zero or one occurrence", () => {
    expect(classifyTacticalConfidence(0)).toBe("INSUFFICIENT");
    expect(classifyTacticalConfidence(1)).toBe("INSUFFICIENT");
  });

  it("is EMERGING at the configured threshold", () => {
    expect(classifyTacticalConfidence(2)).toBe("EMERGING");
    expect(classifyTacticalConfidence(3)).toBe("EMERGING");
  });

  it("is ESTABLISHED at the configured threshold", () => {
    expect(classifyTacticalConfidence(4)).toBe("ESTABLISHED");
    expect(classifyTacticalConfidence(10)).toBe("ESTABLISHED");
  });
});

describe("aggregatePlayingStyleTendencies", () => {
  const referenceDate = new Date("2026-06-01T00:00:00Z");

  it("returns no tendency when there are no observations", () => {
    expect(aggregatePlayingStyleTendencies("opp1", [], referenceDate)).toEqual([]);
  });

  it("one observation is insufficient evidence (TEST-MATRIX §14)", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-05-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const [tendency] = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    expect(tendency.occurrences).toBe(1);
    expect(tendency.confidence).toBe("INSUFFICIENT");
  });

  it("confidence grows only from explicit repeated observations of the same tag", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-01-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m2", occurredAt: new Date("2026-02-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m3", occurredAt: new Date("2026-03-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m4", occurredAt: new Date("2026-04-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const [tendency] = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    expect(tendency.tag).toBe("HIGH_PRESSING");
    expect(tendency.occurrences).toBe(4);
    expect(tendency.confidence).toBe("ESTABLISHED");
    expect(tendency.sourceMatchIds).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("tracks each tag independently within the same set of observations", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-01-01"), playingStyleTags: ["HIGH_PRESSING", "DIRECT_PLAY"] },
      { matchId: "m2", occurredAt: new Date("2026-02-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    const byTag = new Map(tendencies.map((t) => [t.tag, t]));
    expect(byTag.get("HIGH_PRESSING")?.occurrences).toBe(2);
    expect(byTag.get("DIRECT_PLAY")?.occurrences).toBe(1);
  });

  it("excludes observations older than the tactical evidence window (stale evidence never counts as current, TEST-MATRIX §17)", () => {
    const staleDate = new Date(referenceDate);
    staleDate.setMonth(staleDate.getMonth() - (TACTICAL_EVIDENCE_WINDOW_MONTHS + 1));
    const observations: TacticalObservationInput[] = [
      { matchId: "old", occurredAt: staleDate, playingStyleTags: ["HIGH_PRESSING"] },
    ];
    expect(aggregatePlayingStyleTendencies("opp1", observations, referenceDate)).toEqual([]);
  });

  it("includes an observation right at the edge of the window", () => {
    const recentDate = new Date(referenceDate);
    recentDate.setMonth(recentDate.getMonth() - 1);
    const observations: TacticalObservationInput[] = [
      { matchId: "recent", occurredAt: recentDate, playingStyleTags: ["LOW_BLOCK"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    expect(tendencies).toHaveLength(1);
  });

  it("records first/last observed dates across repeated occurrences", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-03-01"), playingStyleTags: ["DIRECT_PLAY"] },
      { matchId: "m2", occurredAt: new Date("2026-01-01"), playingStyleTags: ["DIRECT_PLAY"] },
    ];
    const [tendency] = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    expect(tendency.firstObservedAt).toEqual(new Date("2026-01-01"));
    expect(tendency.lastObservedAt).toEqual(new Date("2026-03-01"));
  });

  it("sorts tendencies by occurrence count descending", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-01-01"), playingStyleTags: ["DIRECT_PLAY"] },
      { matchId: "m2", occurredAt: new Date("2026-02-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m3", occurredAt: new Date("2026-03-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    expect(tendencies[0].tag).toBe("HIGH_PRESSING");
  });
});

describe("deriveOpponentTendencyOutcomes — our response to opponent tendencies", () => {
  const referenceDate = new Date("2026-06-01T00:00:00Z");

  it("excludes INSUFFICIENT-confidence tendencies (one match is not a repeated response)", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-05-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    const outcomes = deriveOpponentTendencyOutcomes(
      tendencies,
      new Map([["m1", { goalsFor: 2, goalsAgainst: 1 }]]),
    );
    expect(outcomes).toEqual([]);
  });

  it("sums factual goals for/against across the matches behind an established tendency", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-01-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m2", occurredAt: new Date("2026-02-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    const outcomes = deriveOpponentTendencyOutcomes(
      tendencies,
      new Map([
        ["m1", { goalsFor: 2, goalsAgainst: 1 }],
        ["m2", { goalsFor: 1, goalsAgainst: 3 }],
      ]),
    );
    expect(outcomes).toEqual([{ tag: "HIGH_PRESSING", matchCount: 2, goalsFor: 3, goalsAgainst: 4 }]);
  });

  it("does not fabricate an outcome for a match with no recorded evidence row", () => {
    const observations: TacticalObservationInput[] = [
      { matchId: "m1", occurredAt: new Date("2026-01-01"), playingStyleTags: ["HIGH_PRESSING"] },
      { matchId: "m2", occurredAt: new Date("2026-02-01"), playingStyleTags: ["HIGH_PRESSING"] },
    ];
    const tendencies = aggregatePlayingStyleTendencies("opp1", observations, referenceDate);
    const outcomes = deriveOpponentTendencyOutcomes(tendencies, new Map());
    expect(outcomes).toEqual([]);
  });
});
