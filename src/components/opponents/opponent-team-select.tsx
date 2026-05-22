"use client";

import { useState, useId, useRef } from "react";

type OpponentTeamOption = {
  id: string;
  displayName: string;
};

export function OpponentTeamSelect({
  opponentTeams,
  selectedId,
  onSelectionChange,
  onCreateNew,
  error,
}: {
  opponentTeams: OpponentTeamOption[];
  selectedId: string | null;
  onSelectionChange: (id: string, displayName: string) => void;
  onCreateNew: (displayName: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedTeam = opponentTeams.find((t) => t.id === selectedId);
  const displayValue = selectedTeam ? selectedTeam.displayName : query;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? opponentTeams.filter((t) =>
        t.displayName.toLowerCase().includes(normalizedQuery),
      )
    : opponentTeams.slice(0, 20);

  const exactMatch = normalizedQuery
    ? opponentTeams.find(
        (t) => t.displayName.toLowerCase() === normalizedQuery,
      )
    : null;

  const canCreate =
    normalizedQuery.length > 0 &&
    normalizedQuery.length <= 120 &&
    !exactMatch;

  function handleOpen() {
    setIsOpen(true);
    if (selectedId) {
      setQuery("");
    }
  }

  function handleClose() {
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function handleSelect(team: OpponentTeamOption) {
    setQuery(team.displayName);
    onSelectionChange(team.id, team.displayName);
    setIsOpen(false);
  }

  function handleCreate() {
    if (!canCreate || !query.trim()) return;
    onCreateNew(query.trim());
    setIsOpen(false);
  }

  function _handleInputFocus() {
    setIsOpen(true);
    if (selectedId) {
      setQuery("");
    }
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setIsOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const totalOptions = filtered.length + (canCreate ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < totalOptions - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : totalOptions - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        handleSelect(filtered[highlightIndex]);
      } else if (highlightIndex === filtered.length && canCreate) {
        handleCreate();
      } else if (canCreate && highlightIndex < 0) {
        handleCreate();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="opponent-select"
        className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]"
      >
        Opponent team
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="opponent-select"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={selectedId && !isOpen ? (selectedTeam?.displayName ?? query) : query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleOpen}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(handleClose, 150);
          }}
          required
          placeholder="Search or add opponent team"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none w-full"
        />

        {isOpen && (filtered.length > 0 || canCreate) && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] py-1 shadow-lg"
          >
            {filtered.map((team, idx) => (
              <li
                key={team.id}
                role="option"
                aria-selected={team.id === selectedId}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  idx === highlightIndex
                    ? "bg-[var(--accent-strong)] text-zinc-900"
                    : "text-zinc-100 hover:bg-[var(--accent-soft)]"
                }`}
                onMouseDown={() => handleSelect(team)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                {team.displayName}
              </li>
            ))}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                className={`cursor-pointer px-3 py-2 text-sm italic ${
                  highlightIndex === filtered.length
                    ? "bg-[var(--accent-strong)] text-zinc-900"
                    : "text-zinc-300 hover:bg-[var(--accent-soft)]"
                }`}
                onMouseDown={() => handleCreate()}
                onMouseEnter={() => setHighlightIndex(filtered.length)}
              >
                Create opponent team: {query.trim()}
              </li>
            )}
          </ul>
        )}
      </div>

      <input type="hidden" name="opponent" value={displayValue} />
      <input type="hidden" name="opponentTeamId" value={selectedId ?? ""} />

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">
        Select an existing opponent or type a new name to create one.
      </p>
    </div>
  );
}