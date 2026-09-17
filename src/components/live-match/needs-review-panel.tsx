"use client";

/**
 * ADR-0138 Bundle 8, work item 1 — the "Needs review" conflict panel. A `NEEDS_REVIEW` local
 * command is a genuine coordinator-detected conflict (Bundle 3's `conflictCode`, wired through
 * `useLiveRealtime`/`attemptSend` in this same bundle): only a coach decision resolves it, never
 * an automatic retry. This panel presents one command at a time, action-specific (never "the
 * whole match"), per `OFFLINE_RECONNECT_CONFLICTS.md` §6 — the intended action, why it could not
 * be applied, and two resolution options: "Apply a new action now" (dismiss the stale record;
 * the coach uses the normal live control again, which naturally records a fresh clientEventId)
 * and "Discard local intent" (dismiss it with no replacement). Both resolutions transition the
 * command to `FAILED_TERMINAL` with a `terminalReason` describing which — reusing the existing
 * terminal state rather than inventing a seventh `CommandStatus` value, and keeping the record
 * retained (never deleted) for diagnostic history, matching this outbox's existing "never
 * silently discarded" discipline (D13).
 *
 * 2026-09-17 incident follow-up: this panel also accepts an already-`FAILED_TERMINAL` command
 * (one the server permanently rejected, e.g. a domain-validation failure — not a live conflict).
 * Before this, such a command reached neither this panel nor `PostMatchUnresolvedBanner`'s
 * actionable list at all — only `NEEDS_REVIEW` did — so the validation bug that rejected every
 * `SCORER_SET`/`ASSIST_SET` in the 2026-09-17 match went completely unsurfaced to the coach. A
 * `FAILED_TERMINAL` entry shows the real `terminalReason` (not a conflict explanation — there was
 * no conflict, no coordinator round-trip to renegotiate) and a single "Acknowledge" action: both
 * of the conflict resolutions above already reduce to the same dismissal for a command that is
 * already dead, so offering two would be a distinction without a difference.
 */

import type { LocalCommand } from "@/lib/live-match/local/live-local-store";
import { getEventTypeLabel } from "@/lib/live-match/live-match-domain";
import type { LiveMatchEventType } from "@/lib/live-match/live-match-types";
import type { ConflictCode } from "@/lib/live-match/realtime/protocol";

/** Plain-English explanation for each conflict code — the one place this prose is produced,
 * matching this codebase's "prose in exactly one place" convention for structured reason codes
 * elsewhere. Never a raw error message, which may not have survived a page reload (only
 * `conflictCode` is persisted). */
const CONFLICT_CODE_LABELS: Record<ConflictCode, string> = {
  PLAYER_ALREADY_OFF_FIELD: "This player is already off the field.",
  PLAYER_ALREADY_ON_FIELD: "This player is already on the field.",
  LINEUP_CHANGED: "The lineup changed before this action could be applied.",
  POSITION_ASSIGNMENT_CHANGED: "This player's position was already changed by another action.",
  CLOCK_STATE_CHANGED: "The match clock changed before this action could be applied.",
  ILLEGAL_PERIOD_TRANSITION: "This period change is no longer valid.",
  TARGET_EVENT_MISSING: "The event this action refers to could not be found.",
  TARGET_EVENT_ALREADY_REVERSED: "The event this action refers to was already reversed.",
  TARGET_EVENT_CHANGED: "The event this action refers to has changed.",
  ATTRIBUTION_CHANGED: "The scorer or assist for this goal has already been set differently.",
  SESSION_ENDED_REVIEW_REQUIRED: "The live session ended before this action could be applied.",
  STREAM_SEALED: "The match report was completed before this action could be applied.",
};

function getConflictExplanation(conflictCode?: string): string {
  if (conflictCode && conflictCode in CONFLICT_CODE_LABELS) {
    return CONFLICT_CODE_LABELS[conflictCode as ConflictCode];
  }
  return "This action could not be applied because the match state changed in the meantime.";
}

export type NeedsReviewResolution = "apply_new" | "discard" | "acknowledge";

interface NeedsReviewPanelProps {
  open: boolean;
  onClose: () => void;
  commands: LocalCommand[];
  playerNameById: Record<string, string>;
  onResolve: (clientEventId: string, resolution: NeedsReviewResolution) => void;
}

export function NeedsReviewPanel({ open, onClose, commands, playerNameById, onResolve }: NeedsReviewPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Needs review">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 bg-[var(--surface-base)] rounded-t-2xl sm:rounded-2xl border border-[var(--border-strong)] p-4 mx-0 sm:mx-4 max-w-md w-full max-h-[80vh] overflow-y-auto"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Needs review</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] text-sm px-2 py-1">Close</button>
        </div>
        {commands.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">Nothing to review right now.</p>
        ) : (
          <ul className="space-y-3">
            {commands.map((command) => {
              const playerName = command.playerId ? playerNameById[command.playerId] : undefined;
              const label = getEventTypeLabel(command.eventType as LiveMatchEventType);
              const isFailedTerminal = command.status === "FAILED_TERMINAL";
              const explanation = isFailedTerminal
                ? (command.terminalReason ?? "This action could not be saved and will not be retried.")
                : getConflictExplanation(command.conflictCode);
              return (
                <li key={command.clientEventId} className="rounded-lg border border-[var(--border-soft)] p-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {label}
                    {playerName ? ` — ${playerName}` : ""}
                  </p>
                  <p className="text-xs text-[var(--text-soft)] mt-1">{explanation}</p>
                  <div className="flex gap-2 mt-3">
                    {isFailedTerminal ? (
                      <button
                        onClick={() => onResolve(command.clientEventId, "acknowledge")}
                        className="flex-1 py-2 px-3 rounded-lg bg-[var(--surface-hover)] text-[var(--text-soft)] text-xs font-medium min-h-[40px]"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onResolve(command.clientEventId, "apply_new")}
                          className="flex-1 py-2 px-3 rounded-lg bg-[var(--accent)] text-[var(--tl-c-accent-on-fill)] text-xs font-medium min-h-[40px]"
                        >
                          Apply a new action now
                        </button>
                        <button
                          onClick={() => onResolve(command.clientEventId, "discard")}
                          className="flex-1 py-2 px-3 rounded-lg bg-[var(--surface-hover)] text-[var(--text-soft)] text-xs font-medium min-h-[40px]"
                        >
                          Discard local intent
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
