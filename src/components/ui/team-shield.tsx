"use client";

import { cn } from "@/lib/cn";

/**
 * TeamShield — generated internal team identity mark.
 *
 * Uses initials from team name in a shield/badge shape.
 * Professional, flat, no external logos.
 * Works for Blå, Rød, Hvit, and unknown teams.
 */
export type TeamShieldSize = "sm" | "md" | "lg";

type TeamShieldProps = {
  teamName: string;
  color?: string;
  size?: TeamShieldSize;
  className?: string;
};

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeClasses: Record<TeamShieldSize, string> = {
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-10 w-10 text-[13px]",
};

const defaultColors = [
  "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/30",
  "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/30",
  "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/30",
  "bg-[var(--dev-subtle)] text-[var(--dev)] border-[var(--dev)]/30",
];

function getColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return defaultColors[Math.abs(hash) % defaultColors.length];
}

export function TeamShield({ teamName, color, size = "md", className }: TeamShieldProps) {
  const initials = getInitials(teamName);
  const colorClass = color ?? getColorClass(teamName);

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-semibold tracking-wider",
        sizeClasses[size],
        colorClass,
        className,
      )}
      aria-label={teamName}
      title={teamName}
    >
      {initials}
    </div>
  );
}