import { describe, it, expect } from "vitest";
import {
  projectLineupFromEvents,
  computePositionIntervals,
  getLineupAtGoalTime,
  validateCompositeLineupChange,
  computeTotalMinutesByPosition,
  type StarterAssignment,
} from "../lineup-state";

describe("projectLineupFromEvents", () => {
  const starters: StarterAssignment[] = [
    { playerId: "A", position: "CM" },
    { playerId: "B", position: "CB" },
    { playerId: "C", position: "ST" },
  ];

  it("returns starter positions when no rotations", () => {
    const lineup = projectLineupFromEvents(starters, [], [], 1000);
    expect(lineup.get("A")).toBe("CM");
    expect(lineup.get("B")).toBe("CB");
    expect(lineup.get("C")).toBe("ST");
  });

  it("handles simple substitution", () => {
    const rotations = [
      {
        outPlayerId: "A",
        inPlayerId: "D",
        outPosition: null,
        inPosition: "CM",
        positionOnly: false,
        matchSeconds: 600000,
      },
    ];

    const lineup = projectLineupFromEvents(starters, rotations, [], 700000);
    expect(lineup.get("A")).toBe("BENCH");
    expect(lineup.get("D")).toBe("CM");
    expect(lineup.get("B")).toBe("CB");
    expect(lineup.get("C")).toBe("ST");
  });

  it("handles position-only swap", () => {
    const rotations = [
      {
        outPlayerId: "A",
        inPlayerId: "B",
        outPosition: "CM",
        inPosition: "CB",
        positionOnly: true,
        matchSeconds: 600000,
      },
    ];

    const lineup = projectLineupFromEvents(starters, rotations, [], 700000);
    expect(lineup.get("A")).toBe("CB");
    expect(lineup.get("B")).toBe("CM");
  });
});

describe("computePositionIntervals", () => {
  const starters: StarterAssignment[] = [
    { playerId: "A", position: "CM" },
    { playerId: "B", position: "CB" },
  ];

  it("creates intervals for starters with no end time", () => {
    const intervals = computePositionIntervals(starters, [], [], null);
    expect(intervals).toHaveLength(2);

    const aInterval = intervals.find((i) => i.playerId === "A");
    expect(aInterval).toBeDefined();
    expect(aInterval!.position).toBe("CM");
    expect(aInterval!.startedAtMs).toBe(0);
    expect(aInterval!.endedAtMs).toBeNull();
  });

  it("ends open intervals when matchEndMs is provided", () => {
    const intervals = computePositionIntervals(starters, [], [], 1800000);
    const aInterval = intervals.find((i) => i.playerId === "A");
    expect(aInterval!.endedAtMs).toBe(1800000);
  });

  it("creates substitution intervals", () => {
    const rotations = [
      {
        outPlayerId: "A",
        inPlayerId: "C",
        outPosition: null,
        inPosition: null,
        positionOnly: false,
        matchSeconds: 600000,
      },
    ];

    const intervals = computePositionIntervals(starters, rotations, [], 1800000);
    const aBench = intervals.find(
      (i) => i.playerId === "A" && i.position === "BENCH",
    );
    expect(aBench).toBeDefined();
    expect(aBench!.startedAtMs).toBe(600000);

    const cOn = intervals.find(
      (i) => i.playerId === "C" && i.position !== "BENCH",
    );
    expect(cOn).toBeDefined();
  });
});

describe("computeTotalMinutesByPosition", () => {
  it("sums minutes by position", () => {
    const intervals = [
      { playerId: "A", position: "CM", startedAtMs: 0, endedAtMs: 600000 },
      { playerId: "A", position: "ST", startedAtMs: 600000, endedAtMs: 1200000 },
      { playerId: "B", position: "CB", startedAtMs: 0, endedAtMs: 1200000 },
    ];

    const result = computeTotalMinutesByPosition(intervals);
    expect(result.get("CM")).toBeCloseTo(10);
    expect(result.get("ST")).toBeCloseTo(10);
    expect(result.get("CB")).toBeCloseTo(20);
  });
});

describe("validateCompositeLineupChange", () => {
  it("detects duplicate position assignments", () => {
    const currentLineup = new Map([
      ["A", "CM"],
      ["B", "CB"],
    ]);

    const change = {
      matchId: "m1",
      clientEventId: "e1",
      effectiveAtMs: 600000,
      changes: [
        { playerId: "A", fromPosition: "CM", toPosition: "CB" },
        { playerId: "B", fromPosition: "CB", toPosition: "CB" },
      ],
    };

    const result = validateCompositeLineupChange(
      change,
      currentLineup,
      new Set(["A", "B"]),
      new Set(),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("allows valid position swap", () => {
    const currentLineup = new Map([
      ["A", "CM"],
      ["B", "CB"],
    ]);

    const change = {
      matchId: "m1",
      clientEventId: "e1",
      effectiveAtMs: 600000,
      changes: [
        { playerId: "A", fromPosition: "CM", toPosition: "CB" },
        { playerId: "B", fromPosition: "CB", toPosition: "CM" },
      ],
    };

    const result = validateCompositeLineupChange(
      change,
      currentLineup,
      new Set(["A", "B"]),
      new Set(),
    );
    expect(result.valid).toBe(true);
  });
});