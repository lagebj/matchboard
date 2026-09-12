import { describe, it, expect } from "vitest";
import { aggregateOpponentEncounters } from "../aggregate-opponent-encounters";

describe("aggregateOpponentEncounters", () => {
  it("counts encounters and picks the first (most recent) match's result per opponent", () => {
    const result = aggregateOpponentEncounters([
      { opponentTeamId: "o1", startsAt: new Date("2026-09-01"), homeAway: "HOME", reportHomeGoals: 3, reportAwayGoals: 1, hasReport: true },
      { opponentTeamId: "o1", startsAt: new Date("2026-08-01"), homeAway: "AWAY", reportHomeGoals: 2, reportAwayGoals: 0, hasReport: true },
    ]);
    expect(result.get("o1")).toEqual({
      encounterCount: 2,
      lastEncounterDate: new Date("2026-09-01").toISOString(),
      lastEncounterResult: "won",
    });
  });

  it("keeps separate opponents distinct", () => {
    const result = aggregateOpponentEncounters([
      { opponentTeamId: "o1", startsAt: new Date("2026-09-01"), homeAway: "HOME", reportHomeGoals: 1, reportAwayGoals: 1, hasReport: true },
      { opponentTeamId: "o2", startsAt: new Date("2026-09-02"), homeAway: "HOME", reportHomeGoals: 0, reportAwayGoals: 2, hasReport: true },
    ]);
    expect(result.get("o1")?.encounterCount).toBe(1);
    expect(result.get("o2")?.encounterCount).toBe(1);
    expect(result.get("o1")?.lastEncounterResult).toBe("drawn");
    expect(result.get("o2")?.lastEncounterResult).toBe("lost");
  });

  it("skips matches with no opponentTeamId", () => {
    const result = aggregateOpponentEncounters([
      { opponentTeamId: null, startsAt: new Date("2026-09-01"), homeAway: "HOME", reportHomeGoals: 1, reportAwayGoals: 0, hasReport: true },
    ]);
    expect(result.size).toBe(0);
  });

  it("returns a null result when the most recent encounter has no completed report", () => {
    const result = aggregateOpponentEncounters([
      { opponentTeamId: "o1", startsAt: new Date("2026-09-01"), homeAway: "HOME", reportHomeGoals: null, reportAwayGoals: null, hasReport: false },
    ]);
    expect(result.get("o1")).toEqual({
      encounterCount: 1,
      lastEncounterDate: new Date("2026-09-01").toISOString(),
      lastEncounterResult: null,
    });
  });

  it("returns an empty map for no matches", () => {
    expect(aggregateOpponentEncounters([]).size).toBe(0);
  });
});
