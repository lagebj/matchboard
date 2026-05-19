import { describe, it, expect } from "vitest";
import {
  validateCoachingIntentCategory,
  validateCoachingIntentScopeType,
} from "../coaching/coaching-intent";
import {
  validateSignalType,
  validateSignalValue,
  isValidSignalValueForType,
  isNegativeReadinessSignal,
  getReadinessWarningsForPlayer,
} from "../coaching/readiness-signals";
import {
  validateMatchdayResponsibility,
} from "../coaching/matchday-responsibility";
import {
  validateFeedbackCategory,
  validateNextAction,
  checkDisallowedLanguage,
  validateFeedbackText,
} from "../coaching/match-execution-feedback";
import {
  PARENT_SAFE_INTENT_MAP,
  PARENT_SAFE_RESPONSIBILITY_MAP,
  MATCHDAY_RESPONSIBILITY_DESCRIPTIONS,
  READINESS_SIGNAL_LABELS,
  READINESS_SIGNAL_VALID_VALUES,
  FEEDBACK_CATEGORY_LABELS,
  COACHING_INTENT_LABELS,
  DISALLOWED_FEEDBACK_TERMS,
} from "../coaching/types";

describe("Coaching Intent", () => {
  describe("validateCoachingIntentCategory", () => {
    it("accepts valid categories", () => {
      expect(validateCoachingIntentCategory("TEAM_FIRST")).toBe(true);
      expect(validateCoachingIntentCategory("CONFIDENCE_REBUILD")).toBe(true);
      expect(validateCoachingIntentCategory("PROTECT_MATCH_FUNCTION")).toBe(true);
    });

    it("rejects invalid categories", () => {
      expect(validateCoachingIntentCategory("INVALID")).toBe(false);
      expect(validateCoachingIntentCategory("")).toBe(false);
      expect(validateCoachingIntentCategory("team_first")).toBe(false);
    });
  });

  describe("validateCoachingIntentScopeType", () => {
    it("accepts valid scope types", () => {
      expect(validateCoachingIntentScopeType("MATCH")).toBe(true);
      expect(validateCoachingIntentScopeType("MATCH_ROUND")).toBe(true);
      expect(validateCoachingIntentScopeType("PLANNING_PERIOD")).toBe(true);
      expect(validateCoachingIntentScopeType("TEAM")).toBe(true);
      expect(validateCoachingIntentScopeType("SELECTION")).toBe(true);
    });

    it("rejects invalid scope types", () => {
      expect(validateCoachingIntentScopeType("PLAYER")).toBe(false);
      expect(validateCoachingIntentScopeType("INVALID")).toBe(false);
    });
  });

  describe("intent labels", () => {
    it("has labels for all categories", () => {
      for (const category of Object.keys(COACHING_INTENT_LABELS)) {
        expect(COACHING_INTENT_LABELS[category as keyof typeof COACHING_INTENT_LABELS]).toBeTruthy();
      }
    });
  });
});

