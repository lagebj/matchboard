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

  // ADR-0133 H6: an `EVENT_REVERSED` row's own `isReversed` flag is true, but the row it
  // *reverses* (e.g. a GOAL_FOR) is not flagged — its id is in the reversal's `correctsEventId`.
  // The old `if (event.isReversed) continue` therefore only skipped the (non-scoring) reversal
  // row and still counted the reversed goal, so an undone goal never left the score.
  const reversedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType === "EVENT_REVERSED" && event.correctsEventId) {
      reversedEventIds.add(event.correctsEventId);
    }
  }

  for (const event of events) {
    if (event.isReversed || event.eventType === "EVENT_REVERSED") continue;
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

  // Track reversed event IDs. ADR-0133 H6: `CanonicalLiveEvent` does not carry
  // `correctsEventId` on the realtime wire yet (that is the worker-side follow-up), so this
  // realtime/Follow-Live path still cannot un-count a reversed goal precisely — the
  // reporting client uses `reconcileFromServerEvents` (the LiveEventSummary path), which is
  // fixed. When `correctsEventId` is added to the protocol, honour it here too.
  const reversedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType === "EVENT_REVERSED") {
      reversedEventIds.add(event.id);
      const corrects = (event as { correctsEventId?: string | null }).correctsEventId;
      if (corrects) reversedEventIds.add(corrects);
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