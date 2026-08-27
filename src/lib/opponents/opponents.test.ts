import { describe, it, expect } from "vitest";
import {
  validateObservation,
  deduplicateCategories,
  cleanFactualSummary,
} from "./validate-observation";
import {
  normalizeOpponentName,
  cleanOpponentDisplayName,
  validateOpponentTeamInput,
} from "./opponent-team";
import { validatePlayingStyleTags, type PlayingStyleTag } from "./playing-style-tags";
import { getMatchFitAdvisoryOrdinal } from "./match-fit-labels";
import { MatchFit, OpponentConcernCategory, OpponentObservationFollowUp, MatchEnvironmentObservation } from "@/generated/prisma/client";
import { isParentExcludedField } from "@/lib/export/parent-safe-filter";

describe("validateObservation", () => {
  const validBase = {
    overallEnvironment: "ACCEPTABLE" as MatchEnvironmentObservation,
    opponentPlayersContext: "ACCEPTABLE" as MatchEnvironmentObservation,
    opponentStaffContext: "ACCEPTABLE" as MatchEnvironmentObservation,
    spectatorSidelineContext: "ACCEPTABLE" as MatchEnvironmentObservation,
    concernCategories: [] as OpponentConcernCategory[],
    factualSummary: null as string | null,
    followUp: "NONE" as OpponentObservationFollowUp,
  };

  it("accepts a valid observation with no concerns", () => {
    const result = validateObservation(validBase);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid observation with playing style tags", () => {
    const result = validateObservation({
      ...validBase,
      playingStyleTags: ["HIGH_PRESSING", "POSSESSION_BASED"] as PlayingStyleTag[],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects more than 5 playing style tags in observation", () => {
    const result = validateObservation({
      ...validBase,
      playingStyleTags: [
        "HIGH_PRESSING", "POSSESSION_BASED", "COUNTER_ATTACKING",
        "DIRECT_PLAY", "PHYSICAL_AND_DIRECT", "SLOW_BUILD_UP",
      ] as PlayingStyleTag[],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("style tag"))).toBe(true);
    }
  });

  it("accepts a positive observation", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "POSITIVE" as MatchEnvironmentObservation,
      opponentPlayersContext: "POSITIVE" as MatchEnvironmentObservation,
      opponentStaffContext: "POSITIVE" as MatchEnvironmentObservation,
      spectatorSidelineContext: "POSITIVE" as MatchEnvironmentObservation,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a concern observation with category and summary", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "Physical play after whistle",
      followUp: "DISCUSSED_AFTER_MATCH" as OpponentObservationFollowUp,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a serious concern with summary", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "SERIOUS_CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "SERIOUS_CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "CONCERN" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["PHYSICAL_PLAY_OR_SAFETY_CONCERN", "SIDELINE_ATMOSPHERE_CONCERN"] as OpponentConcernCategory[],
      factualSummary: "Repeated unsafe challenges and aggressive sideline behavior",
      followUp: "INFORMED_OWN_CLUB_FAIR_PLAY_CONTACT" as OpponentObservationFollowUp,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects area serious concern without overall serious concern", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "SERIOUS_CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["PHYSICAL_PLAY_OR_SAFETY_CONCERN"] as OpponentConcernCategory[],
      factualSummary: "Something",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Overall match environment must be marked as a serious concern when a serious concern is recorded in an observed area.");
    }
  });

  it("rejects area concern without overall concern or above", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "POSITIVE" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Overall match environment must be marked as a concern when a concern is recorded in an observed area.");
    }
  });

  it("rejects concern categories missing when concern recorded", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: [] as OpponentConcernCategory[],
      factualSummary: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Select at least one observable concern category when a concern is recorded.");
    }
  });

  it("rejects serious concern without factual summary", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "SERIOUS_CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "SERIOUS_CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["PHYSICAL_PLAY_OR_SAFETY_CONCERN"] as OpponentConcernCategory[],
      factualSummary: null,
      followUp: "INFORMED_OWN_CLUB_FAIR_PLAY_CONTACT" as OpponentObservationFollowUp,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("factual summary"))).toBe(true);
    }
  });

  it("rejects factual summary containing email", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "Contact coach@example.com for details",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("contact details"))).toBe(true);
    }
  });

  it("rejects factual summary containing URL", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "See https://example.com/report",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("contact details"))).toBe(true);
    }
  });

  it("rejects factual summary containing phone number", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "Call +47 123 45 678",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("contact details"))).toBe(true);
    }
  });

  it("rejects factual summary over 500 characters", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      opponentStaffContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      spectatorSidelineContext: "NOT_ASSESSED" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "a".repeat(501),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("500 characters"))).toBe(true);
    }
  });

  it("accepts factual summary at exactly 500 characters", () => {
    const result = validateObservation({
      ...validBase,
      overallEnvironment: "CONCERN" as MatchEnvironmentObservation,
      opponentPlayersContext: "CONCERN" as MatchEnvironmentObservation,
      concernCategories: ["UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[],
      factualSummary: "a".repeat(500),
    });
    expect(result.valid).toBe(true);
  });
});

