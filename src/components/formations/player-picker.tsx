"use client";

import { useState, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FormationSlotData } from "@/lib/formations/types";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";
import { classifyExactSuitability } from "@/domain/positions/suitability";
import { fitLabel, UNSUPPORTED_CONFIRMATION } from "@/domain/positions/labels";
import type { SuitabilityTier } from "@/domain/positions/matrix";
import type { SideInput } from "@/domain/positions/roles";

type PlayerPickInfo = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  /** Optional — exact fit uses whichever declarations are supplied (ADR-0129). */
  secondaryPosition?: string | null;
  tertiaryPosition?: string | null;
  bestSide?: SideInput;
  coreTeamName?: string;
};

type PlayerPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerPickInfo[];
  slot: FormationSlotData;
  assignedPlayerIds: Set<string>;
  currentAssignedPlayer?: PlayerPickInfo | null;
  onSelect: (playerId: string) => void;
  onClear: () => void;
};

const TIER_RANK: Record<SuitabilityTier, number> = {
  NATURAL: 0,
  STRONG: 1,
  PLAUSIBLE: 2,
  DEVELOPMENTAL: 3,
  UNSUPPORTED: 4,
};

function tierClass(tier: SuitabilityTier): string {
  switch (tier) {
    case "NATURAL":
    case "STRONG":
      return "text-[var(--accent-strong)]";
    case "PLAUSIBLE":
      return "text-[var(--text-soft)]";
    case "DEVELOPMENTAL":
      return "text-[var(--dev)]";
    case "UNSUPPORTED":
      return "text-[var(--text-muted)]";
  }
}

export function PlayerPicker({
  isOpen,
  onClose,
  players,
  slot,
  assignedPlayerIds,
  currentAssignedPlayer,
  onSelect,
  onClear,
}: PlayerPickerProps) {
  const [search, setSearch] = useState("");
  // When set, a confirmation is shown before assigning a player outside automatic fit (§15).
  const [confirmUnsupported, setConfirmUnsupported] = useState<{ playerId: string; playerName: string } | null>(null);

  const targetRole = useMemo(() => deriveExactTargetRole(slot.roleType, slot.gridX), [slot.roleType, slot.gridX]);

  const availablePlayers = useMemo(() => {
    return players
      .filter((p) => !assignedPlayerIds.has(p.id))
      .filter((p) => {
        if (!search.trim()) return true;
        const name = `${p.firstName} ${p.lastName ?? ""}`.toLowerCase();
        return name.includes(search.toLowerCase());
      })
      .map((p) => {
        const suitability = targetRole
          ? classifyExactSuitability(
              {
                primaryPosition: p.primaryPosition,
                secondaryPosition: p.secondaryPosition ?? null,
                tertiaryPosition: p.tertiaryPosition ?? null,
                bestSide: p.bestSide,
              },
              targetRole,
            )
          : null;
        return { ...p, tier: suitability?.tier ?? null, eligible: suitability?.automaticallyEligible ?? true };
      })
      .sort((a, b) => {
        const at = a.tier ? TIER_RANK[a.tier] : 0;
        const bt = b.tier ? TIER_RANK[b.tier] : 0;
        if (at !== bt) return at - bt;
        const nameA = `${a.firstName} ${a.lastName ?? ""}`;
        const nameB = `${b.firstName} ${b.lastName ?? ""}`;
        return nameA.localeCompare(nameB);
      });
  }, [players, assignedPlayerIds, search, targetRole]);

  const currentName = currentAssignedPlayer
    ? `${currentAssignedPlayer.firstName} ${currentAssignedPlayer.lastName ?? ""}`.trim()
    : null;

  function choose(playerId: string, playerName: string, tier: SuitabilityTier | null) {
    if (tier === "UNSUPPORTED") {
      setConfirmUnsupported({ playerId, playerName });
      return;
    }
    onSelect(playerId);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={currentName ? `Change assignment` : "Assign player"}
      description={
        `${slot.label} (${slot.shortLabel})` +
        (targetRole ? ` — ${targetRole}` : "") +
        (currentName ? ` · currently ${currentName}` : "")
      }
      size="lg"
    >
      {confirmUnsupported ? (
        <div className="flex flex-col gap-3">
          <p className="app-row-title">{UNSUPPORTED_CONFIRMATION.title}</p>
          <p className="text-[var(--text-body)] text-[var(--text-soft)]">
            {UNSUPPORTED_CONFIRMATION.body(confirmUnsupported.playerName, targetRole ?? slot.label)}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setConfirmUnsupported(null)}>
              {UNSUPPORTED_CONFIRMATION.cancelLabel}
            </Button>
            <div className="flex-1" />
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onSelect(confirmUnsupported.playerId);
                setConfirmUnsupported(null);
              }}
            >
              {UNSUPPORTED_CONFIRMATION.confirmLabel}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 max-h-[60vh]">
            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-base text-[var(--foreground)] medium:text-sm"
            />

            <div className="flex flex-col divide-y divide-[var(--border-soft)] overflow-y-auto">
              {availablePlayers.length === 0 && (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                  {assignedPlayerIds.size > 0 ? "All players assigned" : "No players available"}
                </p>
              )}

              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() =>
                    choose(player.id, `${player.firstName} ${player.lastName ?? ""}`.trim(), player.tier)
                  }
                  className="-mx-2 flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-[var(--foreground)] truncate">
                      {player.firstName} {player.lastName ?? ""}
                    </span>
                    {player.coreTeamName && (
                      <span className="text-[var(--text-meta)] text-[var(--text-muted)]">{player.coreTeamName}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-[var(--text-meta)] text-[var(--text-muted)]">{player.primaryPosition}</span>
                    {player.tier && (
                      <span className={cn("text-[var(--text-meta)]", tierClass(player.tier))}>
                        {fitLabel(player.tier)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-soft)] pt-3">
            <Button variant="ghost" size="sm" onClick={onClear} disabled={!currentAssignedPlayer}>
              {currentAssignedPlayer ? `Remove ${currentAssignedPlayer.firstName}` : "Clear slot"}
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