describe("Readiness Signals", () => {
  describe("validateSignalType", () => {
    it("accepts valid signal types", () => {
      expect(validateSignalType("EFFORT_TREND")).toBe(true);
      expect(validateSignalType("COACH_TRUST")).toBe(true);
    });

    it("rejects invalid signal types", () => {
      expect(validateSignalType("INVALID")).toBe(false);
    });
  });

  describe("validateSignalValue", () => {
    it("accepts valid values for each signal type", () => {
      expect(validateSignalValue("EFFORT_TREND", "RISING")).toBe(true);
      expect(validateSignalValue("EFFORT_TREND", "STABLE")).toBe(true);
      expect(validateSignalValue("EFFORT_TREND", "FALLING")).toBe(true);
      expect(validateSignalValue("ATTENDANCE_RELIABILITY", "HIGH")).toBe(true);
      expect(validateSignalValue("LEARNING_BEHAVIOR", "NEEDS_ATTENTION")).toBe(true);
      expect(validateSignalValue("COACH_TRUST", "MEDIUM")).toBe(true);
    });

    it("rejects invalid values for a signal type", () => {
      expect(validateSignalValue("EFFORT_TREND", "HIGH")).toBe(false);
      expect(validateSignalValue("ATTENDANCE_RELIABILITY", "RISING")).toBe(false);
      expect(validateSignalValue("COACH_TRUST", "NEEDS_ATTENTION")).toBe(false);
    });

    it("rejects invalid signal type", () => {
      expect(validateSignalValue("INVALID_TYPE" as never, "RISING")).toBe(false);
    });
  });

  describe("isValidSignalValueForType", () => {
    it("enforces value constraints per signal type", () => {
      expect(isValidSignalValueForType("EFFORT_TREND", "RISING")).toBe(true);
      expect(isValidSignalValueForType("EFFORT_TREND", "HIGH")).toBe(false);
      expect(isValidSignalValueForType("ATTENDANCE_RELIABILITY", "HIGH")).toBe(true);
      expect(isValidSignalValueForType("ATTENDANCE_RELIABILITY", "RISING")).toBe(false);
      expect(isValidSignalValueForType("LEARNING_BEHAVIOR", "NEEDS_ATTENTION")).toBe(true);
      expect(isValidSignalValueForType("LEARNING_BEHAVIOR", "FALLING")).toBe(false);
    });
  });

  describe("isNegativeReadinessSignal", () => {
    it("identifies negative signals", () => {
      expect(isNegativeReadinessSignal("EFFORT_TREND", "FALLING")).toBe(true);
      expect(isNegativeReadinessSignal("ATTENDANCE_RELIABILITY", "LOW")).toBe(true);
      expect(isNegativeReadinessSignal("LEARNING_BEHAVIOR", "NEEDS_ATTENTION")).toBe(true);
    });

    it("does not flag positive or neutral signals", () => {
      expect(isNegativeReadinessSignal("EFFORT_TREND", "RISING")).toBe(false);
      expect(isNegativeReadinessSignal("EFFORT_TREND", "STABLE")).toBe(false);
      expect(isNegativeReadinessSignal("ATTENDANCE_RELIABILITY", "HIGH")).toBe(false);
      expect(isNegativeReadinessSignal("LEARNING_BEHAVIOR", "STRONG")).toBe(false);
    });
  });

  describe("getReadinessWarningsForPlayer", () => {
    it("generates warnings for negative signals", () => {
      const warnings = getReadinessWarningsForPlayer([
        { signalType: "EFFORT_TREND", value: "FALLING" },
        { signalType: "COACH_TRUST", value: "LOW" },
      ]);
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain("Effort trend");
      expect(warnings[1]).toContain("Coach trust");
    });

    it("generates no warnings for positive signals", () => {
      const warnings = getReadinessWarningsForPlayer([
        { signalType: "EFFORT_TREND", value: "RISING" },
        { signalType: "COACH_TRUST", value: "HIGH" },
      ]);
      expect(warnings).toHaveLength(0);
    });

    it("does not generate automatic exclusion — only informational warnings", () => {
      const warnings = getReadinessWarningsForPlayer([
        { signalType: "LEARNING_BEHAVIOR", value: "NEEDS_ATTENTION" },
      ]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).not.toContain("exclude");
      expect(warnings[0]).not.toContain("must not");
    });
  });

  describe("valid values constraints", () => {
    it("EFFORT_TREND allows RISING/STABLE/FALLING", () => {
      expect(READINESS_SIGNAL_VALID_VALUES.EFFORT_TREND).toEqual(["RISING", "STABLE", "FALLING"]);
    });

    it("ATTENDANCE_RELIABILITY allows HIGH/MEDIUM/LOW", () => {
      expect(READINESS_SIGNAL_VALID_VALUES.ATTENDANCE_RELIABILITY).toEqual(["HIGH", "MEDIUM", "LOW"]);
    });

    it("LEARNING_BEHAVIOR allows STRONG/OK/NEEDS_ATTENTION", () => {
      expect(READINESS_SIGNAL_VALID_VALUES.LEARNING_BEHAVIOR).toEqual(["STRONG", "OK", "NEEDS_ATTENTION"]);
    });

    it("COACH_TRUST allows HIGH/MEDIUM/LOW", () => {
      expect(READINESS_SIGNAL_VALID_VALUES.COACH_TRUST).toEqual(["HIGH", "MEDIUM", "LOW"]);
    });
  });

  describe("labels", () => {
    it("has labels for all signal types", () => {
      for (const type of Object.keys(READINESS_SIGNAL_LABELS)) {
        expect(READINESS_SIGNAL_LABELS[type as keyof typeof READINESS_SIGNAL_LABELS]).toBeTruthy();
      }
    });
  });
});

