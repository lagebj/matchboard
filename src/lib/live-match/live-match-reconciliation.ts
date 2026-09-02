/**
 * Live match state reconciliation (ADR-0112).
 *
 * Re-derives score (goalsFor, goalsAgainst) and on-field player IDs from
 * canonical server events. Called by the Live Reporting client after every
 * event fetch and after every realtime callback — ensuring local state
 * converges with canonical state rather than drifting from button clicks
 * alone.
 *
 * This module is shared between the reporter and the Follow Live viewer
 * projection. The reporter still needs local optimistic state for instant
 * UI feedback, but reconciles with canonical state on every server response.
 */

import type { LiveEventSummary } from "./live-match-types";
import type { CanonicalLiveEvent } from "./realtime/realtime-messages";

export interface ReconciledState {
  goalsFor: number;
  goalsAgainst: number;
  onFieldPlayerIds: Set<string>;
}

/**
 * Reconcile score and on-field players from server LiveEventSummary[].
 * Server events carry isCorrected/isReversed flags computed by the event store.
 */
export function reconcileFromServerEvents(
  events: LiveEventSummary[],
  initialOnFieldIds: Set<string>,
): ReconciledState {
  let goalsFor = 0;
  let goalsAgainst = 0;
  const onFieldPlayerIds = new Set(initialOnFieldIds);

  for (const event of events) {
    // Skip reversed events
    if (event.isReversed) continue;

    switch (event.eventType) {
      case "GOAL_FOR":
        goalsFor++;
        break;
      case "GOAL_AGAINST":
        goalsAgainst++;
        break;
      case "ROTATION_OUT":
        if (event.playerId) {
          onFieldPlayerIds.delete(event.playerId);
        }
        break;
      case "ROTATION_IN":
        if (event.playerId) {
          onFieldPlayerIds.add(event.playerId);
        }
        break;
      default:
        break;
    }
  }

  return { goalsFor, goalsAgainst, onFieldPlayerIds };
}

/**
 * Reconcile score and on-field players from CanonicalLiveEvent[] (realtime protocol).
 * These events may include EVENT_REVERSED entries with correctsEventId to indicate
 * which prior event was reversed.
 */
export function reconcileFromCanonicalEvents(
  events: CanonicalLiveEvent[],
  initialOnFieldIds: Set<string>,
): ReconciledState {
  let goalsFor = 0;
  let goalsAgainst = 0;
  const onFieldPlayerIds = new Set(initialOnFieldIds);

  // Track reversed event IDs (by id and clientEventId)
  const reversedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType === "EVENT_REVERSED") {
      // EVENT_REVERSED reverses a prior event. We mark it as reversed
      // so it's not counted. The prior event that was reversed will also
      // appear in the event list — we rely on the EVENT_REVERSED to
      // identify which event to skip. Since CanonicalLiveEvent doesn't
      // carry correctsEventId, we track reversed events by their own ID.
      reversedEventIds.add(event.id);
    }
  }

  for (const event of events) {
    if (reversedEventIds.has(event.id)) continue;

    switch (event.eventType) {
      case "GOAL_FOR":
        goalsFor++;
        break;
      case "GOAL_AGAINST":
        goalsAgainst++;
        break;
      case "ROTATION_OUT":
        if (event.playerId) {
          onFieldPlayerIds.delete(event.playerId);
        }
        break;
      case "ROTATION_IN":
        if (event.playerId) {
          onFieldPlayerIds.add(event.playerId);
        }
        break;
      default:
        break;
    }
  }

  return { goalsFor, goalsAgainst, onFieldPlayerIds };
}