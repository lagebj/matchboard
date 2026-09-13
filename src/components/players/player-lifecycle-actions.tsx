"use client";

import { useTransition } from "react";
import { togglePlayerActiveAction, removePlayerAction, restorePlayerAction } from "@/app/(app)/players/actions";

/**
 * Player lifecycle actions (active/inactive toggle, remove, restore) for the Player Detail
 * identity hero's overflow menu (Atlas Follow-up Phase F8) — the exact server actions the old
 * `PlayerProfileHeader` overflow menu already called, unchanged.
 */
export type PlayerLifecycleActionsProps = {
  playerId: string;
  active: boolean;
  removed: boolean;
  playerDisplayName?: string;
};

export function PlayerLifecycleActions({ playerId, active, removed, playerDisplayName }: PlayerLifecycleActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggleActive = () => {
    startTransition(async () => {
      await togglePlayerActiveAction(playerId);
    });
  };

  const handleRemove = () => {
    if (!confirm(`Remove ${playerDisplayName ?? "player"}? They can be restored later.`)) return;
    startTransition(async () => {
      await removePlayerAction(playerId);
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      await restorePlayerAction(playerId);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={isPending}
        className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        {active ? "Set inactive" : "Set active"}
      </button>
      {removed ? (
        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--success)] hover:bg-[var(--success-subtle)] disabled:opacity-50"
        >
          Restore player
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--danger)] hover:bg-[var(--danger-subtle)] disabled:opacity-50"
        >
          Remove player
        </button>
      )}
    </>
  );
}