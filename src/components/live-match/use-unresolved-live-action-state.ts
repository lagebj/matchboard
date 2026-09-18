"use client";

/**
 * Client-only classification of a match's local live-reporting outbox (IndexedDB), extracted
 * from `PostMatchUnresolvedBanner` so both that banner and the Match Details report-draft summary
 * (`05_POST_MATCH_DRAFT_SPEC.md` "Integrity/sync banner") read the exact same truth — never a
 * second interpretation of the same local state (ADR-0138 Bundle 8, 2026-09-17 incident
 * follow-up). Server-side code must never attempt to reproduce this — it is genuinely
 * device-local.
 */

import { useEffect, useState, useCallback } from "react";
import { getUnresolvedCommands, type LocalCommand } from "@/lib/live-match/local/live-local-store";

export interface UnresolvedLiveActionState {
  /** `true` until the first IndexedDB read resolves. */
  loading: boolean;
  needsReviewCount: number;
  /** Permanently failed, never going to sync (`FAILED_TERMINAL`) — distinct from still-converging. */
  failedCount: number;
  /** Genuinely still in flight (`LOCAL_PENDING`/`SENDING`/`ACCEPTED_PENDING_PERSISTENCE`). */
  stillSyncingCount: number;
  /** `needsReviewCount + failedCount` — commands a coach can actually act on right now. */
  actionableCount: number;
  commands: LocalCommand[];
  /** `NEEDS_REVIEW` + `FAILED_TERMINAL` commands, pre-combined for `NeedsReviewPanel`'s own
   * `commands` prop — the exact same list `PostMatchUnresolvedBanner` already passed it. */
  actionableCommands: LocalCommand[];
  /** Re-queries the local outbox — call after resolving a command through `NeedsReviewPanel`. */
  refresh: () => void;
}

export function useUnresolvedLiveActionState(subjectId: string): UnresolvedLiveActionState {
  const [commands, setCommands] = useState<LocalCommand[] | null>(null);

  const refresh = useCallback(() => {
    getUnresolvedCommands(subjectId)
      .then(setCommands)
      .catch(() => setCommands([])); // Best-effort — a read failure must never block the page.
  }, [subjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const list = commands ?? [];
  const needsReview = list.filter((c) => c.status === "NEEDS_REVIEW");
  const failed = list.filter((c) => c.status === "FAILED_TERMINAL");
  const actionableCommands = [...needsReview, ...failed];

  return {
    loading: commands === null,
    needsReviewCount: needsReview.length,
    failedCount: failed.length,
    stillSyncingCount: list.length - actionableCommands.length,
    actionableCount: actionableCommands.length,
    commands: list,
    actionableCommands,
    refresh,
  };
}
