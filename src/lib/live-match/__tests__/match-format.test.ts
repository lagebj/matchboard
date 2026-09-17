import { describe, it, expect } from "vitest";
import {
  validateMatchFormatDefinition,
  isValidMatchFormatDefinition,
  resolveLeagueMatchFormat,
  resolveLeagueMatchFormatSource,
  eventSquadMatchTimingToFormat,
  getExpectedWallClockDurationMinutes,
  type MatchFormatDefinition,
  type MatchFormatOverrideFields,
  type LeagueSeasonDefaultFormatFields,
} from "../match-format";

const NO_OVERRIDE: MatchFormatOverrideFields = {
  numberOfPeriodsOverride: null,
  periodDurationMinutesOverride: null,
  breakDurationMinutesOverride: null,
};

const NO_SEASON_DEFAULT: LeagueSeasonDefaultFormatFields = {
  defaultNumberOfPeriods: null,
  defaultPeriodDurationMinutes: null,
  defaultBreakDurationMinutes: null,
};

describe("validateMatchFormatDefinition", () => {
  it("accepts a valid two-period format", () => {
    const format: MatchFormatDefinition = { numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 10 };
    expect(validateMatchFormatDefinition(format)).toEqual([]);
    expect(isValidMatchFormatDefinition(format)).toBe(true);
  });

  it("accepts a valid single-period format with zero break", () => {
    const format: MatchFormatDefinition = { numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 0 };
    expect(isValidMatchFormatDefinition(format)).toBe(true);
  });

  it.each([0, 3, 4, 8])("rejects numberOfPeriods=%d (only 1 and 2 are representable today)", (numberOfPeriods) => {
    const errors = validateMatchFormatDefinition({ numberOfPeriods, periodDurationMinutes: 30, breakDurationMinutes: 10 });
    expect(errors).toContain("NUMBER_OF_PERIODS_INVALID");
  });

  it.each([0, -1, 121])("rejects an out-of-range period duration (%d)", (periodDurationMinutes) => {
    const errors = validateMatchFormatDefinition({ numberOfPeriods: 2, periodDurationMinutes, breakDurationMinutes: 10 });
    expect(errors).toContain("PERIOD_DURATION_OUT_OF_RANGE");
  });

  it("accepts the period-duration boundaries (1 and 120 minutes)", () => {
    expect(validateMatchFormatDefinition({ numberOfPeriods: 1, periodDurationMinutes: 1, breakDurationMinutes: 0 })).toEqual([]);
    expect(validateMatchFormatDefinition({ numberOfPeriods: 1, periodDurationMinutes: 120, breakDurationMinutes: 0 })).toEqual([]);
  });

  it.each([-1, 61])("rejects an out-of-range break duration (%d)", (breakDurationMinutes) => {
    const errors = validateMatchFormatDefinition({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes });
    expect(errors).toContain("BREAK_DURATION_OUT_OF_RANGE");
  });

  it("accepts the break-duration boundaries (0 and 60 minutes)", () => {
    expect(validateMatchFormatDefinition({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 0 })).toEqual([]);
    expect(validateMatchFormatDefinition({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 60 })).toEqual([]);
  });
});

