"use client";

import Link from "next/link";
import { useTransition, useState, useRef, useEffect } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";
import { togglePlayerActiveAction, removePlayerAction } from "@/app/(app)/players/actions";

type AvailabilityStatus = "AVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";

type PlayerWithTeam = {
  id: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string;
  currentAvailability: AvailabilityStatus;
  active: boolean;
  nonRotatable: boolean;
  reducedMatchLoadAllowed: boolean;
  supportNoShowCount: number;
  supportSuitability: string | null;
  developmentReadiness: string | null;
  coreTeam: { id: string; name: string } | null;
};

const AVAILABILITY_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  AVAILABLE: "success",
  TENTATIVE: "warning",
  INJURED: "danger",
  SICK: "danger",
  AWAY: "warning",
  UNKNOWN: "neutral",
};

const POSITION_SHORT: Record<string, string> = {
  GK: "GK",
  CB: "CB",
  CM: "CM",
  W: "W",
  ST: "ST",
};

const GK_LABELS: Record<string, string> = {
  NO: "",
  EMERGENCY: "Emergency GK",
  YES: "GK",
};

function getInitials(firstName: string, lastName: string | null): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return last ? `${first}${last}` : first;
}

type PlayerProfileHeaderProps = {
  player: PlayerWithTeam;
  previousPlayerId: string | null;
  nextPlayerId: string | null;
  planningFlags: string[];
};

export function PlayerProfileHeader({ player, previousPlayerId, nextPlayerId, planningFlags }: PlayerProfileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

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

  const handleToggleActive = () => {
    startTransition(async () => {
      await togglePlayerActiveAction(player.id);
    });
    setMenuOpen(false);
  };

  const handleRemove = () => {
    if (!confirm(`Remove ${formatPlayerName(player)}? This cannot be undone.`)) return;
    startTransition(async () => {
      await removePlayerAction(player.id);
    });
    setMenuOpen(false);
  };

  const initials = getInitials(player.firstName, player.lastName);
  const positions = [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition].filter(Boolean) as string[];
  const gkLabel = GK_LABELS[player.goalkeeperAbility] ?? "";
  const isGK = player.goalkeeperAbility === "YES";

  return (
    <div className="flex items-start gap-4">
      {/* Identity badge: initials + shirt number */}
      <div className="relative flex flex-col items-center justify-center shrink-0">
        <div className={`flex items-center justify-center w-16 h-16 rounded-xl text-xl font-bold ${isGK ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-[var(--surface-muted)] text-zinc-100 border border-[var(--border-soft)]"}`}>
          {initials}
        </div>
        {player.shirtNumber != null && (
          <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
            {player.shirtNumber}
          </div>
        )}
      </div>

      {/* Identity info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-zinc-50">{formatPlayerName(player)}</h1>
          <StatusPill
            variant={AVAILABILITY_VARIANT[player.currentAvailability] ?? "neutral"}
            size="sm"
          >
            {formatAvailabilityStatus(player.currentAvailability)}
          </StatusPill>
          {!player.active && (
            <StatusPill variant="neutral" size="sm">Inactive</StatusPill>
          )}
          {planningFlags.map((f) => (
            <StatusPill key={f} variant="warning" size="sm">{f}</StatusPill>
          ))}
        </div>

        {/* Team + positions row */}
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[var(--text-muted)]">
            {player.coreTeam?.name ?? "Unassigned"}
          </span>
          {positions.length > 0 && (
            <span className="text-[var(--border-soft)]">·</span>
          )}
          {positions.map((pos, i) => (
            <span
              key={pos}
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                i === 0
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : i === 1
                    ? "bg-zinc-700/50 text-zinc-300"
                    : "bg-zinc-800/50 text-zinc-400"
              }`}
            >
              {POSITION_SHORT[pos] ?? pos}
            </span>
          ))}
          {gkLabel && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300">
              {gkLabel}
            </span>
          )}
        </div>
      </div>

      {/* Navigation + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {previousPlayerId && (
          <Link
            href={`/players/${previousPlayerId}`}
            className="h-7 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            Prev
          </Link>
        )}
        {nextPlayerId && (
          <Link
            href={`/players/${nextPlayerId}`}
            className="h-7 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            Next
          </Link>
        )}
        <Link
          href="/players"
          className="h-7 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
        >
          All players
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-7 w-7 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors flex items-center justify-center"
            aria-label="Player actions"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 flex flex-col gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1.5 shadow-lg min-w-[140px]">
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isPending}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors text-left disabled:opacity-50"
              >
                {player.active ? "Set inactive" : "Set active"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors text-left disabled:opacity-50"
              >
                Remove player
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}