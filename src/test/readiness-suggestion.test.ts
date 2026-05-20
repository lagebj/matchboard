import { describe, it, expect } from "vitest";
import {
  FEEDBACK_TO_READINESS,
  getReadinessSuggestionForFeedback,
  FEEDBACK_CATEGORIES,
} from "@/lib/coaching/types";

describe("FEEDBACK_TO_READINESS mapping", () => {
  it("maps all feedback categories", () => {
    for (const cat of FEEDBACK_CATEGORIES) {
      const mapping = FEEDBACK_TO_READINESS[cat];
      expect(mapping).not.toBeNull();
      expect(mapping!.signalType).toBeDefined();
      expect(mapping!.suggestedValue).toBeDefined();
    }
  });

  it("maps EFFORT to EFFORT_TREND / FALLING", () => {
    expect(FEEDBACK_TO_READINESS.EFFORT).toEqual({
      signalType: "EFFORT_TREND",
      suggestedValue: "FALLING",
    });
  });

  it("maps TEAM_HELP to TEAM_FIRST_BEHAVIOR / NEEDS_ATTENTION", () => {
    expect(FEEDBACK_TO_READINESS.TEAM_HELP).toEqual({
      signalType: "TEAM_FIRST_BEHAVIOR",
      suggestedValue: "NEEDS_ATTENTION",
    });
  });

  it("maps RESET_AFTER_MISTAKE to RESET_AFTER_ERROR_RELIABILITY / NEEDS_ATTENTION", () => {
    expect(FEEDBACK_TO_READINESS.RESET_AFTER_MISTAKE).toEqual({
      signalType: "RESET_AFTER_ERROR_RELIABILITY",
      suggestedValue: "NEEDS_ATTENTION",
    });
  });

  it("maps POSITIONAL_DISCIPLINE to LEARNING_BEHAVIOR / NEEDS_ATTENTION", () => {
    expect(FEEDBACK_TO_READINESS.POSITIONAL_DISCIPLINE).toEqual({
      signalType: "LEARNING_BEHAVIOR",
      suggestedValue: "NEEDS_ATTENTION",
    });
  });

  it("maps TEAMMATE_INVOLVEMENT to TEAM_FIRST_BEHAVIOR / NEEDS_ATTENTION", () => {
    expect(FEEDBACK_TO_READINESS.TEAMMATE_INVOLVEMENT).toEqual({
      signalType: "TEAM_FIRST_BEHAVIOR",
      suggestedValue: "NEEDS_ATTENTION",
    });
  });
});

describe("getReadinessSuggestionForFeedback", () => {
  it("returns suggestion for NEEDS_ATTENTION feedback", () => {
    const result = getReadinessSuggestionForFeedback("EFFORT", "NEEDS_ATTENTION");
    expect(result).not.toBeNull();
    expect(result!.signalType).toBe("EFFORT_TREND");
    expect(result!.suggestedValue).toBe("FALLING");
    expect(result!.signalLabel).toBe("Effort trend");
    expect(result!.valueLabel).toBe("falling");
  });

  it("returns suggestion for TEAM_HELP NEEDS_ATTENTION", () => {
    const result = getReadinessSuggestionForFeedback("TEAM_HELP", "NEEDS_ATTENTION");
    expect(result).not.toBeNull();
    expect(result!.signalType).toBe("TEAM_FIRST_BEHAVIOR");
    expect(result!.suggestedValue).toBe("NEEDS_ATTENTION");
    expect(result!.signalLabel).toBe("Team-first behavior");
    expect(result!.valueLabel).toBe("needs attention");
  });

  it("returns null for POSITIVE feedback", () => {
    expect(getReadinessSuggestionForFeedback("EFFORT", "POSITIVE")).toBeNull();
  });

  it("returns null for NEUTRAL feedback", () => {
    expect(getReadinessSuggestionForFeedback("EFFORT", "NEUTRAL")).toBeNull();
  });

  it("returns null for unknown category", () => {
    expect(getReadinessSuggestionForFeedback("UNKNOWN_CATEGORY", "NEEDS_ATTENTION")).toBeNull();
  });
});