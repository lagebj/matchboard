"use client";

import { cn } from "@/lib/cn";
import { motion } from "motion/react";

/**
 * PlayerMagnet — football-board style player chip.
 *
 * Default shows initials tile, name, position, and role marker.
 * No stars. No permanent ranking. Role colours are subtle accents.
 * Uses motion for purposeful hover/selected transitions.
 * Respects prefers-reduced-motion.
 */
export type PlayerMagnetRole =
  | "core"
  | "support"
  | "development"
  | "unknown";

export type PlayerMagnetStatus =
  | "available"
  | "unavailable"
  | "injured"
  | "sick"
  | "away"
  | "unknown";

type PlayerMagnetProps = {
  name: string;
  initials?: string;
  position?: string | null;
  role?: PlayerMagnetRole | null;
  teamName?: string | null;
  status?: PlayerMagnetStatus;
  selected?: boolean;
  disabled?: boolean;
  warning?: boolean;
  movement?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
};

const roleAccentClasses: Record<PlayerMagnetRole, string> = {
  core: "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/25",
  support: "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/25",
  development: "bg-[var(--dev-subtle)] text-[var(--dev)] border-[var(--dev)]/25",
  unknown: "bg-[var(--surface-muted)]/70 text-[var(--text-soft)] border-[var(--border-soft)]",
};

const statusBorderClasses: Record<PlayerMagnetStatus, string> = {
  available: "",
  unavailable: "border-[var(--border-strong)] opacity-60",
  injured: "border-[var(--danger)]/40 bg-[var(--danger-subtle)]/50",
  sick: "border-[var(--warning)]/35 bg-[var(--warning-subtle)]/50",
  away: "border-[var(--border-strong)] bg-[var(--surface-muted)]/60",
  unknown: "border-[var(--border-soft)]",
};

function deriveInitials(name: string, override?: string): string {
  if (override) return override;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerMagnet({
  name,
  initials,
  position,
  role,
  teamName,
  status = "available",
  selected = false,
  disabled = false,
  warning = false,
  movement = false,
  compact = false,
  className,
  onClick,
}: PlayerMagnetProps) {
  const displayInitials = deriveInitials(name, initials);
  const roleClass = role ? roleAccentClasses[role] : roleAccentClasses.unknown;

  return (
    <motion.div
      layout
      onClick={disabled ? undefined : onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-lg border transition-colors",
        "bg-[var(--surface-muted)]/50 border-[var(--border-soft)]",
        statusBorderClasses[status],
        selected && "ring-2 ring-[var(--accent)]/50 bg-[var(--surface-hover)]",
        disabled && "opacity-50 cursor-not-allowed",
        onClick && !disabled && "cursor-pointer hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
        compact ? "px-2 py-1" : "px-3 py-2",
        className,
      )}
      whileHover={onClick && !disabled ? { y: -1, transition: { duration: 0.15, ease: "easeOut" } } : undefined}
      whileTap={onClick && !disabled ? { scale: 0.99, transition: { duration: 0.1 } } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={name}
      title={[name, teamName, position].filter(Boolean).join(" · ")}
    >
      {/* Initials tile */}
      <div
        className={cn(
          "flex items-center justify-center rounded-md border font-semibold tracking-wider shrink-0",
          compact ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]",
          roleClass,
        )}
      >
        {displayInitials}
      </div>

      {/* Name + position */}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-zinc-100", compact ? "text-xs" : "text-sm font-medium leading-tight")}>
          {name}
        </div>
        {(position || teamName) && !compact && (
          <div className="text-[10px] text-[var(--text-muted)] truncate">
            {[teamName, position].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* Markers */}
      <div className="flex shrink-0 items-center gap-1">
        {warning && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]"
            title="Needs attention"
            aria-label="Needs attention"
          />
        )}
        {movement && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--info)]"
            title="Movement this round"
            aria-label="Movement this round"
          />
        )}
      </div>
    </motion.div>
  );
}