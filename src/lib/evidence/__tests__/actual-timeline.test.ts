import { describe, it, expect } from "vitest";
import { computePositionIntervals } from "../../evidence/lineup-state";

describe("Actual position timeline — pure function tests", () => {
  it("computes intervals from starters with no rotations", () => {
    const starters = [
      { playerId: "p1", position: "GK" },
      { playerId: "p2", position: "CB" },
      { playerId: "p3", position: "CM" },
    ];

    const intervals = computePositionIntervals(starters, [], [], null);

    expect(intervals).toHaveLength(3);
    expect(intervals[0].playerId).toBe("p1");
    expect(intervals[0].position).toBe("GK");
    expect(intervals[0].startedAtMs).toBe(0);
    expect(intervals[0].endedAtMs).toBeNull();
  });

  it("computes intervals with substitution", () => {
    const starters = [
      { playerId: "p1", position: "GK" },
      { playerId: "p2", position: "CB" },
      { playerId: "p3", position: "CM" },
    ];

    const rotations = [
      {
        outPlayerId: "p2",
        inPlayerId: "p4",
        outPosition: null,
        inPosition: "CB",
        positionOnly: false,
        matchSeconds: 30000,
      },
    ];

    const intervals = computePositionIntervals(starters, rotations, [], null);

    // p1: GK (ongoing), p2: CB → BENCH, p3: CM (ongoing), p4: CB (from sub)
    // 5 intervals: p1, p2-CB, p2-BENCH, p3, p4-CB
    expect(intervals).toHaveLength(5);
    const p2Intervals = intervals.filter((i) => i.playerId === "p2");
    expect(p2Intervals).toHaveLength(2);
    expect(p2Intervals[0].position).toBe("CB");
    expect(p2Intervals[0].endedAtMs).toBe(30000);
    expect(p2Intervals[1].position).toBe("BENCH");
    expect(p2Intervals[1].startedAtMs).toBe(30000);

    const p4Intervals = intervals.filter((i) => i.playerId === "p4");
    expect(p4Intervals).toHaveLength(1);
    expect(p4Intervals[0].startedAtMs).toBe(30000);
    expect(p4Intervals[0].position).toBe("CB");
  });

  it("computes intervals with position swap", () => {
    const starters = [
      { playerId: "p1", position: "GK" },
      { playerId: "p2", position: "CB" },
      { playerId: "p3", position: "CM" },
    ];

    const rotations = [
      {
        outPlayerId: "p2",
        inPlayerId: "p3",
        outPosition: "CB",
        inPosition: "CM",
        positionOnly: true,
        matchSeconds: 20000,
      },
    ];

    const intervals = computePositionIntervals(starters, rotations, [], null);

    const p2Intervals = intervals.filter((i) => i.playerId === "p2");
    expect(p2Intervals).toHaveLength(2);
    expect(p2Intervals[0].position).toBe("CB");
    expect(p2Intervals[0].endedAtMs).toBe(20000);
    expect(p2Intervals[1].position).toBe("CM");
    expect(p2Intervals[1].startedAtMs).toBe(20000);

    const p3Intervals = intervals.filter((i) => i.playerId === "p3");
    expect(p3Intervals).toHaveLength(2);
    expect(p3Intervals[0].position).toBe("CM");
    expect(p3Intervals[0].endedAtMs).toBe(20000);
    expect(p3Intervals[1].position).toBe("CB");
    expect(p3Intervals[1].startedAtMs).toBe(20000);
  });

  it("ends intervals at matchEndMs when provided", () => {
    const starters = [
      { playerId: "p1", position: "GK" },
    ];

    const intervals = computePositionIntervals(starters, [], [], 5400000);

    expect(intervals).toHaveLength(1);
    expect(intervals[0].endedAtMs).toBe(5400000);
  });

  it("keeps intervals open when matchEndMs is null", () => {
    const starters = [
      { playerId: "p1", position: "GK" },
    ];

    const intervals = computePositionIntervals(starters, [], [], null);

    expect(intervals).toHaveLength(1);
    expect(intervals[0].endedAtMs).toBeNull();
  });
});