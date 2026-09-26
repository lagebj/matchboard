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
import { isPlayingPeriod } from "./match-clock";

/**
 * Bundle 5 (ADR-0138) — the confirmed real `POSITIONS_CHANGED` payload shape is one event per
 * moved player: `{ fromPosition, toPosition }` on the event's own `payload`, with `playerId`
 * carried as a top-level field (not a batched `{ assignments: [...] }` array — an earlier,
 * unverified assumption in the Bundle 3 coordinator precondition code). This is the one shared
 * derivation used by both the internal persist endpoint's response builder and the internal
 * snapshot route, so a `CanonicalLiveEvent`'s `positionChange` field is populated identically
 * regardless of which path produced it.
 */
export function derivePositionChangeFromPayload(
  eventType: string,
  payload: unknown,
): { fromPosition: string | null; toPosition: string } | null {
  if (eventType !== "POSITIONS_CHANGED") return null;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const toPosition = record.toPosition;
  if (typeof toPosition !== "string" || toPosition.length === 0) return null;
  const fromPosition = typeof record.fromPosition === "string" ? record.fromPosition : null;
  return { fromPosition, toPosition };
}

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

  // 2026-09-17 production incident: `correctsEventId` on SCORER_SET/ASSIST_SET is an
  // *annotation* target (which goal this scorer/assist belongs to — ADR-0138 Bundle 3's
  // explicit-target change in live-match-client.tsx's goal flow), not a correction: these
  // events are recorded with `correctsEventId` and no `correctionType` by design, and this
  // rule previously rejected them (422 → the coordinator marked each one failed_terminal,
  // never retried) — silently losing every scorer/assist of every match. `correctionType`
  // still requires `correctsEventId` in all cases; only the converse is narrowed to the
  // genuinely correcting event types.
  const isAnnotationEvent = input.eventType === "SCORER_SET" || input.eventType === "ASSIST_SET";
  if (input.correctsEventId && !input.correctionType && !isAnnotationEvent) {
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

/** The typed rejection code a normal live-event mutation fails with when the clock is not
 * running a playable period (ADR-0152 §2/§7). Never used for the events exempted by
 * `requiresRunningPeriod` below. */
export const LIVE_PERIOD_NOT_RUNNING = "LIVE_PERIOD_NOT_RUNNING";

/**
 * ADR-0152 §7 — a "normal" live-event mutation (a goal, a rotation, a fair-play observation, a
 * marked moment, an annotation like SCORER_SET/ASSIST_SET, a position change) requires a
 * running playable period. The clock-transition events themselves (MATCH_START/PERIOD_START/
 * PERIOD_END/MATCH_END, CLOCK_ADJUSTMENT) and the explicit correction/reversal path
 * (EVENT_CORRECTED/EVENT_REVERSED) are exempt — they either define the state being checked
 * against, or follow the separate, already-existing correction rules.
 */
export function requiresRunningPeriod(type: LiveMatchEventType): boolean {
  if (isPeriodTransition(type)) return false;
  if (isCorrectionOrReversal(type)) return false;
  if (type === "CLOCK_ADJUSTMENT") return false;
  return true;
}

/**
 * The one shared domain guard (bundle §07.7: "one shared domain guard, not per-button
 * validation"). Called from both League's and Event's event-store write paths with that
 * session's own persisted clock — never re-derived per event type by the caller. Returns
 * `null` when the mutation may proceed, or `LIVE_PERIOD_NOT_RUNNING` when it must be rejected.
 * A stale client that briefly disagrees with the server's persisted clock gets exactly the same
 * rejection as a coach who genuinely tapped an action outside a running period — there is no
 * separate "trust the client" path.
 */
export function checkNormalLiveEventGuard(
  eventType: LiveMatchEventType,
  clock: { clockPeriod: MatchPeriod; clockRunning: boolean },
): typeof LIVE_PERIOD_NOT_RUNNING | null {
  if (!requiresRunningPeriod(eventType)) return null;
  if (!clock.clockRunning || !isPlayingPeriod(clock.clockPeriod)) {
    return LIVE_PERIOD_NOT_RUNNING;
  }
  return null;
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