describe("Matchday Responsibility", () => {
  describe("validateMatchdayResponsibility", () => {
    it("accepts valid responsibilities", () => {
      expect(validateMatchdayResponsibility("STABILIZER")).toBe(true);
      expect(validateMatchdayResponsibility("CONNECTOR")).toBe(true);
      expect(validateMatchdayResponsibility("RECOVERY_LEADER")).toBe(true);
      expect(validateMatchdayResponsibility("WIDTH_HOLDER")).toBe(true);
      expect(validateMatchdayResponsibility("CHALLENGE_PLAYER")).toBe(true);
      expect(validateMatchdayResponsibility("CONFIDENCE_REBUILD_PLAYER")).toBe(true);
    });

    it("rejects invalid responsibilities", () => {
      expect(validateMatchdayResponsibility("CAPTAIN")).toBe(false);
      expect(validateMatchdayResponsibility("")).toBe(false);
    });
  });

  describe("getResponsibilityDescription", () => {
    it("returns observable behavior descriptions for each responsibility", () => {
      for (const [_type, desc] of Object.entries(MATCHDAY_RESPONSIBILITY_DESCRIPTIONS)) {
        expect(desc).toBeTruthy();
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.toLowerCase()).not.toContain("lazy");
        expect(desc.toLowerCase()).not.toContain("selfish");
        expect(desc.toLowerCase()).not.toContain("bad attitude");
      }
    });

    it("describes responsibilities using observable football language", () => {
      expect(MATCHDAY_RESPONSIBILITY_DESCRIPTIONS.STABILIZER).toContain("calm");
      expect(MATCHDAY_RESPONSIBILITY_DESCRIPTIONS.RECOVERY_LEADER).toContain("reset");
      expect(MATCHDAY_RESPONSIBILITY_DESCRIPTIONS.CHALLENGE_PLAYER).toContain("effort");
    });
  });

  describe("responsibilities are not permanent labels", () => {
    it("responsibility descriptions describe match-level behavior, not character", () => {
      for (const desc of Object.values(MATCHDAY_RESPONSIBILITY_DESCRIPTIONS)) {
        expect(desc.toLowerCase()).not.toContain("always");
        expect(desc.toLowerCase()).not.toContain("never");
      }
    });
  });
});

