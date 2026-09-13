import type { ReactNode } from "react";
import Link from "next/link";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";

/**
 * `PlayerCompactRow` (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §7`). Mobile roster row —
 * never a squeezed desktop table. Shirt mark, name, primary position, core team, a mode-specific
 * trailing slot (opportunity ratio, attention marker, or development summary), tap opens Player
 * Detail (mobile has no inspector — contract's own explicit rule).
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
  attentionMarker?: boolean;
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
  attentionMarker,
  className,
}: PlayerCompactRowProps) {
  return (
    <Link href={href} className={`flex items-center gap-3 py-2.5 no-underline ${className ?? ""}`}>
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
        </p>
      </div>
      {trailing ? <div className="shrink-0 text-[12px] text-[var(--text-soft)]">{trailing}</div> : null}
    </Link>
  );
}
