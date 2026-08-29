"use client";

import { useEffect, useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import {
  getEventMatchAvailabilityBoardAction,
  setEventMatchUnavailableAction,
  removeEventMatchAvailabilityExceptionAction,
} from "@/app/(app)/events/event-match-availability-actions";

// ADR-0106 (Event Match availability, PR 5a — model + UX, no enforcement yet). A per-participant,
// per-match matrix: click a cell to toggle a match-specific unavailability exception. Desktop
// grid; below sm width the same data renders as one collapsible list per participant (spec §19's
// "per-participant match-by-match check/cross list" mobile equivalent), since a wide grid does
// not fit a phone screen.

type MatchColumn = {
  id: string;
  opponentName: string;
  startsAt: string;
  status: string;
};

type MatrixEntry = {
  participantId: string;
  playerId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  eventLevelStatus: string;
  matchExceptions: Record<string, { note: string | null }>;
};

const HARD_EXCLUDED_STATUSES = new Set(["UNAVAILABLE", "WITHDRAWN"]);

export function EventMatchAvailabilityPanel({ eventId }: { eventId: string }) {
  const [matches, setMatches] = useState<MatchColumn[] | null>(null);
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getEventMatchAvailabilityBoardAction(eventId).then((result) => {
      setMatches(result.matches);
      setMatrix(result.matrix);
    });
  }, [eventId]);

  function refresh() {
    startTransition(async () => {
      const result = await getEventMatchAvailabilityBoardAction(eventId);
      setMatches(result.matches);
      setMatrix(result.matrix);
    });
  }

  function toggle(entry: MatrixEntry, matchId: string) {
    if (HARD_EXCLUDED_STATUSES.has(entry.eventLevelStatus)) return;
    setError(null);
    const participant = { playerId: entry.playerId, guestPlayerId: entry.guestPlayerId };
    const hasException = matchId in entry.matchExceptions;

    startTransition(async () => {
      const result = hasException
        ? await removeEventMatchAvailabilityExceptionAction(matchId, participant)
        : await setEventMatchUnavailableAction(matchId, participant);
      if (!result.success) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  if (matches === null) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-xs text-[var(--text-muted)]">Loading…</p>
      </Surface>
    );
  }

  return (
    <Surface variant="default" padding="md">
      <SectionHeader
        title="Match availability"
        description="Mark a participant unavailable for a specific match while they remain available for the rest of the Event. An Event-level unavailable status always applies to every match."
      />

      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {matches.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">No matches scheduled for this Event yet.</p>
      ) : matrix.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">No participants in this Event&apos;s pool yet.</p>
      ) : (
        <>
          {/* Desktop / tablet: grid matrix */}
          <div className="mt-3 hidden overflow-x-auto medium:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Participant
                  </th>
                  {matches.map((m) => (
                    <th
                      key={m.id}
                      className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
                    >
                      vs {m.opponentName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((entry) => {
                  const hardExcluded = HARD_EXCLUDED_STATUSES.has(entry.eventLevelStatus);
                  return (
                    <tr key={entry.participantId} className="border-b border-[var(--border-soft)]/50">
                      <td className="py-2 px-2 text-zinc-100">
                        {entry.displayName}
                        {hardExcluded && (
                          <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                            ({entry.eventLevelStatus.toLowerCase()} for the whole Event)
                          </span>
                        )}
                      </td>
                      {matches.map((m) => {
                        const hasException = m.id in entry.matchExceptions;
                        const unavailable = hardExcluded || hasException;
                        return (
                          <td key={m.id} className="py-2 px-2 text-center">
                            <button
                              type="button"
                              disabled={isPending || hardExcluded}
                              onClick={() => toggle(entry, m.id)}
                              title={
                                hardExcluded
                                  ? `Unavailable for the whole Event`
                                  : hasException
                                    ? "Unavailable for this match — click to clear"
                                    : "Available for this match — click to mark unavailable"
                              }
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs disabled:cursor-not-allowed ${
                                unavailable
                                  ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              }`}
                            >
                              {unavailable ? "✕" : "✓"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: per-participant collapsible list */}
          <div className="mt-3 flex flex-col gap-2 medium:hidden">
            {matrix.map((entry) => {
              const hardExcluded = HARD_EXCLUDED_STATUSES.has(entry.eventLevelStatus);
              return (
                <details key={entry.participantId} className="rounded-md border border-[var(--border-soft)] p-2">
                  <summary className="cursor-pointer text-sm text-zinc-100">
                    {entry.displayName}
                    {hardExcluded && (
                      <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                        ({entry.eventLevelStatus.toLowerCase()} for the whole Event)
                      </span>
                    )}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {matches.map((m) => {
                      const hasException = m.id in entry.matchExceptions;
                      const unavailable = hardExcluded || hasException;
                      return (
                        <li key={m.id} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">vs {m.opponentName}</span>
                          <button
                            type="button"
                            disabled={isPending || hardExcluded}
                            onClick={() => toggle(entry, m.id)}
                            className={`rounded px-2 py-0.5 disabled:cursor-not-allowed ${
                              unavailable ? "text-[var(--danger)]" : "text-emerald-400"
                            }`}
                          >
                            {unavailable ? "Unavailable ✕" : "Available ✓"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        </>
      )}
    </Surface>
  );
}
