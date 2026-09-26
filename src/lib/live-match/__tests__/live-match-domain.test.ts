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
  requiresRunningPeriod,
  checkNormalLiveEventGuard,
  LIVE_PERIOD_NOT_RUNNING,
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

  it("requires correctionType when correctsEventId is set on a non-annotation event", () => {
    expect(validateLiveEventInput({ ...validBase, correctsEventId: "evt-123" })).toBe("correctsEventId requires correctionType");
  });

  // 2026-09-17 production incident (Graabein City match): the client's goal flow records
  // SCORER_SET/ASSIST_SET with `correctsEventId` targeting the goal (an *annotation* — which
  // goal this scorer/assist belongs to, ADR-0138 Bundle 3's explicit-target change) but no
  // `correctionType`, because these events do not *correct* anything. The validation rule
  // above rejected them as 422-domain-terminal — every scorer/assist of every match since
  // silently failed canonical persistence (the DO marked each one failed_terminal, never
  // retried), so seeded post-match reports had no goals/assists at all.
  it("allows correctsEventId without correctionType on the annotation events SCORER_SET/ASSIST_SET (incident regression)", () => {
    const scorer = validateLiveEventInput({
      ...validBase,
      eventType: "SCORER_SET" as LiveMatchEventType,
      playerId: "p1",
      correctsEventId: "goal-evt",
    });
    expect(scorer).toBeNull();

    const assist = validateLiveEventInput({
      ...validBase,
      eventType: "ASSIST_SET" as LiveMatchEventType,
      playerId: "p2",
      secondaryPlayerId: "p1",
      correctsEventId: "goal-evt",
    });
    expect(assist).toBeNull();
  });

  it("still requires correctionType when an annotation event actually corrects something (EVENT_CORRECTED/EVENT_REVERSED semantics)", () => {
    expect(
      validateLiveEventInput({ ...validBase, eventType: "GOAL_FOR" as LiveMatchEventType, correctsEventId: "evt-123", correctionType: undefined }),
    ).toBe("correctsEventId requires correctionType");
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

describe("requiresRunningPeriod (ADR-0152 §7)", () => {
  it("requires a running period for every normal football event", () => {
    const normalTypes: LiveMatchEventType[] = [
      "GOAL_FOR",
      "GOAL_AGAINST",
      "SCORER_SET",
      "ASSIST_SET",
      "ROTATION_OUT",
      "ROTATION_IN",
      "POSITIONS_CHANGED",
      "FAIR_PLAY_POSITIVE",
      "FAIR_PLAY_CONCERN",
      "MOMENT_MARKED",
    ];
    for (const type of normalTypes) {
      expect(requiresRunningPeriod(type)).toBe(true);
    }
  });

  it("exempts period-transition events — they define the clock state being checked against", () => {
    for (const type of ["MATCH_START", "PERIOD_START", "PERIOD_END", "MATCH_END"] as LiveMatchEventType[]) {
      expect(requiresRunningPeriod(type)).toBe(false);
    }
  });

  it("exempts CLOCK_ADJUSTMENT and the explicit correction/reversal types", () => {
    expect(requiresRunningPeriod("CLOCK_ADJUSTMENT")).toBe(false);
    expect(requiresRunningPeriod("EVENT_CORRECTED")).toBe(false);
    expect(requiresRunningPeriod("EVENT_REVERSED")).toBe(false);
  });
});

describe("checkNormalLiveEventGuard (ADR-0152 §7 — the shared server-side event guard)", () => {
  it("allows a normal event while the clock is running a playable period", () => {
    expect(checkNormalLiveEventGuard("GOAL_FOR", { clockPeriod: "FIRST_HALF", clockRunning: true })).toBeNull();
  });

  it("rejects a normal event before kickoff", () => {
    expect(checkNormalLiveEventGuard("GOAL_FOR", { clockPeriod: "BEFORE", clockRunning: false })).toBe(LIVE_PERIOD_NOT_RUNNING);
  });

  it("rejects a normal event during a break (half time)", () => {
    expect(checkNormalLiveEventGuard("ROTATION_OUT", { clockPeriod: "HALF_TIME", clockRunning: false })).toBe(LIVE_PERIOD_NOT_RUNNING);
  });

  it("rejects a normal event after full time", () => {
    expect(checkNormalLiveEventGuard("MOMENT_MARKED", { clockPeriod: "FULL_TIME", clockRunning: false })).toBe(LIVE_PERIOD_NOT_RUNNING);
  });

  it("rejects a normal event while a playing period is merely paused (clockRunning: false)", () => {
    expect(checkNormalLiveEventGuard("FAIR_PLAY_POSITIVE", { clockPeriod: "SECOND_HALF", clockRunning: false })).toBe(
      LIVE_PERIOD_NOT_RUNNING,
    );
  });

  it("never rejects a period-transition/correction/adjustment event, regardless of clock state", () => {
    const stoppedClock = { clockPeriod: "HALF_TIME" as MatchPeriod, clockRunning: false };
    for (const type of ["MATCH_START", "PERIOD_START", "PERIOD_END", "MATCH_END", "CLOCK_ADJUSTMENT", "EVENT_CORRECTED", "EVENT_REVERSED"] as LiveMatchEventType[]) {
      expect(checkNormalLiveEventGuard(type, stoppedClock)).toBeNull();
    }
  });
});