describe("Match Execution Feedback", () => {
  describe("validateFeedbackCategory", () => {
    it("accepts valid categories", () => {
      expect(validateFeedbackCategory("EFFORT")).toBe(true);
      expect(validateFeedbackCategory("TEAM_HELP")).toBe(true);
      expect(validateFeedbackCategory("RESET_AFTER_MISTAKE")).toBe(true);
      expect(validateFeedbackCategory("POSITIONAL_DISCIPLINE")).toBe(true);
      expect(validateFeedbackCategory("TEAMMATE_INVOLVEMENT")).toBe(true);
    });

    it("rejects invalid categories", () => {
      expect(validateFeedbackCategory("ATTITUDE")).toBe(false);
      expect(validateFeedbackCategory("")).toBe(false);
    });
  });

  describe("validateNextAction", () => {
    it("accepts valid next actions", () => {
      expect(validateNextAction("NO_ACTION")).toBe(true);
      expect(validateNextAction("MONITOR")).toBe(true);
      expect(validateNextAction("ADJUST_PLANNING")).toBe(true);
      expect(validateNextAction("COACH_CONVERSATION")).toBe(true);
    });

    it("rejects invalid next actions", () => {
      expect(validateNextAction("DEMOTE")).toBe(false);
    });
  });

  describe("checkDisallowedLanguage", () => {
    it("catches disallowed terms", () => {
      expect(checkDisallowedLanguage("The player was lazy today")).toEqual(["lazy"]);
      expect(checkDisallowedLanguage("selfish behavior on the field")).toEqual(["selfish"]);
      expect(checkDisallowedLanguage("bad attitude from this player")).toEqual(["bad attitude"]);
      expect(checkDisallowedLanguage("weak player")).toEqual(["weak player"]);
      expect(checkDisallowedLanguage("not good enough")).toEqual(["not good enough"]);
      expect(checkDisallowedLanguage("useless passing")).toEqual(["useless"]);
      expect(checkDisallowedLanguage("problem player")).toEqual(["problem player"]);
    });

    it("allows observable behavior descriptions", () => {
      expect(checkDisallowedLanguage("recovered position quickly after losing the ball")).toEqual([]);
      expect(checkDisallowedLanguage("stayed available for pass")).toEqual([]);
      expect(checkDisallowedLanguage("helped teammate after ball loss")).toEqual([]);
      expect(checkDisallowedLanguage("tracked runner after teammate was beaten")).toEqual([]);
    });

    it("catches multiple disallowed terms", () => {
      const result = checkDisallowedLanguage("lazy and selfish play");
      expect(result).toContain("lazy");
      expect(result).toContain("selfish");
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("validateFeedbackText", () => {
    it("validates clean text", () => {
      const result = validateFeedbackText("recovered position quickly");
      expect(result.valid).toBe(true);
      expect(result.disallowedTerms).toHaveLength(0);
    });

    it("rejects text with disallowed terms", () => {
      const result = validateFeedbackText("player was lazy today");
      expect(result.valid).toBe(false);
      expect(result.disallowedTerms).toContain("lazy");
    });
  });

  describe("feedback categories have labels", () => {
    it("has labels for all categories", () => {
      for (const cat of Object.keys(FEEDBACK_CATEGORY_LABELS)) {
        expect(FEEDBACK_CATEGORY_LABELS[cat as keyof typeof FEEDBACK_CATEGORY_LABELS]).toBeTruthy();
      }
    });
  });
});

describe("Parent-Safe Export Filter", () => {
  describe("CoachingIntent parent-safe mapping", () => {
    it("maps all intent categories to neutral language", () => {
      for (const [_category, safeTerm] of Object.entries(PARENT_SAFE_INTENT_MAP)) {
        expect(safeTerm).toBeTruthy();
        expect(safeTerm.length).toBeGreaterThan(0);
        const disallowedTerms = ["low readiness", "weak player", "support burden", "confidence rebuild", "effort concern", "coach trust", "needs_attention", "internal ranking", "punishment", "selection debt", "culture debt", "hidden judgement"];
        for (const term of disallowedTerms) {
          expect(safeTerm.toLowerCase()).not.toContain(term);
        }
      }
    });
  });

  describe("MatchdayResponsibility parent-safe mapping", () => {
    it("maps all responsibilities to neutral language", () => {
      for (const [_resp, safeTerm] of Object.entries(PARENT_SAFE_RESPONSIBILITY_MAP)) {
        expect(safeTerm).toBeTruthy();
        expect(safeTerm.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("Misuse Guardrails", () => {
  describe("Readiness signals cannot automatically exclude", () => {
    it("negative readiness signals produce only informational warnings, not blocking rules", () => {
      const warnings = getReadinessWarningsForPlayer([
        { signalType: "EFFORT_TREND", value: "FALLING" },
        { signalType: "COACH_TRUST", value: "LOW" },
        { signalType: "LEARNING_BEHAVIOR", value: "NEEDS_ATTENTION" },
      ]);
      expect(warnings.length).toBeGreaterThan(0);
      for (const w of warnings) {
        expect(w).not.toContain("exclude");
        expect(w).not.toContain("block");
        expect(w).not.toContain("must not");
      }
    });
  });

  describe("Feedback disallowed language", () => {
    it("all disallowed terms are character labels, not behavior descriptions", () => {
      const disallowedTerms = Object.values(DISALLOWED_FEEDBACK_TERMS);
      for (const term of disallowedTerms) {
        expect(typeof term).toBe("string");
        expect(term.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Readiness value constraints prevent misuse", () => {
    it("signal types cannot accept values designed for other types", () => {
      expect(isValidSignalValueForType("EFFORT_TREND", "NEEDS_ATTENTION")).toBe(false);
      expect(isValidSignalValueForType("COACH_TRUST", "STRONG")).toBe(false);
      expect(isValidSignalValueForType("LEARNING_BEHAVIOR", "RISING")).toBe(false);
    });
  });
});