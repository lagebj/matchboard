import { describe, it, expect } from "vitest";
import {
  isValidEventType,
  validateLiveEventInput,
  isGoalEventType,
  isRotationEventType,
  isFairPlayEventType,
  isPeriodTransition,
  canCorrectEventType,
  fairPlayCategoryIsPositive,
  fairPlayCategoryIsConcern,
  getFairPlayCategoryLabel,
  getPeriodLabel,
  getEventTypeLabel,
  getPeriodAfter,
} from "../live-match-domain";
import type { LiveMatchEventType, MatchPeriod, FairPlayCategory } from "../live-match-types";

describe("isValidEventType", () => {
  it("accepts valid event types", () => {
    expect(isValidEventType("GOAL_FOR")).toBe(true);
    expect(isValidEventType("MATCH_START")).toBe(true);
    expect(isValidEventType("MOMENT_MARKED")).toBe(true);
  });

  it("rejects invalid event types", () => {
    expect(isValidEventType("INVALID")).toBe(false);
    expect(isValidEventType("")).toBe(false);
  });
});

describe("validateLiveEventInput", () => {
  const validBase = {
    matchId: "match1",
    sessionId: "session1",
    eventType: "GOAL_FOR" as LiveMatchEventType,
    playerId: "player1",
    clientEventId: "evt-001",
  };

  it("accepts a valid goal event", () => {
    expect(validateLiveEventInput(validBase)).toBeNull();
  });

  it("rejects missing matchId", () => {
    expect(validateLiveEventInput({ ...validBase, matchId: "" })).toBe("matchId is required");
  });

  it("rejects missing sessionId", () => {
    expect(validateLiveEventInput({ ...validBase, sessionId: "" })).toBe("sessionId is required");
  });

  it("rejects missing eventType", () => {
    expect(validateLiveEventInput({ ...validBase, eventType: "" as LiveMatchEventType })).toBe("eventType is required");
  });

  it("rejects missing clientEventId", () => {
    expect(validateLiveEventInput({ ...validBase, clientEventId: "" })).toBe("clientEventId is required");
  });

  it("rejects invalid event type", () => {
    expect(validateLiveEventInput({ ...validBase, eventType: "INVALID" as LiveMatchEventType })).toContain("Invalid event type");
  });

  it("does not require playerId for GOAL_FOR (scorer attribution is a separate, optional SCORER_SET event)", () => {
    expect(validateLiveEventInput({ ...validBase, playerId: undefined })).toBeNull();
  });

  it("does not require playerId for GOAL_AGAINST", () => {
    const input = { ...validBase, eventType: "GOAL_AGAINST" as LiveMatchEventType, playerId: undefined };
    expect(validateLiveEventInput(input)).toBeNull();
  });

  it("requires playerId for SCORER_SET", () => {
    const input = { ...validBase, eventType: "SCORER_SET" as LiveMatchEventType, playerId: undefined };
    expect(validateLiveEventInput(input)).toContain("requires a playerId");
  });

  it("requires correctsEventId when correctionType is set", () => {
    expect(validateLiveEventInput({ ...validBase, correctionType: "CORRECTION" as const, correctsEventId: undefined })).toBe("correctionType requires correctsEventId");
  });

  it("requires correctionType when correctsEventId is set", () => {
    expect(validateLiveEventInput({ ...validBase, correctsEventId: "evt-123" })).toBe("correctsEventId requires correctionType");
  });
});

