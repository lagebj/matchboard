"use client";

import { useState, useCallback } from "react";

export type PlayersMode = "season" | "attention" | "groups";

type PlayersModeTabsProps = {
  mode: PlayersMode;
  onModeChange: (mode: PlayersMode) => void;
};

const tabs: { mode: PlayersMode; label: string }[] = [
  { mode: "season", label: "Season overview" },
  { mode: "attention", label: "Current round attention" },
  { mode: "groups", label: "Manage base groups" },
];

export function PlayersModeTabs({ mode, onModeChange }: PlayersModeTabsProps) {
  return (
    <nav className="flex border-b border-[var(--border-soft)]" role="tablist" aria-label="Players view mode">
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          role="tab"
          aria-selected={mode === tab.mode}
          onClick={() => onModeChange(tab.mode)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            mode === tab.mode
              ? "border-[var(--accent-strong)] text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
          }`}
        >
          {tab.label}
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