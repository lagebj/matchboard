"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, X, Search } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import {
  addLeagueMatchGuestAction,
  removeLeagueMatchGuestAction,
  getLeagueMatchGuestsAction,
  getLeagueMatchGuestCandidatesAction,
} from "@/app/(app)/matches/league-match-guest-actions";

type Guest = {
  id: string;
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
};

type Candidate = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
};

// ADR-0106: League Match GuestPlayer usage — a short "Add guest -> select -> confirm" flow,
// mirroring MatchHelpersPanel's shape. Only guest players already registered as a
// LeagueRoundParticipant of this match's round are offered as candidates (register them for the
// Round first, via the Round Board's guest player section).
export function LeagueMatchGuestsPanel({ matchId }: { matchId: string }) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getLeagueMatchGuestsAction(matchId).then(setGuests);
  }, [matchId]);

  function openAdd() {
    setShowAdd(true);
    setError(null);
    setQuery("");
    if (!candidates) {
      startTransition(async () => {
        const result = await getLeagueMatchGuestCandidatesAction(matchId);
        setCandidates(result);
      });
    }
  }

  function handleAdd(guestPlayerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addLeagueMatchGuestAction({ matchId, guestPlayerId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const refreshed = await getLeagueMatchGuestsAction(matchId);
      setGuests(refreshed);
      setCandidates(null);
      setShowAdd(false);
      setQuery("");
    });
  }

  function handleRemove(assignmentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeLeagueMatchGuestAction(assignmentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setGuests((prev) => (prev ? prev.filter((g) => g.id !== assignmentId) : prev));
    });
  }

  const filteredCandidates = (candidates ?? []).filter((c) => {
    if (!query.trim()) return true;
    return c.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <Surface padding="md">
      <SectionHeader
        title="Guest players"
        description="Reusable external players registered for this Round. Use the Round Board to register a new guest player."
        actions={
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
          >
            {showAdd ? "Cancel" : "Add guest player"}
          </Button>
        }
      />

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

      {guests === null ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Loading…</p>
      ) : guests.length === 0 && !showAdd ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">No guest players added for this match.</p>
      ) : (
        guests.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {guests.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-soft)] px-2.5 py-1.5 text-xs"
              >
                <span>
                  {g.name}
                  {g.sourceLabel && <span className="ml-1.5 text-[var(--text-muted)]">· {g.sourceLabel}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(g.id)}
                  disabled={isPending}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
                  aria-label={`Remove ${g.name}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {showAdd && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest players…"
              aria-label="Search guest players to add"
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
            {candidates === null ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Loading guest players…</p>
            ) : filteredCandidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                No guest players registered for this Round. Register one on the Round Board first.
              </p>
            ) : (
              filteredCandidates.map((c) => (
                <button
                  key={c.guestPlayerId}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAdd(c.guestPlayerId)}
                  className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--surface-muted)]/50 disabled:opacity-50"
                >
                  <span>{c.name}</span>
                  {c.sourceLabel && <span className="text-[10px] text-[var(--text-muted)]">{c.sourceLabel}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}
