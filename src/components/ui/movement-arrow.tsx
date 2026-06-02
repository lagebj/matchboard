"use client";

import { cn } from "@/lib/cn";
import { MoveRight } from "lucide-react";
import { TeamShield } from "@/components/ui/team-shield";

/**
 * MovementArrow — visualize movement between teams.
 *
 * Displays as: TeamA → TeamB with optional role and week.
 * Uses TeamShield for team identity where practical.
 * No cartoon movement.
 */
type MovementArrowProps = {
  fromTeam: string;
  toTeam: string;
  role?: string | null;
  week?: string | null;
  compact?: boolean;
  className?: string;
};

export function MovementArrow({
  fromTeam,
  toTeam,
  role,
  week,
  compact = false,
  className,
}: MovementArrowProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <TeamShield teamName={fromTeam} size={compact ? "sm" : "md"} />
      <div className="flex flex-col items-center gap-0.5">
        <MoveRight
          className={cn("text-[var(--text-muted)]", compact ? "h-3 w-3" : "h-4 w-4")}
          aria-hidden="true"
        />
        {role && !compact && (
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
            {role}
          </span>
        )}
      </div>
      <TeamShield teamName={toTeam} size={compact ? "sm" : "md"} />
      {week && !compact && (
        <span className="text-[10px] text-[var(--text-muted)]">{week}</span>
      )}
    </div>
  );
}