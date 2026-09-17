import type { ReactNode } from "react";
import Link from "next/link";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { cn } from "@/lib/cn";

/**
 * `PlayerCompactRow` (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §7`). Mobile roster row —
 * never a squeezed desktop table. Shirt mark, name, primary position, core team, a mode-specific
 * trailing slot (opportunity/roster status, attention marker, or development summary), tap opens
 * Player Detail (mobile has no inspector — contract's own explicit rule).
 */
export type PlayerCompactRowProps = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  primaryPosition: string | null;
  coreTeamName: string | null;
  href: string;
  trailing?: ReactNode;
  /** Text colour treatment for `trailing` — "attention" for a warning-worthy state (e.g. "Needs
      plan"), "neutral" for a plain status (e.g. "Inactive"/"Removed"), "quiet" (default) for the
      prior positive/neutral treatment. Never the only signal — `trailing` is always real text,
      never colour alone (roster-state-and-mobile-convergence pass §19). */
  trailingTone?: "quiet" | "attention" | "neutral";
  attentionMarker?: boolean;
  /** Extra secondary-line detail appended after the core team — e.g. a non-default football
      availability ("Doubtful") for an otherwise-ordinary active player. Kept as its own prop
      rather than concatenated into `coreTeamName` (§20). */
  availabilityNote?: string | null;
  className?: string;
};

export function PlayerCompactRow({
  displayName,
  shirtNumber,
  kitColor,
  primaryPosition,
  coreTeamName,
  href,
  trailing,
  trailingTone = "quiet",
  attentionMarker,
  availabilityNote,
  className,
}: PlayerCompactRowProps) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 py-2.5 no-underline", className)}>
      <TeamKitMark color={kitColor} number={shirtNumber} size="sm" ariaLabel={`${displayName}'s shirt`} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-[600] text-[var(--foreground)]">
          {displayName}
          {attentionMarker ? (
            <span title="Needs attention">
              {/* Visually-hidden text, not aria-label — aria-label is prohibited on a span with
                  no role (axe `aria-prohibited-attr`, WCAG 4.1.2). */}
              <span className="sr-only">Needs attention</span>
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
            </span>
          ) : null}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {primaryPosition ?? "No position"}
          {coreTeamName ? ` · ${coreTeamName}` : ""}
          {availabilityNote ? ` · ${availabilityNote}` : ""}
        </p>
      </div>
      {trailing ? (
        <div
          className={cn(
            "shrink-0 text-[12px]",
            trailingTone === "attention" && "font-[600] text-[var(--warning)]",
            trailingTone === "neutral" && "text-[var(--text-muted)]",
            trailingTone === "quiet" && "text-[var(--text-soft)]",
          )}
        >
          {trailing}
        </div>
      ) : null}
    </Link>
  );
}
