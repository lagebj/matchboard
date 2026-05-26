"use client";

import { useState, useCallback } from "react";

export type PlayersMode = "season" | "attention" | "groups";

type PlayersModeTabsProps = {
  mode: PlayersMode;
  onModeChange: (mode: PlayersMode) => void;
};

const tabs: { mode: PlayersMode; label: string; shortLabel: string }[] = [
  { mode: "season", label: "Season overview", shortLabel: "Season" },
  { mode: "attention", label: "Current round attention", shortLabel: "Attention" },
  { mode: "groups", label: "Manage base groups", shortLabel: "Groups" },
];

export function PlayersModeTabs({ mode, onModeChange }: PlayersModeTabsProps) {
  return (
    <nav className="flex overflow-x-auto border-b border-[var(--border-soft)]" role="tablist" aria-label="Players view mode">
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          role="tab"
          aria-selected={mode === tab.mode}
          onClick={() => onModeChange(tab.mode)}
          className={`shrink-0 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px sm:px-4 ${
            mode === tab.mode
              ? "border-[var(--accent-strong)] text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
          }`}
        >
          <span className="hidden sm:inline">{tab.label}</span>
          <span className="sm:hidden">{tab.shortLabel}</span>
        </button>
      ))}
    </nav>
  );
}

export function usePlayersMode(initialMode?: PlayersMode) {
  const [mode, setMode] = useState<PlayersMode>(initialMode ?? "season");
  const handleModeChange = useCallback((newMode: PlayersMode) => {
    setMode(newMode);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", newMode);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, []);
  return { mode, setMode: handleModeChange };
}