"use client";

/**
 * ADR-0138 Bundle 8, work item 5 — "ensure post-match handoff shows unresolved state." Local
 * live-reporting commands are never silently converted to canonical facts and never deleted
 * while unresolved (D13) — this banner is what actually surfaces that to the coach once they
 * land on the post-match report page, rather than leaving unresolved records invisible in
 * IndexedDB forever. Self-contained: queries the device's own local outbox directly (a
 * client-only concern with no server-side counterpart) and reuses the same `NeedsReviewPanel`
 * live reporting uses, so resolving here has the exact same effect (transitions to
 * `FAILED_TERMINAL` with `resolvedByCoach: true`, retained for diagnostic history, never
 * deleted). Renders nothing when there is nothing unresolved for this match on this device.
 *
 * 2026-09-17 incident follow-up: `getUnresolvedCommands()` returns three genuinely different
 * kinds of "unresolved" — a live conflict (`NEEDS_REVIEW`), a command still genuinely converging
 * (`LOCAL_PENDING`/`SENDING`/`ACCEPTED_PENDING_PERSISTENCE`), and a permanently-failed command
 * (`FAILED_TERMINAL`) — and this banner previously lumped the second and third together as
 * "have not finished syncing," which is true for the second and simply false for the third: a
 * `FAILED_TERMINAL` command is never going to sync, no matter how long the coach waits. That
 * false reassurance is exactly what let the incident's validation bug (every `SCORER_SET`/
 * `ASSIST_SET` silently rejected) go unnoticed. `isActionableForCoach` now separates the failed
 * group out, gives it its own honest copy, and routes it into the same review panel (with its
 * own "Acknowledge" action — see `NeedsReviewPanel`) instead of leaving it un-reviewable.
 */

import { useEffect, useState, useCallback } from "react";
import { getUnresolvedCommands, updateCommandStatus, type LocalCommand } from "@/lib/live-match/local/live-local-store";
import { NeedsReviewPanel, type NeedsReviewResolution } from "@/components/live-match/needs-review-panel";

interface PostMatchUnresolvedBannerProps {
  /** League `Match.id` or Event `EventMatch.id` — the same value passed as `matchId` to
   * `LiveMatchClient` for this match. The local outbox is keyed by `subjectId` alone
   * (`live-local-store.ts`'s own documented assumption: the two id namespaces never collide),
   * so there is no separate `subjectType` parameter needed here. */
  subjectId: string;
  playerNameById?: Record<string, string>;
}

export function PostMatchUnresolvedBanner({ subjectId, playerNameById = {} }: PostMatchUnresolvedBannerProps) {
  const [commands, setCommands] = useState<LocalCommand[] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const refresh = useCallback(() => {
    getUnresolvedCommands(subjectId)
      .then(setCommands)
      .catch(() => setCommands([])); // Best-effort — a read failure must never block the report page itself.
  }, [subjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!commands || commands.length === 0) return null;

  const needsReview = commands.filter((c) => c.status === "NEEDS_REVIEW");
  const failed = commands.filter((c) => c.status === "FAILED_TERMINAL");
  // Equivalent to commands.filter(isActionableForCoach) given getUnresolvedCommands()'s own
  // contract (only NEEDS_REVIEW/unresolved-FAILED_TERMINAL/still-converging ever appear here) —
  // built from the two groups already computed above to avoid a second pass over `commands`.
  const actionable = [...needsReview, ...failed];
  const stillSyncing = commands.length - actionable.length;

  return (
    <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--foreground)]">
      <p>
        {needsReview.length > 0 && (
          <>
            {needsReview.length} recorded action{needsReview.length > 1 ? "s" : ""} from live reporting on this device
            still need{needsReview.length > 1 ? "" : "s"} review.{" "}
          </>
        )}
        {failed.length > 0 && (
          <>
            {failed.length} recorded action{failed.length > 1 ? "s" : ""} from live reporting failed to save and{" "}
            {failed.length > 1 ? "were" : "was"} not included in this report.{" "}
          </>
        )}
        {stillSyncing > 0 && (
          <>
            {stillSyncing} recorded action{stillSyncing > 1 ? "s" : ""} from live reporting {stillSyncing > 1 ? "have" : "has"}{" "}
            not finished syncing on this device.{" "}
          </>
        )}
        These are not yet reflected above.
      </p>
      {actionable.length > 0 && (
        <button onClick={() => setPanelOpen(true)} className="mt-1 underline underline-offset-2 text-[var(--warning)]">
          Review
        </button>
      )}
      <NeedsReviewPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        commands={actionable}
        playerNameById={playerNameById}
        onResolve={(clientEventId, resolution: NeedsReviewResolution) => {
          // "acknowledge" (a FAILED_TERMINAL command) keeps its real terminalReason — it was
          // never actually superseded or discarded, it failed on its own; only apply_new/discard
          // (a NEEDS_REVIEW command being dismissed) get one of those synthesized reasons.
          const extra =
            resolution === "acknowledge"
              ? ({ resolvedByCoach: true } as const)
              : {
                  terminalReason:
                    resolution === "apply_new"
                      ? "Superseded — coach recorded a new action instead."
                      : "Discarded by coach — no replacement action recorded.",
                  resolvedByCoach: true as const,
                };
          void updateCommandStatus(clientEventId, "FAILED_TERMINAL", extra).then(refresh);
        }}
      />
    </div>
  );
}
