import type {
  LiveMatchEventType,
  MatchPeriod,
  FairPlayCategory,
  LiveEventInput,
} from "./live-match-types";
import {
  MATCH_PERIOD_ORDER,
  LIVE_EVENT_TYPES_THAT_REQUIRE_PLAYER,
  LIVE_EVENT_TYPES_THAT_ARE_PERIOD_TRANSITIONS,
  LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE,
  FAIR_PLAY_POSITIVE_CATEGORIES,
  FAIR_PLAY_CONCERN_CATEGORIES,
} from "./live-match-types";

export function isValidEventType(type: string): type is LiveMatchEventType {
  const validTypes: LiveMatchEventType[] = [
    "MATCH_START",
    "PERIOD_START",
    "PERIOD_END",
    "MATCH_END",
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
    "CLOCK_ADJUSTMENT",
    "EVENT_CORRECTED",
    "EVENT_REVERSED",
  ];
  return validTypes.includes(type as LiveMatchEventType);
}

export function validateLiveEventInput(input: LiveEventInput): string | null {
  if (!input.matchId) return "matchId is required";
  if (!input.sessionId) return "sessionId is required";
  if (!input.eventType) return "eventType is required";
  if (!input.clientEventId) return "clientEventId is required";

  if (!isValidEventType(input.eventType)) {
    return `Invalid event type: ${input.eventType}`;
  }

  if (LIVE_EVENT_TYPES_THAT_REQUIRE_PLAYER.has(input.eventType) && !input.playerId) {
    return `Event type ${input.eventType} requires a playerId`;
  }

  if (input.correctionType && !input.correctsEventId) {
    return "correctionType requires correctsEventId";
  }

  if (input.correctsEventId && !input.correctionType) {
    return "correctsEventId requires correctionType";
  }

  if (input.period && !MATCH_PERIOD_ORDER.includes(input.period)) {
    return `Invalid period: ${input.period}`;
  }

  if (input.matchSeconds !== undefined && (input.matchSeconds < 0 || input.matchSeconds > 200 * 60 * 1000)) {
    return "matchSeconds must be between 0 and 200 minutes";
  }

  return null;
}

export function getPeriodAfter(current: MatchPeriod): MatchPeriod | null {
  const idx = MATCH_PERIOD_ORDER.indexOf(current);
  if (idx < 0 || idx >= MATCH_PERIOD_ORDER.length - 1) return null;
  return MATCH_PERIOD_ORDER[idx + 1];
}

export function isGoalEventType(type: LiveMatchEventType): boolean {
  return type === "GOAL_FOR" || type === "GOAL_AGAINST";
}

export function isRotationEventType(type: LiveMatchEventType): boolean {
  return type === "ROTATION_OUT" || type === "ROTATION_IN" || type === "POSITIONS_CHANGED";
}

export function isFairPlayEventType(type: LiveMatchEventType): boolean {
  return type === "FAIR_PLAY_POSITIVE" || type === "FAIR_PLAY_CONCERN";
}

export function isCorrectionOrReversal(type: LiveMatchEventType): boolean {
  return type === "EVENT_CORRECTED" || type === "EVENT_REVERSED";
}

export function isPeriodTransition(type: LiveMatchEventType): boolean {
  return LIVE_EVENT_TYPES_THAT_ARE_PERIOD_TRANSITIONS.has(type);
}

export function canCorrectEventType(type: LiveMatchEventType): boolean {
  return LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE.has(type);
}

export function fairPlayCategoryIsPositive(category: FairPlayCategory): boolean {
  return FAIR_PLAY_POSITIVE_CATEGORIES.includes(category);
}

export function fairPlayCategoryIsConcern(category: FairPlayCategory): boolean {
  return FAIR_PLAY_CONCERN_CATEGORIES.includes(category);
}

export function getFairPlayCategoryLabel(category: FairPlayCategory): string {
  const labels: Record<FairPlayCategory, string> = {
    HELPED_OPPONENT: "Helped opponent",
    CHECKED_ON_INJURED_PLAYER: "Checked on injured player",
    ACCEPTED_REFEREE_DECISION: "Accepted referee decision",
    ENCOURAGED_TEAMMATE: "Encouraged teammate",
    CALMED_DIFFICULT_SITUATION: "Calmed a difficult situation",
    OTHER_POSITIVE: "Other positive moment",
    RETALIATION: "Retaliation",
    ABUSIVE_LANGUAGE: "Abusive language",
    DISSENT_TOWARD_REFEREE: "Dissent toward referee",
    TAUNTING_OR_PROVOKING: "Taunting or provoking opponent",
    DISRESPECT_TOWARD_TEAMMATE: "Disrespect toward teammate",
    OTHER_CONCERN: "Other concern",
  };
  return labels[category] ?? category;
}

export function getPeriodLabel(period: MatchPeriod): string {
  const labels: Record<MatchPeriod, string> = {
    BEFORE: "Before match",
    FIRST_HALF: "First half",
    HALF_TIME: "Half time",
    SECOND_HALF: "Second half",
    EXTRA_FIRST_HALF: "Extra time — first half",
    EXTRA_HALF_TIME: "Extra time — half time",
    EXTRA_SECOND_HALF: "Extra time — second half",
    FULL_TIME: "Full time",
  };
  return labels[period] ?? period;
}

export function getEventTypeLabel(type: LiveMatchEventType): string {
  const labels: Record<LiveMatchEventType, string> = {
    MATCH_START: "Match started",
    PERIOD_START: "Period started",
    PERIOD_END: "Period ended",
    MATCH_END: "Match ended",
    GOAL_FOR: "Goal — us",
    GOAL_AGAINST: "Goal — them",
    SCORER_SET: "Scorer recorded",
    ASSIST_SET: "Assist recorded",
    ROTATION_OUT: "Player left",
    ROTATION_IN: "Player entered",
    POSITIONS_CHANGED: "Positions changed",
    FAIR_PLAY_POSITIVE: "Fair play — positive",
    FAIR_PLAY_CONCERN: "Fair play — concern",
    MOMENT_MARKED: "Moment marked",
    CLOCK_ADJUSTMENT: "Clock adjusted",
    EVENT_CORRECTED: "Event corrected",
    EVENT_REVERSED: "Event reversed",
  };
  return labels[type] ?? type;
}