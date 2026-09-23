"use client";

import { useState, useTransition } from "react";
import { UserPlus, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { TouchlineButton } from "@/components/touchline";
import {
  addLeagueMatchHelperAction,
  getLeagueMatchHelperCandidatesAction,
} from "@/app/(app)/matches/match-helper-actions";
import {
  addLeagueMatchGuestAction,
  getLeagueMatchGuestCandidatesAction,
  createAndAddMatchGuestAction,
} from "@/app/(app)/matches/league-match-guest-actions";

type Tab = "player" | "guest";

type PlayerCandidate = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  currentRoundTeamName: string | null;
};

type GuestCandidate = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
};

type AddPlayerDialogProps = {
  matchId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function AddPlayerDialog({ matchId, isOpen, onClose, onAdded }: AddPlayerDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("player");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [playerCandidates, setPlayerCandidates] = useState<PlayerCandidate[] | null>(null);
  const [guestCandidates, setGuestCandidates] = useState<GuestCandidate[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestSource, setNewGuestSource] = useState("");
  const [newGuestNote, setNewGuestNote] = useState("");

  function resetAndClose() {
    setQuery("");
    setError(null);
    setPlayerCandidates(null);
    setGuestCandidates(null);
    setNewGuestName("");
    setNewGuestSource("");
    setNewGuestNote("");
    setActiveTab("player");
    onClose();
  }

  function loadCandidates(tab: Tab) {
    if (tab === "player" && playerCandidates === null) {
      setLoadingCandidates(true);
      startTransition(async () => {
        const result = await getLeagueMatchHelperCandidatesAction(matchId);
        setPlayerCandidates(result);
        setLoadingCandidates(false);
      });
    }
    if (tab === "guest" && guestCandidates === null) {
      setLoadingCandidates(true);
      startTransition(async () => {
        const result = await getLeagueMatchGuestCandidatesAction(matchId);
        setGuestCandidates(result);
        setLoadingCandidates(false);
      });
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setError(null);
    setQuery("");
    loadCandidates(tab);
  }

  function handleAddPlayer(playerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addLeagueMatchHelperAction({ matchId, playerId, provenance: "MATCH_DAY_ADDITION" });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onAdded();
      resetAndClose();
    });
  }

  function handleAddGuest(guestPlayerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addLeagueMatchGuestAction({ matchId, guestPlayerId, skipRoundRegistration: true });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onAdded();
      resetAndClose();
    });
  }

  function handleCreateGuest() {
    const trimmed = newGuestName.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createAndAddMatchGuestAction({
        matchId,
        name: trimmed,
        sourceLabel: newGuestSource.trim() || null,
        note: newGuestNote.trim() || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setGuestCandidates(null);
      onAdded();
      resetAndClose();
    });
  }

  const filteredPlayerCandidates = (playerCandidates ?? []).filter((c) => {
    if (!query.trim()) return true;
    const name = `${c.firstName} ${c.lastName ?? ""}`.toLowerCase();
    return name.includes(query.trim().toLowerCase());
  });

  const filteredGuestCandidates = (guestCandidates ?? []).filter((c) => {
    if (!query.trim()) return true;
    return c.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Add player"
      description="Add a player or guest to this match. Match-day additions do not change round assignments."
      size="md"
    >
      <div className="flex gap-1 border-b border-[var(--border-soft)] mb-3">
        <button
          type="button"
          onClick={() => handleTabChange("player")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${activeTab === "player" ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-soft)]"}`}
        >
          Player
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("guest")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${activeTab === "guest" ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-soft)]"}`}
        >
          Guest
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}

      {activeTab === "player" && (
        <div className="flex flex-col gap-2">
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
              aria-label="Search players to add as match-day addition"
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
            {loadingCandidates ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Loading players…</p>
            ) : playerCandidates === null ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Enter a search to load players.</p>
            ) : filteredPlayerCandidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No matching players.</p>
            ) : (
              filteredPlayerCandidates.map((c) => (
                <button
                  key={c.playerId}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAddPlayer(c.playerId)}
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

      {activeTab === "guest" && (
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-medium text-[var(--text-soft)] mb-2">Existing guest players</h4>
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guests…"
                aria-label="Search existing guest players"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--border-soft)]">
              {loadingCandidates ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Loading guests…</p>
              ) : guestCandidates === null ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Enter a search to load guests.</p>
              ) : filteredGuestCandidates.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No matching guest players.</p>
              ) : (
                filteredGuestCandidates.map((c) => (
                  <button
                    key={c.guestPlayerId}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAddGuest(c.guestPlayerId)}
                    className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--surface-muted)]/50 disabled:opacity-50"
                  >
                    <span>{c.name}</span>
                    {c.sourceLabel && <span className="text-[10px] text-[var(--text-muted)]">{c.sourceLabel}</span>}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)] pt-3">
            <h4 className="text-xs font-medium text-[var(--text-soft)] mb-2">Create new guest player</h4>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder="Guest player name"
                aria-label="New guest player name"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="text"
                value={newGuestSource}
                onChange={(e) => setNewGuestSource(e.target.value)}
                placeholder="Source label (optional)"
                aria-label="New guest player source label"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="text"
                value={newGuestNote}
                onChange={(e) => setNewGuestNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="New guest player note"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
              />
              <TouchlineButton
                variant="secondary"
                size="sm"
                disabled={isPending || !newGuestName.trim()}
                onClick={handleCreateGuest}
                leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {isPending ? "Creating…" : "Create and add"}
              </TouchlineButton>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <TouchlineButton variant="ghost" size="sm" onClick={resetAndClose}>
          Cancel
        </TouchlineButton>
      </div>
    </Dialog>
  );
}