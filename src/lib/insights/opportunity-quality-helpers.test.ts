import { describe, it, expect } from "vitest";
import { countBySupportBurden, formatAttendanceLabel } from "./opportunity-quality-helpers";
import type { OpportunityQualityEntry } from "./insights-types";

function entry(overrides: Partial<OpportunityQualityEntry>): OpportunityQualityEntry {
  return {
    playerId: "p1",
    playerName: "Test Player",
    coreTeamId: "t1",
    coreTeamName: "Team",
    matchId: "m1",
    matchRoundId: "r1",
    matchRoundLabel: "Round 1",
    matchDate: new Date().toISOString(),
    teamId: "t1",
    teamName: "Team",
    opponentName: null,
    role: "CORE",
    isCore: true,
    supportBurden: false,
    plannedPosition: null,
    realisedAttendance: "unknown",
    realisedMinutes: null,
    minutesEvidence: "not_tracked",
    cancelled: false,
    ...overrides,
  };
}

describe("opportunity-quality-helpers", () => {
  it("counts core vs support entries", () => {
    const entries = [
      entry({ supportBurden: false }),
      entry({ supportBurden: true }),
      entry({ supportBurden: true }),
    ];
    expect(countBySupportBurden(entries)).toEqual({ coreCount: 1, supportCount: 2 });
  });

  it("formats attendance labels", () => {
    expect(formatAttendanceLabel("present")).toBe("Present");
    expect(formatAttendanceLabel("no_show")).toBe("No-show");
    expect(formatAttendanceLabel("unknown")).toBe("Unknown");
  });
});