describe("deduplicateCategories", () => {
  it("removes duplicate categories", () => {
    const result = deduplicateCategories(["UNSPORTING_MATCH_CONDUCT", "SIDELINE_ATMOSPHERE_CONCERN", "UNSPORTING_MATCH_CONDUCT"] as OpponentConcernCategory[]);
    expect(result).toEqual(["UNSPORTING_MATCH_CONDUCT", "SIDELINE_ATMOSPHERE_CONCERN"]);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateCategories([])).toEqual([]);
  });

  it("preserves unique categories", () => {
    const result = deduplicateCategories(["UNSPORTING_MATCH_CONDUCT", "SIDELINE_ATMOSPHERE_CONCERN"] as OpponentConcernCategory[]);
    expect(result).toEqual(["UNSPORTING_MATCH_CONDUCT", "SIDELINE_ATMOSPHERE_CONCERN"]);
  });
});

describe("cleanFactualSummary", () => {
  it("returns null for null input", () => {
    expect(cleanFactualSummary(null)).toBe(null);
  });

  it("returns null for undefined input", () => {
    expect(cleanFactualSummary(undefined)).toBe(null);
  });

  it("trims whitespace", () => {
    expect(cleanFactualSummary("  hello  ")).toBe("hello");
  });

  it("returns null for whitespace-only input", () => {
    expect(cleanFactualSummary("   ")).toBe(null);
  });

  it("preserves valid text", () => {
    expect(cleanFactualSummary("Physical play after whistle")).toBe("Physical play after whistle");
  });
});

describe("normalizeOpponentName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeOpponentName("  FC   Example  ")).toBe("fc example");
  });

  it("trims whitespace", () => {
    expect(normalizeOpponentName("Team A")).toBe("team a");
  });

  it("handles single word", () => {
    expect(normalizeOpponentName("Opponent")).toBe("opponent");
  });
});

describe("cleanOpponentDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanOpponentDisplayName("  FC   Example  ")).toBe("FC Example");
  });

  it("throws on empty string", () => {
    expect(() => cleanOpponentDisplayName("")).toThrow();
  });

  it("throws on whitespace-only string", () => {
    expect(() => cleanOpponentDisplayName("   ")).toThrow();
  });

  it("throws on name over 120 characters", () => {
    expect(() => cleanOpponentDisplayName("a".repeat(121))).toThrow(/120/);
  });

  it("accepts name at exactly 120 characters", () => {
    expect(cleanOpponentDisplayName("a".repeat(120))).toBe("a".repeat(120));
  });
});

describe("validateOpponentTeamInput", () => {
  it("returns display and normalized names for valid input", () => {
    const result = validateOpponentTeamInput("  FC Example  ");
    expect(result.displayName).toBe("FC Example");
    expect(result.normalizedName).toBe("fc example");
  });

  it("throws on non-string input", () => {
    expect(() => validateOpponentTeamInput(42)).toThrow(/required/);
  });

  it("throws on empty string", () => {
    expect(() => validateOpponentTeamInput("")).toThrow();
  });
});