describe("event type classification", () => {
  it("identifies goal event types", () => {
    expect(isGoalEventType("GOAL_FOR")).toBe(true);
    expect(isGoalEventType("GOAL_AGAINST")).toBe(true);
    expect(isGoalEventType("SCORER_SET")).toBe(false);
  });

  it("identifies rotation event types", () => {
    expect(isRotationEventType("ROTATION_OUT")).toBe(true);
    expect(isRotationEventType("ROTATION_IN")).toBe(true);
    expect(isRotationEventType("POSITIONS_CHANGED")).toBe(true);
    expect(isRotationEventType("GOAL_FOR")).toBe(false);
  });

  it("identifies fair play event types", () => {
    expect(isFairPlayEventType("FAIR_PLAY_POSITIVE")).toBe(true);
    expect(isFairPlayEventType("FAIR_PLAY_CONCERN")).toBe(true);
    expect(isFairPlayEventType("GOAL_FOR")).toBe(false);
  });

  it("identifies period transitions", () => {
    expect(isPeriodTransition("MATCH_START")).toBe(true);
    expect(isPeriodTransition("PERIOD_START")).toBe(true);
    expect(isPeriodTransition("PERIOD_END")).toBe(true);
    expect(isPeriodTransition("MATCH_END")).toBe(true);
    expect(isPeriodTransition("GOAL_FOR")).toBe(false);
  });

  it("identifies correctable event types", () => {
    expect(canCorrectEventType("GOAL_FOR")).toBe(true);
    expect(canCorrectEventType("FAIR_PLAY_POSITIVE")).toBe(true);
    expect(canCorrectEventType("MOMENT_MARKED")).toBe(true);
    expect(canCorrectEventType("MATCH_START")).toBe(false);
  });
});

describe("fair play category classification", () => {
  it("identifies positive categories", () => {
    expect(fairPlayCategoryIsPositive("HELPED_OPPONENT")).toBe(true);
    expect(fairPlayCategoryIsPositive("ENCOURAGED_TEAMMATE")).toBe(true);
    expect(fairPlayCategoryIsPositive("RETALIATION")).toBe(false);
  });

  it("identifies concern categories", () => {
    expect(fairPlayCategoryIsConcern("RETALIATION")).toBe(true);
    expect(fairPlayCategoryIsConcern("ABUSIVE_LANGUAGE")).toBe(true);
    expect(fairPlayCategoryIsConcern("HELPED_OPPONENT")).toBe(false);
  });

  it("has labels for all categories", () => {
    const categories: FairPlayCategory[] = [
      "HELPED_OPPONENT", "CHECKED_ON_INJURED_PLAYER", "ACCEPTED_REFEREE_DECISION",
      "ENCOURAGED_TEAMMATE", "CALMED_DIFFICULT_SITUATION", "OTHER_POSITIVE",
      "RETALIATION", "ABUSIVE_LANGUAGE", "DISSENT_TOWARD_REFEREE",
      "TAUNTING_OR_PROVOKING", "DISRESPECT_TOWARD_TEAMMATE", "OTHER_CONCERN",
    ];
    for (const cat of categories) {
      expect(getFairPlayCategoryLabel(cat)).toBeTruthy();
    }
  });
});

describe("getPeriodAfter", () => {
  it("returns the next period in sequence", () => {
    expect(getPeriodAfter("BEFORE")).toBe("FIRST_HALF");
    expect(getPeriodAfter("FIRST_HALF")).toBe("HALF_TIME");
    expect(getPeriodAfter("HALF_TIME")).toBe("SECOND_HALF");
  });

  it("returns null for the last period", () => {
    expect(getPeriodAfter("FULL_TIME")).toBeNull();
  });

  it("returns null for invalid period", () => {
    expect(getPeriodAfter("INVALID" as MatchPeriod)).toBeNull();
  });
});

describe("labels", () => {
  it("provides period labels", () => {
    expect(getPeriodLabel("FIRST_HALF")).toBe("First half");
    expect(getPeriodLabel("FULL_TIME")).toBe("Full time");
    expect(getPeriodLabel("BEFORE")).toBe("Before match");
  });

  it("provides event type labels", () => {
    expect(getEventTypeLabel("GOAL_FOR")).toBe("Goal — us");
    expect(getEventTypeLabel("GOAL_AGAINST")).toBe("Goal — them");
    expect(getEventTypeLabel("MOMENT_MARKED")).toBe("Moment marked");
  });
});