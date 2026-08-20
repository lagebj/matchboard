"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, X, Search } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import {
  addLeagueMatchHelperAction,
  removeLeagueMatchHelperAction,
  getLeagueMatchHelpersAction,
  getLeagueMatchHelperCandidatesAction,
} from "@/app/(app)/matches/match-helper-actions";

type Helper = {
  id: string;
  playerId: string;
  playerName: string;
  primaryPosition: string | null;
  sourceTeamName: string;
};

type Candidate = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  currentRoundTeamName: string | null;
};

// League Match helpers (ADR-0077): a short, match-level flow — "Add helper -> select player ->
// confirm" — for adding an emergency participant to this specific match, regardless of League
// Round finalisation, without navigating into round planning or changing the round allocation.
export function MatchHelpersPanel({ matchId }: { matchId: string }) {
  const [helpers, setHelpers] = useState<Helper[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getLeagueMatchHelpersAction(matchId).then(setHelpers);
  }, [matchId]);

  function openAdd() {
    setShowAdd(true);
    setError(null);
    setQuery("");
    if (!candidates) {
      startTransition(async () => {
        const result = await getLeagueMatchHelperCandidatesAction(matchId);
        setCandidates(result);
      });
    }
  }

  function handleAdd(playerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addLeagueMatchHelperAction({ matchId, playerId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const refreshed = await getLeagueMatchHelpersAction(matchId);
      setHelpers(refreshed);
      setCandidates(null);
      setShowAdd(false);
      setQuery("");
    });
  }

  function handleRemove(assignmentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeLeagueMatchHelperAction(assignmentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setHelpers((prev) => (prev ? prev.filter((h) => h.id !== assignmentId) : prev));
    });
  }

  const filteredCandidates = (candidates ?? []).filter((c) => {
    if (!query.trim()) return true;
    const name = `${c.firstName} ${c.lastName ?? ""}`.toLowerCase();
    return name.includes(query.trim().toLowerCase());
  });

  return (
    <Surface padding="md">
      <SectionHeader
        title="Match helpers"
        description="Emergency addition to this match only. Does not change round assignments."
        actions={
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
          >
            {showAdd ? "Cancel" : "Add helper"}
          </Button>
        }
      />

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

      {helpers === null ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Loading…</p>
      ) : helpers.length === 0 && !showAdd ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">No helpers added for this match.</p>
      ) : (
        helpers.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {helpers.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-soft)] px-2.5 py-1.5 text-xs"
              >
                <span>
                  {h.playerName}
                  <span className="ml-1.5 text-[var(--text-muted)]">· {h.sourceTeamName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(h.id)}
                  disabled={isPending}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
                  aria-label={`Remove ${h.playerName} as helper`}
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
              placeholder="Search players…"
              aria-label="Search players to add as helper"
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
            {candidates === null ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Loading players…</p>
            ) : filteredCandidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No matching players.</p>
            ) : (
              filteredCandidates.map((c) => (
                <button
                  key={c.playerId}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAdd(c.playerId)}
                  className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--surface-muted)]/50 disabled:opacity-50"
                >
                  <span>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {c.currentRoundTeamName ?? "No round assignment"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}
