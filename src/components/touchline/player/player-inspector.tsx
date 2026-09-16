import Link from "next/link";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { PlayerPositionMapWidget } from "./player-position-map-widget";
import type { PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * `PlayerInspector` (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §4`). Selecting a roster
 * row updates this panel — must feel like a preview, not a duplicate full profile (contract's own
 * instruction). Desktop-only; mobile taps straight through to Player Detail instead (§7).
 */
export type PlayerInspectorProps = {
  data: PlayersOverviewInspectorData | null;
  className?: string;
};

export function PlayerInspector({ data, className }: PlayerInspectorProps) {
  if (!data) {
    return (
      <TouchlineWidget className={className}>
        <p className="text-[13px] text-[var(--text-muted)]">Select a player to preview their profile.</p>
      </TouchlineWidget>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <TouchlineWidget>
        <div className="flex items-center gap-3">
          <TeamKitMark color={data.kitColor} number={data.shirtNumber} size="lg" ariaLabel={`${data.displayName}'s shirt`} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-[700] text-[var(--foreground)]">{data.displayName}</p>
            <p className="text-[12px] text-[var(--text-soft)]">
              {data.coreTeamName ?? "No core team"} · {data.currentPrimaryPosition ?? "No position set"}
            </p>
          </div>
        </div>

        {/* Compact season metrics — the inspector's own snapshot, not a duplicate of the
            roster row (03_PLAYER_OVERVIEW_CONTRACT.md §4.7). */}
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-[12px]">
          <div>
            <dt className="text-[var(--text-muted)]">Played</dt>
            <dd className="text-[14px] font-[700] text-[var(--foreground)]">{data.played}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Goals</dt>
            <dd className="text-[14px] font-[700] text-[var(--foreground)]">{data.goals}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Support</dt>
            <dd className="text-[14px] font-[700] text-[var(--foreground)]">{data.support}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Dev.</dt>
            <dd className="text-[14px] font-[700] text-[var(--foreground)]">{data.development}</dd>
          </div>
        </dl>
      </TouchlineWidget>

      <PlayerPositionMapWidget positions={data.effectivePositions} />

      <TouchlineWidget>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current context</p>
        <dl className="mt-2 flex flex-col gap-1 text-[12px]">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Availability</dt>
            <dd className="text-[var(--text-soft)]">{data.availabilityLabel}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Opportunity</dt>
            <dd className="text-[var(--text-soft)]">{data.opportunityLabel}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Development focus</dt>
            <dd className="text-[var(--text-soft)]">{data.activeDevelopmentFocus ?? "No active focus"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Season usage</dt>
            <dd className="text-[var(--text-soft)]">
              Core {data.core} · Support {data.support} · Development {data.development}
            </dd>
          </div>
        </dl>
      </TouchlineWidget>

      <Link
        href={data.playerDetailHref}
        className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-center text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
      >
        Open player →
      </Link>
    </div>
  );
}
