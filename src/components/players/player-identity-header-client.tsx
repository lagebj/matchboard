"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { PlayerIdentityHero } from "@/components/touchline/player/player-identity-hero";
import type { PlayerIdentityViewModel } from "@/lib/touchline/presentation/player-identity-view-model";
import { PlayerLifecycleActions } from "./player-lifecycle-actions";

/**
 * Production wrapper for the gate-approved `PlayerIdentityHero` on the Player Detail page
 * (Atlas Follow-up Phase F8). Owns the two genuinely client-side concerns the read-only hero
 * itself must not: record-to-record prev/next player navigation in the hero's overflow area
 * (feature file: "Record-to-record navigation"), and the active/remove/restore lifecycle
 * actions that previously lived in the old `PlayerProfileHeader`'s overflow menu — every one
 * an existing server action, unchanged.
 */
export type PlayerIdentityHeaderClientProps = {
  identity: PlayerIdentityViewModel;
  playerId: string;
  playerActive: boolean;
  playerRemoved: boolean;
  playerDisplayName: string;
  previousPlayerId: string | null;
  nextPlayerId: string | null;
  backHref: string;
};

export function PlayerIdentityHeaderClient({
  identity,
  playerId,
  playerActive,
  playerRemoved,
  playerDisplayName,
  previousPlayerId,
  nextPlayerId,
  backHref,
}: PlayerIdentityHeaderClientProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <PlayerIdentityHero
      identity={identity}
      onBack={() => router.back()}
      overflow={
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-52 flex-col gap-0.5 rounded-[var(--tl-c-radius-control)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-raised)] p-1 shadow-lg">
              {previousPlayerId ? (
                <Link
                  href={`/players/${previousPlayerId}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] no-underline hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  ‹ Previous player
                </Link>
              ) : null}
              {nextPlayerId ? (
                <Link
                  href={`/players/${nextPlayerId}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] no-underline hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  Next player ›
                </Link>
              ) : null}
              <PlayerLifecycleActions playerId={playerId} active={playerActive} removed={playerRemoved} playerDisplayName={playerDisplayName} />
              <Link
                href={backHref}
                onClick={() => setMenuOpen(false)}
                className="rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] no-underline hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                All players
              </Link>
            </div>
          ) : null}
        </div>
      }
    />
  );
}