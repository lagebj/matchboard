import { describe, it, expect } from "vitest";
import {
  getEffectiveEventTeamGameFormat,
  getEffectiveEventSquadFormationId,
  getEffectiveEventSquadNumberOfHalves,
  getEffectiveEventSquadMatchDurationMinutes,
  getEffectiveEventSquadBreakDurationMinutes,
  getEffectiveEventSquadMatchTiming,
} from "../event-types";

describe("getEffectiveEventTeamGameFormat", () => {
  it("uses the squad override when set", () => {
    expect(getEffectiveEventTeamGameFormat({ gameFormat: "SEVEN_A_SIDE" }, { gameFormatOverride: "NINE_A_SIDE" })).toBe("NINE_A_SIDE");
  });

  it("falls back to the Event default when no override is set", () => {
    expect(getEffectiveEventTeamGameFormat({ gameFormat: "SEVEN_A_SIDE" }, { gameFormatOverride: null })).toBe("SEVEN_A_SIDE");
  });
});

describe("getEffectiveEventSquadFormationId", () => {
  it("uses the squad's own formationId when set", () => {
    expect(getEffectiveEventSquadFormationId({ defaultFormationId: "form-default" }, { formationId: "form-own" })).toBe("form-own");
  });

  it("falls back to the Event defaultFormationId when the squad has none", () => {
    expect(getEffectiveEventSquadFormationId({ defaultFormationId: "form-default" }, { formationId: null })).toBe("form-default");
  });

  it("returns null when neither is set", () => {
    expect(getEffectiveEventSquadFormationId({ defaultFormationId: null }, { formationId: null })).toBeNull();
  });
});

describe("getEffectiveEventSquadNumberOfHalves", () => {
  it("uses the squad override when set", () => {
    expect(getEffectiveEventSquadNumberOfHalves({ numberOfHalves: 1 }, { numberOfHalvesOverride: 2 })).toBe(2);
  });

  it("falls back to the Event default when no override is set", () => {
    expect(getEffectiveEventSquadNumberOfHalves({ numberOfHalves: 1 }, { numberOfHalvesOverride: null })).toBe(1);
  });
});

describe("getEffectiveEventSquadMatchDurationMinutes", () => {
  it("uses the squad override when set", () => {
    expect(getEffectiveEventSquadMatchDurationMinutes({ matchDurationMinutes: 25 }, { matchDurationMinutesOverride: 17 })).toBe(17);
  });

  it("falls back to the Event default when no override is set", () => {
    expect(getEffectiveEventSquadMatchDurationMinutes({ matchDurationMinutes: 25 }, { matchDurationMinutesOverride: null })).toBe(25);
  });

  it("returns null when neither is set", () => {
    expect(getEffectiveEventSquadMatchDurationMinutes({ matchDurationMinutes: null }, { matchDurationMinutesOverride: null })).toBeNull();
  });
});

describe("getEffectiveEventSquadBreakDurationMinutes", () => {
  it("uses the squad override when set (including zero)", () => {
    expect(getEffectiveEventSquadBreakDurationMinutes({ breakDurationMinutes: 5 }, { breakDurationMinutesOverride: 0 })).toBe(0);
  });

  it("falls back to the Event default when no override is set", () => {
    expect(getEffectiveEventSquadBreakDurationMinutes({ breakDurationMinutes: 5 }, { breakDurationMinutesOverride: null })).toBe(5);
  });
});

describe("getEffectiveEventSquadMatchTiming", () => {
  it("resolves independent per-squad timing for a mixed-format event (7v7 2x17+1 and 9v9 2x20+1)", () => {
    const event = { numberOfHalves: 1, matchDurationMinutes: 25, breakDurationMinutes: null };
    const squad7v7 = { numberOfHalvesOverride: 2, matchDurationMinutesOverride: 17, breakDurationMinutesOverride: 1 };
    const squad9v9 = { numberOfHalvesOverride: 2, matchDurationMinutesOverride: 20, breakDurationMinutesOverride: 1 };

    expect(getEffectiveEventSquadMatchTiming(event, squad7v7)).toEqual({
      numberOfHalves: 2,
      matchDurationMinutes: 17,
      breakDurationMinutes: 1,
    });
    expect(getEffectiveEventSquadMatchTiming(event, squad9v9)).toEqual({
      numberOfHalves: 2,
      matchDurationMinutes: 20,
      breakDurationMinutes: 1,
    });
  });

  it("falls back entirely to the Event default when a squad has no overrides", () => {
    const event = { numberOfHalves: 2, matchDurationMinutes: 25, breakDurationMinutes: 2 };
    const squad = { numberOfHalvesOverride: null, matchDurationMinutesOverride: null, breakDurationMinutesOverride: null };

    expect(getEffectiveEventSquadMatchTiming(event, squad)).toEqual({
      numberOfHalves: 2,
      matchDurationMinutes: 25,
      breakDurationMinutes: 2,
    });
  });
});
