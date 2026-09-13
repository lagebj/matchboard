/**
 * Pending overlay reducer (ADR-0138 Bundle 6, work item 5).
 *
 * A pure function extracted from `LiveMatchClient`'s own display-merge logic so it is
 * independently testable. Overlays not-yet-confirmed local commands on top of the canonical
 * recent-events display list, so a coach's own just-recorded action never appears to vanish
 * while its confirmation is still in flight — without ever being mistaken for confirmed
 * canonical truth (DECISIONS.md D14: optimistic display must be distinguishable from global
 * synchronization state).
 *
 * A command is excluded from the overlay only once it reaches `PERSISTED` — `LOCAL_PENDING`,
 * `SENDING`, and `ACCEPTED_PENDING_PERSISTENCE` all remain visible, since a "coordinator
 * accepted, Neon durability not yet confirmed" command is not guaranteed queryable via a normal
 * poll of canonical rows yet. `NEEDS_REVIEW`/`FAILED_TERMINAL` also remain visible (matching
 * D13's "never silently discarded") until a coach resolves them (Bundle 8).
 *
 * Known, disclosed limitation carried over unchanged from the pre-Bundle-6 implementation: a
 * local overlay entry is keyed by its own `clientEventId`, while its eventual canonical
 * counterpart is keyed by a server-generated id — `LiveEventSummary` carries no `clientEventId`
 * to correlate the two, and `RecordEventResult` never returns the resulting canonical id either.
 * This means the two ids never structurally collide, so the identity-based dedup below is a
 * best-effort safety net, not a guarantee — the primary de-duplication mechanism is excluding a
 * command from the overlay the moment it reaches `PERSISTED`, matching the previous
 * `synced`-boolean-based exclusion exactly, only generalized to the new status model.
 */

import type { LiveEventSummary } from "../live-match-types";
import { derivePositionChangeFromPayload } from "../live-match-domain";
import type { LocalCommand, CommandStatus } from "./live-local-store";

export interface PendingSyncSummary {
  /** LOCAL_PENDING + SENDING + ACCEPTED_PENDING_PERSISTENCE — still converging, no coach action
   * needed yet. */
  pendingCount: number;
  /** A genuine state-sensitive conflict awaiting a coach decision (Bundle 8 builds the review
   * UI; this count is legal and meaningful from Bundle 6 onward regardless). */
  needsReviewCount: number;
  /** Invalid on its own terms — will never succeed by retrying. */
  failedCount: number;
}

const CONVERGING_STATUSES: readonly CommandStatus[] = ["LOCAL_PENDING", "SENDING", "ACCEPTED_PENDING_PERSISTENCE"];

export function summarizePendingCommands(commands: readonly LocalCommand[]): PendingSyncSummary {
  let pendingCount = 0;
  let needsReviewCount = 0;
  let failedCount = 0;
  for (const command of commands) {
    if (CONVERGING_STATUSES.includes(command.status)) pendingCount++;
    else if (command.status === "NEEDS_REVIEW") needsReviewCount++;
    else if (command.status === "FAILED_TERMINAL") failedCount++;
  }
  return { pendingCount, needsReviewCount, failedCount };
}

/** Overlays not-yet-`PERSISTED` local commands onto the canonical recent-events display list,
 * deduplicated and sorted by wall-clock time (most recent first), capped to the same 15-item
 * display window the reporter has always used. */
export function overlayPendingCommands(
  canonicalEvents: readonly LiveEventSummary[],
  commands: readonly LocalCommand[],
): LiveEventSummary[] {
  const localOnly = commands.filter((c) => c.status !== "PERSISTED" && c.eventType !== "EVENT_REVERSED");
  const localSummaries: LiveEventSummary[] = localOnly.map((c) => ({
    id: c.clientEventId,
    eventType: c.eventType as LiveEventSummary["eventType"],
    period: (c.period as LiveEventSummary["period"]) ?? null,
    matchSeconds: c.matchSeconds ?? null,
    wallClockTime: null,
    playerId: c.playerId ?? null,
    secondaryPlayerId: c.secondaryPlayerId ?? null,
    isCorrected: false,
    isReversed: false,
    correctsEventId: c.correctsEventId ?? null,
    positionChange: derivePositionChangeFromPayload(c.eventType, c.payload),
  }));

  const seen = new Set<string>();
  return [...canonicalEvents, ...localSummaries]
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => {
      const aTime = a.wallClockTime ? new Date(a.wallClockTime).getTime() : 0;
      const bTime = b.wallClockTime ? new Date(b.wallClockTime).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 15);
}