describe("getMatchFitAdvisoryOrdinal", () => {
  it("returns -1 for TOO_EASY", () => {
    expect(getMatchFitAdvisoryOrdinal("TOO_EASY" as MatchFit)).toBe(-1);
  });

  it("returns 0 for GOOD_FIT", () => {
    expect(getMatchFitAdvisoryOrdinal("GOOD_FIT" as MatchFit)).toBe(0);
  });

  it("returns 1 for TOO_HARD", () => {
    expect(getMatchFitAdvisoryOrdinal("TOO_HARD" as MatchFit)).toBe(1);
  });

  it("returns null for UNKNOWN", () => {
    expect(getMatchFitAdvisoryOrdinal("UNKNOWN" as MatchFit)).toBe(null);
  });

  it("returns null for CHAOTIC", () => {
    expect(getMatchFitAdvisoryOrdinal("CHAOTIC" as MatchFit)).toBe(null);
  });

  it("returns null for SUPPORT_OVERPOWERED", () => {
    expect(getMatchFitAdvisoryOrdinal("SUPPORT_OVERPOWERED" as MatchFit)).toBe(null);
  });

  it("returns null for SUPPORT_TOO_LOW", () => {
    expect(getMatchFitAdvisoryOrdinal("SUPPORT_TOO_LOW" as MatchFit)).toBe(null);
  });
});

describe("isParentExcludedField", () => {
  it("excludes opponent observation fields from parent-facing exports", () => {
    expect(isParentExcludedField("opponentEnvironment")).toBe(true);
    expect(isParentExcludedField("opponentConcernCategories")).toBe(true);
    expect(isParentExcludedField("opponentFactualSummary")).toBe(true);
    expect(isParentExcludedField("opponentFollowUp")).toBe(true);
    expect(isParentExcludedField("opponentPlayersContext")).toBe(true);
    expect(isParentExcludedField("opponentStaffContext")).toBe(true);
    expect(isParentExcludedField("opponentSpectatorContext")).toBe(true);
    expect(isParentExcludedField("matchFit")).toBe(true);
  });

  it("excludes coach-only fields from parent-facing exports", () => {
    expect(isParentExcludedField("sourceTeam")).toBe(true);
    expect(isParentExcludedField("overrideReasonCategory")).toBe(true);
    expect(isParentExcludedField("overrideReasonDetail")).toBe(true);
    expect(isParentExcludedField("explanation")).toBe(true);
    expect(isParentExcludedField("matchdayResponsibility")).toBe(true);
    expect(isParentExcludedField("coachingIntentCategory")).toBe(true);
    expect(isParentExcludedField("readinessSignals")).toBe(true);
    expect(isParentExcludedField("controlledDoubleLoad")).toBe(true);
  });

  it("does not exclude regular fields", () => {
    expect(isParentExcludedField("playerName")).toBe(false);
    expect(isParentExcludedField("role")).toBe(false);
    expect(isParentExcludedField("team")).toBe(false);
    expect(isParentExcludedField("date")).toBe(false);
  });
});

describe("validatePlayingStyleTags", () => {
  it("accepts valid style tags within limit", () => {
    const result = validatePlayingStyleTags(["HIGH_PRESSING", "POSSESSION_BASED", "COUNTER_ATTACKING"]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tags).toEqual(["HIGH_PRESSING", "POSSESSION_BASED", "COUNTER_ATTACKING"]);
    }
  });

  it("accepts empty style tags", () => {
    const result = validatePlayingStyleTags([]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tags).toEqual([]);
    }
  });

  it("rejects more than 5 style tags", () => {
    const result = validatePlayingStyleTags([
      "HIGH_PRESSING", "POSSESSION_BASED", "COUNTER_ATTACKING",
      "DIRECT_PLAY", "PHYSICAL_AND_DIRECT", "SLOW_BUILD_UP",
    ] as PlayingStyleTag[]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("at most 5");
    }
  });

  it("deduplicates style tags", () => {
    const result = validatePlayingStyleTags(["HIGH_PRESSING", "HIGH_PRESSING"]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tags).toEqual(["HIGH_PRESSING"]);
    }
  });

  it("rejects invalid style tags", () => {
    const result = validatePlayingStyleTags(["INVALID_TAG"] as unknown as PlayingStyleTag[]);
    expect(result.valid).toBe(false);
  });

  it("accepts exactly 5 style tags", () => {
    const result = validatePlayingStyleTags([
      "HIGH_PRESSING", "POSSESSION_BASED", "COUNTER_ATTACKING",
      "DIRECT_PLAY", "PHYSICAL_AND_DIRECT",
    ]);
    expect(result.valid).toBe(true);
  });
});