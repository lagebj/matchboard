import { describe, it, expect } from "vitest";
import { summarizeSeasonTrendRollup } from "../get-season-trend-rollup";

/**
 * `summarizeSeasonTrendRollup()` — the pure grouping half of the season trend rollup (ADR-0157
 * C7). Exercised directly against plain row objects so this test needs no database connection;
 * `get-season-trend-rollup.test.ts` never recomputes a trend itself, matching the spec's
 * "development trends use ADR-0155 persisted derivation" requirement -- these inputs stand in
 * for already-persisted `DerivedTrend`/`DerivedMeasurement` rows.
 */

describe("summarizeSeasonTrendRollup", () => {
  it("counts established (non-STABLE) trends per metric+direction, deduped by player", () => {
    const result = summarizeSeasonTrendRollup(
      [
        { playerId: "p1", metricKey: "role_seconds", dimensions: { position: "CM" }, direction: "UP" },
        { playerId: "p2", metricKey: "role_seconds", dimensions: { position: "CM" }, direction: "UP" },
        { playerId: "p3", metricKey: "role_seconds", dimensions: { position: "GK" }, direction: "DOWN" },
        { playerId: "p4", metricKey: "event_rate", dimensions: { eventType: "GOAL_FOR" }, direction: "STABLE" },
      ],
      [],
      4,
    );

    expect(result.playersWithEstablishedTrend).toBe(3);
    expect(result.established).toEqual([
      { metricKey: "role_seconds", direction: "DOWN", playerCount: 1 },
      { metricKey: "role_seconds", direction: "UP", playerCount: 2 },
    ]);
  });

  it("never emits an established entry for a STABLE direction", () => {
    const result = summarizeSeasonTrendRollup(
      [{ playerId: "p1", metricKey: "event_rate", dimensions: { eventType: "GOAL_FOR" }, direction: "STABLE" }],
      [],
      1,
    );
    expect(result.established).toEqual([]);
    expect(result.playersWithEstablishedTrend).toBe(0);
  });

  it("counts a player as emerging only when they have eligible evidence for a group without an already-persisted trend", () => {
    const result = summarizeSeasonTrendRollup(
      [{ playerId: "p1", metricKey: "role_seconds", dimensions: { position: "CM" }, direction: "UP" }],
      [
        // Same player, same metric+dimension group as their already-persisted trend -- must not
        // double-count as "emerging" on top of "established".
        { playerId: "p1", metricKey: "role_seconds", dimensions: { position: "CM" } },
        // A different player, a different group that has no persisted trend row yet.
        { playerId: "p2", metricKey: "event_rate", dimensions: { eventType: "GOAL_FOR" } },
      ],
      2,
    );
    expect(result.playersWithEstablishedTrend).toBe(1);
    expect(result.playersWithEmergingSignal).toBe(1);
  });

  it("returns all zeros for no rows", () => {
    const result = summarizeSeasonTrendRollup([], [], 10);
    expect(result).toEqual({ established: [], playersWithEstablishedTrend: 0, playersWithEmergingSignal: 0, totalPlayersConsidered: 10 });
  });
});