describe("resolveLeagueMatchFormat — precedence (ADR-0146 §1, bundle §02.2)", () => {
  const seasonFormat: LeagueSeasonDefaultFormatFields = {
    defaultNumberOfPeriods: 2,
    defaultPeriodDurationMinutes: 25,
    defaultBreakDurationMinutes: 10,
  };
  const teamFormat: MatchFormatOverrideFields = {
    numberOfPeriodsOverride: 2,
    periodDurationMinutesOverride: 30,
    breakDurationMinutesOverride: 15,
  };
  const matchFormat: MatchFormatOverrideFields = {
    numberOfPeriodsOverride: 1,
    periodDurationMinutesOverride: 40,
    breakDurationMinutesOverride: 0,
  };

  it("resolves the Season default when no Team/Match override is set", () => {
    const result = resolveLeagueMatchFormat({ season: seasonFormat, team: NO_OVERRIDE, match: NO_OVERRIDE });
    expect(result).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 });
    expect(resolveLeagueMatchFormatSource({ season: seasonFormat, team: NO_OVERRIDE, match: NO_OVERRIDE })).toBe("SEASON");
  });

  it("a complete Team override wins completely over the Season default", () => {
    const result = resolveLeagueMatchFormat({ season: seasonFormat, team: teamFormat, match: NO_OVERRIDE });
    expect(result).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });
    expect(resolveLeagueMatchFormatSource({ season: seasonFormat, team: teamFormat, match: NO_OVERRIDE })).toBe("TEAM");
  });

  it("a complete Match override wins completely over Team and Season", () => {
    const result = resolveLeagueMatchFormat({ season: seasonFormat, team: teamFormat, match: matchFormat });
    expect(result).toEqual({ numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 0 });
    expect(resolveLeagueMatchFormatSource({ season: seasonFormat, team: teamFormat, match: matchFormat })).toBe("MATCH");
  });

  it("returns null (unconfigured) when nothing in the chain has a complete format", () => {
    const result = resolveLeagueMatchFormat({ season: NO_SEASON_DEFAULT, team: NO_OVERRIDE, match: NO_OVERRIDE });
    expect(result).toBeNull();
    expect(resolveLeagueMatchFormatSource({ season: NO_SEASON_DEFAULT, team: NO_OVERRIDE, match: NO_OVERRIDE })).toBeNull();
  });

  it("returns null when season/team/match rows themselves are entirely absent (e.g. no season resolved)", () => {
    expect(resolveLeagueMatchFormat({ season: null, team: null, match: null })).toBeNull();
  });

  it.each([
    { numberOfPeriodsOverride: 2, periodDurationMinutesOverride: null, breakDurationMinutesOverride: 10 },
    { numberOfPeriodsOverride: null, periodDurationMinutesOverride: 30, breakDurationMinutesOverride: 10 },
    { numberOfPeriodsOverride: 2, periodDurationMinutesOverride: 30, breakDurationMinutesOverride: null },
  ])("a partial Team override (%j) is rejected — falls through to Season, never merged field-by-field", (partialTeam) => {
    const result = resolveLeagueMatchFormat({ season: seasonFormat, team: partialTeam, match: NO_OVERRIDE });
    expect(result).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 });
  });

  it("a partial Match override is rejected — falls through to Team, never merged field-by-field", () => {
    const partialMatch: MatchFormatOverrideFields = {
      numberOfPeriodsOverride: 1,
      periodDurationMinutesOverride: null,
      breakDurationMinutesOverride: 0,
    };
    const result = resolveLeagueMatchFormat({ season: seasonFormat, team: teamFormat, match: partialMatch });
    expect(result).toEqual({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });
  });
});

describe("eventSquadMatchTimingToFormat", () => {
  it("maps a configured Event timing into the shared format shape", () => {
    expect(eventSquadMatchTimingToFormat({ numberOfHalves: 2, matchDurationMinutes: 20, breakDurationMinutes: 5 })).toEqual({
      numberOfPeriods: 2,
      periodDurationMinutes: 20,
      breakDurationMinutes: 5,
    });
  });

  it("treats an unset break duration as zero", () => {
    expect(eventSquadMatchTimingToFormat({ numberOfHalves: 1, matchDurationMinutes: 20, breakDurationMinutes: null })).toEqual({
      numberOfPeriods: 1,
      periodDurationMinutes: 20,
      breakDurationMinutes: 0,
    });
  });

  it("returns null when the Event's own duration is unset", () => {
    expect(eventSquadMatchTimingToFormat({ numberOfHalves: 1, matchDurationMinutes: null, breakDurationMinutes: null })).toBeNull();
  });
});

describe("getExpectedWallClockDurationMinutes", () => {
  it("sums playing time plus (numberOfPeriods - 1) breaks for a two-period format", () => {
    expect(getExpectedWallClockDurationMinutes({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 })).toBe(60);
  });

  it("adds no break time for a single-period format", () => {
    expect(getExpectedWallClockDurationMinutes({ numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 10 })).toBe(40);
  });
});
