/**
 * Live match state reconciliation (ADR-0112).
 *
 * Re-derives score (goalsFor, goalsAgainst), on-field player IDs, and current positions from
 * canonical server events. Called by the Live Reporting client after every event fetch and
 * after every realtime callback — ensuring local state converges with canonical state rather
 * than drifting from button clicks alone.
 *
 * ADR-0138 (Bundle 5) — this is now a thin adapter over `live-match-projection.ts`'s shared
 * `reduceLiveEvents()`, the one reducer also used by the Follow Live projection
 * (`projectCanonicalLiveState`). Before this bundle these were two independent
 * implementations of "which goals count" that could (and did — ARR-0047) diverge; the
 * previous, unused `reconcileFromCanonicalEvents` sibling function (a second, never-wired-in
 * attempt at the same fix) is removed rather than kept alongside a third implementation.
 */

import type { LiveEventSummary } from "./live-match-types";
import { reduceLiveEvents } from "./live-match-projection";

export interface ReconciledState {
  goalsFor: number;
  goalsAgainst: number;
  onFieldPlayerIds: Set<string>;
  /** playerId -> most recently recorded position. A player absent here has no recorded
   * `POSITIONS_CHANGED` event in this event window (Bundle 5). */
  positions: Record<string, string | null>;
}

/**
 * Reconcile score, on-field players, and positions from server `LiveEventSummary[]`.
 */
export function reconcileFromServerEvents(
  events: LiveEventSummary[],
  initialOnFieldIds: Set<string>,
  initialPositions: Record<string, string | null> = {},
): ReconciledState {
  const reduced = reduceLiveEvents(events, [...initialOnFieldIds], initialPositions);
  return {
    goalsFor: reduced.goalsFor,
    goalsAgainst: reduced.goalsAgainst,
    onFieldPlayerIds: new Set(reduced.onFieldPlayerIds),
    positions: reduced.positions,
  };
}