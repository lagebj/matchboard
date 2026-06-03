"use client";

import { useState, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FormationSlotData } from "@/lib/formations/types";
import { getPlayerSlotCompatibility } from "@/lib/formations/lineup-compatibility";

type PlayerPickInfo = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  coreTeamName?: string;
};

type PlayerPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerPickInfo[];
  slot: FormationSlotData;
  assignedPlayerIds: Set<string>;
  onSelect: (playerId: string) => void;
  onClear: () => void;
};

export function PlayerPicker({
  isOpen,
  onClose,
  players,
  slot,
  assignedPlayerIds,
  onSelect,
  onClear,
}: PlayerPickerProps) {
  const [search, setSearch] = useState("");

  const availablePlayers = useMemo(() => {
    return players
      .filter((p) => !assignedPlayerIds.has(p.id))
      .filter((p) => {
        if (!search.trim()) return true;
        const name = `${p.firstName} ${p.lastName ?? ""}`.toLowerCase();
        return name.includes(search.toLowerCase());
      })
      .map((p) => {
        const compat = getPlayerSlotCompatibility(
          { playerId: p.id, primaryPosition: p.primaryPosition, secondaryPositions: [] },
          slot,
        );
        return { ...p, isCompatible: compat.isCompatible, reason: compat.compatibilityReason };
      })
      .sort((a, b) => {
        if (a.isCompatible && !b.isCompatible) return -1;
        if (!a.isCompatible && b.isCompatible) return 1;
        const nameA = `${a.firstName} ${a.lastName ?? ""}`;
        const nameB = `${b.firstName} ${b.lastName ?? ""}`;
        return nameA.localeCompare(nameB);
      });
  }, [players, assignedPlayerIds, search, slot]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign player`}
      description={`${slot.label} (${slot.shortLabel})`}
      size="lg"
    >
      <div className="flex flex-col gap-3 max-h-[60vh]">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100"
        />

        <div className="flex flex-col gap-1 overflow-y-auto">
          {availablePlayers.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">
              {assignedPlayerIds.size > 0 ? "All players assigned" : "No players available"}
            </p>
          )}

          {availablePlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player.id)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                player.isCompatible
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 text-zinc-100"
                  : "border-[var(--border-soft)] bg-[var(--surface-base)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {player.firstName} {player.lastName ?? ""}
                </span>
                {player.coreTeamName && (
                  <span className="text-xs text-[var(--text-muted)]">{player.coreTeamName}</span>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-[var(--text-muted)]">{player.primaryPosition}</span>
                {player.isCompatible && player.reason && (
                  <span className="text-xs text-[var(--accent)]">{player.reason}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-soft)]">
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear slot
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}