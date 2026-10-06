import { describe, it, expect } from "vitest";
import { buildShapeChangeRows, buildMatchFlowChronology, buildWhatThisMatchAddedRows } from "../completed-match-story";
import type { MatchTransition } from "@/lib/evidence/match-state-timeline";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

function baseTransition(overrides: Partial<MatchTransition>): MatchTransition {
  return {
    atMs: 0,
    period: "FIRST_HALF",
    playersOff: [],
    playersOn: [],
    playersRemaining: [],
    positionOnlyChanges: [],
    substitutionCount: 0,
    changedLines: [],
    isSimultaneousSubstitutionAndReshuffle: false,
    disruptionDescriptors: [],
    scoreBefore: { for: 0, against: 0 },
    scoreAfter: { for: 0, against: 0 },
    isAtNaturalBreak: false,
    ...overrides,
  };
}

describe("buildShapeChangeRows", () => {
  it("surfaces concrete position changes, never a formation-signature label", () => {
    const transitions: MatchTransition[] = [
      baseTransition({
        atMs: 20 * 60_000,
        positionOnlyChanges: [{ playerId: "p1", fromPosition: "CM", toPosition: "FW", fromLine: "MID", toLine: "FWD" }],
      }),
    ];
    const names = new Map([["p1", "Anna A"]]);

    const rows = buildShapeChangeRows(transitions, names);

    expect(rows).toEqual([
      {
        id: "shape-1200000",
        minuteLabel: "20'",
        changes: [{ playerId: "p1", playerName: "Anna A", fromPosition: "CM", toPosition: "FW" }],
      },
    ]);
  });

  it("omits a transition that is a substitution only (no position-only change) -- already shown in the Match story timeline", () => {
    const transitions: MatchTransition[] = [
      baseTransition({ atMs: 100_000, playersOff: ["p1"], playersOn: ["p2"], substitutionCount: 1 }),
    ];
    expect(buildShapeChangeRows(transitions, new Map())).toEqual([]);
  });

  it("falls back to 'Unknown player' rather than throwing when a name cannot be resolved", () => {
    const transitions: MatchTransition[] = [
      baseTransition({ positionOnlyChanges: [{ playerId: "p9", fromPosition: "CB", toPosition: "RB", fromLine: "DEF", toLine: "DEF" }] }),
    ];
    const rows = buildShapeChangeRows(transitions, new Map());
    expect(rows[0]!.changes[0]!.playerName).toBe("Unknown player");
  });
});

function goalItem(overrides: Partial<MatchTimelineItem>): MatchTimelineItem {
  return {
    id: "item-1",
    kind: "GOAL_FOR",
    minuteLabel: "10'",
    playerName: null,
    assistPlayerName: null,
    secondaryPlayerName: null,
    sourceIsCanonicalLiveEvent: true,
    ...overrides,
  };
}

describe("buildMatchFlowChronology", () => {
  it("builds a factual cumulative own/opponent goal step sequence in existing timeline order", () => {
    const timeline: MatchTimelineItem[] = [
      goalItem({ id: "g1", kind: "GOAL_FOR", minuteLabel: "10'", playerName: "Anna" }),
      goalItem({ id: "g2", kind: "GOAL_AGAINST", minuteLabel: "30'" }),
      goalItem({ id: "g3", kind: "GOAL_FOR", minuteLabel: "55'", playerName: "Bo" }),
    ];

    const result = buildMatchFlowChronology(timeline);

    expect(result.trustworthy).toBe(true);
    expect(result.points.map((p) => [p.ownGoals, p.opponentGoals])).toEqual([
      [1, 0],
      [1, 1],
      [2, 1],
    ]);
  });

  it("is untrustworthy -- and emits no points -- when any goal has no known minute (never interpolates)", () => {
    const timeline: MatchTimelineItem[] = [
      goalItem({ id: "g1", kind: "GOAL_FOR", minuteLabel: null }),
      goalItem({ id: "g2", kind: "GOAL_AGAINST", minuteLabel: "30'" }),
    ];

    const result = buildMatchFlowChronology(timeline);

    expect(result.trustworthy).toBe(false);
    expect(result.points).toEqual([]);
  });

  it("is trustworthy with an empty point list when there are no goals at all", () => {
    const result = buildMatchFlowChronology([]);
    expect(result.trustworthy).toBe(true);
    expect(result.points).toEqual([]);
  });

  it("never includes a possession/xG/momentum field on any point", () => {
    const timeline: MatchTimelineItem[] = [goalItem({ id: "g1" })];
    const result = buildMatchFlowChronology(timeline);
    const keys = Object.keys(result.points[0]!);
    expect(keys).toEqual(["id", "kind", "minuteLabel", "label", "ownGoals", "opponentGoals"]);
  });
});

describe("buildWhatThisMatchAddedRows", () => {
  it("returns no rows when nothing material happened", () => {
    const rows = buildWhatThisMatchAddedRows({
      hasNewObservations: false,
      observationCount: 0,
      hasNewOpponentEncounter: false,
      opponentName: "Rivals FC",
      firstTimeCanonicalPositions: [],
    });
    expect(rows).toEqual([]);
  });

  it("includes a row only for each real, computed material change", () => {
    const rows = buildWhatThisMatchAddedRows({
      hasNewObservations: true,
      observationCount: 2,
      hasNewOpponentEncounter: true,
      opponentName: "Rivals FC",
      firstTimeCanonicalPositions: [{ playerId: "p1", playerName: "Anna A", position: "CB" }],
    });

    expect(rows).toEqual([
      { id: "position-p1-CB", label: "Anna A recorded their first minutes at CB this season." },
      { id: "opponent-encounter", label: "Opponent memory gained a new recorded encounter with Rivals FC." },
      { id: "observations", label: "2 coach observations recorded from this match." },
    ]);
  });

  it("never claims a player's ability improved from one match", () => {
    const rows = buildWhatThisMatchAddedRows({
      hasNewObservations: true,
      observationCount: 1,
      hasNewOpponentEncounter: false,
      opponentName: null,
      firstTimeCanonicalPositions: [],
    });
    for (const row of rows) {
      expect(row.label.toLowerCase()).not.toContain("improved");
      expect(row.label.toLowerCase()).not.toContain("better");
    }
  });
});
