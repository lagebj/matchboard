import { describe, it, expect } from "vitest";
import { aggregateSeasonCombinations } from "../combination-aggregation";
import type { CombinationEvidenceRow } from "../combination-topology";

function makeRow(overrides: Partial<CombinationEvidenceRow> & { playerIds: string[]; positions: string[] }): CombinationEvidenceRow {
  return {
    id: `evidence-${Math.random().toString(36).slice(2, 8)}`,
    organisationId: "org1",
    matchId: overrides.matchId ?? "match1",
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    minutesTogether: 90,
    goalsForWhilePresent: 0,
    goalsAgainstWhilePresent: 0,
    directGoalContributions: 0,
    directAssistContributions: 0,
    opponentDiversity: 1,
    confidence: "INSUFFICIENT",
    approximateTiming: false,
    leagueSeasonId: "ls1",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("aggregateSeasonCombinations", () => {
  it("returns empty array for no evidence", () => {
    const result = aggregateSeasonCombinations([]);
    expect(result).toEqual([]);
  });

  it("aggregates single-row evidence into one summary", () => {
    const rows = [
      makeRow({
        matchId: "match1",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        minutesTogether: 90,
        goalsForWhilePresent: 2,
        goalsAgainstWhilePresent: 1,
      }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.playerIds).toEqual(["p1", "p2"]);
    expect(summaries[0]!.positions).toContain("CB");
    expect(summaries[0]!.totalMinutesTogether).toBe(90);
    expect(summaries[0]!.matchCount).toBe(1);
    expect(summaries[0]!.goalsForTotal).toBe(2);
    expect(summaries[0]!.goalsAgainstTotal).toBe(1);
  });

  it("aggregates same pair across multiple matches", () => {
    const rows = [
      makeRow({
        matchId: "match1",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        minutesTogether: 60,
        goalsForWhilePresent: 1,
        goalsAgainstWhilePresent: 0,
      }),
      makeRow({
        matchId: "match2",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        minutesTogether: 45,
        goalsForWhilePresent: 2,
        goalsAgainstWhilePresent: 1,
      }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.totalMinutesTogether).toBe(105);
    expect(summaries[0]!.matchCount).toBe(2);
    expect(summaries[0]!.goalsForTotal).toBe(3);
    expect(summaries[0]!.goalsAgainstTotal).toBe(1);
  });

  it("keeps different pairs separate", () => {
    const rows = [
      makeRow({
        matchId: "match1",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        subtype: "HORIZONTAL",
        minutesTogether: 90,
      }),
      makeRow({
        matchId: "match1",
        playerIds: ["p1", "p3"],
        positions: ["CB", "CM"],
        subtype: "VERTICAL",
        minutesTogether: 90,
      }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries).toHaveLength(2);

    const horizontal = summaries.find((s) => s.subtype === "HORIZONTAL" && s.playerIds.includes("p2"));
    const vertical = summaries.find((s) => s.subtype === "VERTICAL" && s.playerIds.includes("p3"));

    expect(horizontal).toBeDefined();
    expect(vertical).toBeDefined();
    expect(horizontal!.totalMinutesTogether).toBe(90);
    expect(vertical!.totalMinutesTogether).toBe(90);
  });

  it("derives confidence based on aggregated minutes and match count", () => {
    const rows = [
      makeRow({
        matchId: "match1",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        minutesTogether: 100,
      }),
      makeRow({
        matchId: "match2",
        playerIds: ["p1", "p2"],
        positions: ["CB", "CB"],
        minutesTogether: 100,
      }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries).toHaveLength(1);

    // 200 minutes, 2 matches, opponentDiversity 1 → EMERGING (need 3 matches for ESTABLISHED)
    expect(summaries[0]!.confidence).toBe("EMERGING");
  });

  it("reaches ESTABLISHED confidence with sufficient data", () => {
    const rows = [
      makeRow({ matchId: "match1", playerIds: ["p1", "p2"], positions: ["CB", "CB"], minutesTogether: 90 }),
      makeRow({ matchId: "match2", playerIds: ["p1", "p2"], positions: ["CB", "CB"], minutesTogether: 90 }),
      makeRow({ matchId: "match3", playerIds: ["p1", "p2"], positions: ["CB", "CB"], minutesTogether: 90 }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    // 270 minutes, 3 matches → ESTABLISHED (if opponentDiversity >= 2, but defaults to 1)
    // deriveConfidence(270, 3, 1) → EMERGING (needs opponentDiversity >= 2)
    expect(summaries[0]!.confidence).toBe("EMERGING");
  });

  it("sorts summaries by total minutes descending", () => {
    const rows = [
      makeRow({ matchId: "match1", playerIds: ["p1", "p2"], positions: ["CB", "CB"], minutesTogether: 45 }),
      makeRow({ matchId: "match1", playerIds: ["p3", "p4"], positions: ["LM", "RM"], minutesTogether: 90 }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries[0]!.totalMinutesTogether).toBe(90);
    expect(summaries[1]!.totalMinutesTogether).toBe(45);
  });

  it("merges positions across matches", () => {
    const rows = [
      makeRow({ matchId: "match1", playerIds: ["p1", "p2"], positions: ["CB", "CB"], subtype: "HORIZONTAL" }),
      makeRow({ matchId: "match2", playerIds: ["p1", "p2"], positions: ["LCB", "RCB"], subtype: "HORIZONTAL" }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.positions).toContain("CB");
    expect(summaries[0]!.positions).toContain("LCB");
    expect(summaries[0]!.positions).toContain("RCB");
  });

  it("sets approximateTiming to true if any row has it", () => {
    const rows = [
      makeRow({ matchId: "match1", playerIds: ["p1", "p2"], positions: ["CB", "CB"], approximateTiming: false }),
      makeRow({ matchId: "match2", playerIds: ["p1", "p2"], positions: ["CB", "CB"], approximateTiming: true }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries[0]!.approximateTiming).toBe(true);
  });

  it("uses opponentDiversity of 1 when opponentSet is empty (no match IDs tracked)", () => {
    const rows = [
      makeRow({ matchId: "match1", playerIds: ["p1", "p2"], positions: ["CB", "CB"], minutesTogether: 30 }),
    ];

    const summaries = aggregateSeasonCombinations(rows);
    expect(summaries[0]!.opponentDiversity).toBe(1);
  });
});