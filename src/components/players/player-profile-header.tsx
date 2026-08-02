"use client";

import Link from "next/link";
import { useTransition, useState, useRef, useEffect } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { BrandIllustration } from "@/components/ui/brand-illustration";
import { formatAvailabilityStatus, formatPlayerName, getPlayerAttributeAverages, getOverallStarRating } from "@/lib/player-metrics";
import { togglePlayerActiveAction, removePlayerAction, restorePlayerAction } from "@/app/(app)/players/actions";

type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";

type PlayerWithTeamAndAttributes = {
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
  removedAt: Date | null;
  coreTeam: { id: string; name: string } | null;
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
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
  EMERGENCY: "EMK",
  YES: "GK",
};

function getInitials(firstName: string, lastName: string | null): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return last ? `${first}${last}` : first;
}

type PlayerProfileHeaderProps = {
  player: PlayerWithTeamAndAttributes;
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
    if (!confirm(`Remove ${formatPlayerName(player)}? They can be restored later.`)) return;
    startTransition(async () => {
      await removePlayerAction(player.id);
    });
    setMenuOpen(false);
  };

  const handleRestore = () => {
    startTransition(async () => {
      await restorePlayerAction(player.id);
    });
    setMenuOpen(false);
  };

  const initials = getInitials(player.firstName, player.lastName);
  const positions = [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition].filter(Boolean) as string[];
  const gkLabel = GK_LABELS[player.goalkeeperAbility] ?? "";
  const isGK = player.goalkeeperAbility === "YES";

  const averages = getPlayerAttributeAverages(player);
  const overallStars = getOverallStarRating(averages.overall);
  const hasRatings = averages.overall !== null;

  return (
    <div className="relative flex items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3 overflow-hidden">
      {/* Subtle player illustration — desktop only, positioned to the right */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 md:w-32 flex items-center justify-end pr-3 opacity-40 dark:opacity-30" aria-hidden="true">
        <BrandIllustration
          name="playerPlaceholder"
          decorative
          className="h-full max-h-24 w-auto object-contain object-right"
        />
      </div>
      {/* Identity badge */}
      <div className="relative flex flex-col items-center justify-center shrink-0">
        <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-base font-bold ${isGK ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-[var(--surface-muted)] text-zinc-100 border border-[var(--border-soft)]"}`}>
          {initials}
        </div>
        {player.shirtNumber != null && (
          <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-[9px] font-bold text-white leading-none">
            {player.shirtNumber}
          </div>
        )}
      </div>

      {/* Identity info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-50 leading-tight">{formatPlayerName(player)}</h1>
          <StatusPill
            variant={AVAILABILITY_VARIANT[player.currentAvailability] ?? "neutral"}
            size="sm"
          >
            {formatAvailabilityStatus(player.currentAvailability)}
          </StatusPill>
          {!player.active && (
            <StatusPill variant="neutral" size="sm">Inactive</StatusPill>
          )}
          {player.removedAt && (
            <StatusPill variant="danger" size="sm">Removed</StatusPill>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span>{player.coreTeam?.name ?? "Unassigned"}</span>
          {positions.map((pos, i) => (
            <span
              key={pos}
              className={`inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider ${
                i === 0
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : i === 1
                    ? "bg-zinc-700/50 text-zinc-400"
                    : "bg-zinc-800/50 text-zinc-500"
              }`}
            >
              {POSITION_SHORT[pos] ?? pos}
            </span>
          ))}
          {gkLabel && (
            <span className="inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300">
              {gkLabel}
            </span>
          )}
          {hasRatings && (
            <span className="inline-flex items-center gap-0.5 ml-0.5" aria-label={`${overallStars} star overall rating`}>
              <span className="text-amber-400 text-xs leading-none">{"★".repeat(overallStars)}</span>
              <span className="text-zinc-600 text-xs leading-none">{"★".repeat(5 - overallStars)}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums ml-0.5">{averages.overall!.toFixed(1)}</span>
            </span>
          )}
        </div>
        {planningFlags.length > 0 && (
          <div className="mt-0.5 flex items-center gap-1">
            {planningFlags.map((f) => (
              <span key={f} className="text-[9px] text-amber-400/70 font-medium">{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* Navigation + actions */}
      <div className="flex items-center gap-1 shrink-0">
        {previousPlayerId && (
          <Link
            href={`/players/${previousPlayerId}`}
            className="h-6 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-[10px] font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            ‹
          </Link>
        )}
        {nextPlayerId && (
          <Link
            href={`/players/${nextPlayerId}`}
            className="h-6 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-[10px] font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
          >
            ›
          </Link>
        )}
        <Link
          href="/players"
          className="h-6 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-[10px] font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
        >
          All
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-6 w-6 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors flex items-center justify-center"
            aria-label="Player actions"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 flex flex-col gap-0.5 rounded border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1 shadow-lg min-w-[120px]">
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isPending}
                className="rounded px-2 py-1 text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors text-left disabled:opacity-50"
              >
                {player.active ? "Set inactive" : "Set active"}
              </button>
              {player.removedAt ? (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isPending}
                  className="rounded px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-950/30 transition-colors text-left disabled:opacity-50"
                >
                  Restore player
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isPending}
                  className="rounded px-2 py-1 text-[11px] text-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors text-left disabled:opacity-50"
                >
                  Remove player
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}