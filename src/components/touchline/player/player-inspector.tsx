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
            <p className="text-[12px] text-[var(--text-soft)]">{data.currentPrimaryPosition ?? "No position set"}</p>
          </div>
        </div>
        <dl className="mt-3 flex flex-col gap-1 text-[12px]">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Availability</dt>
            <dd className="text-[var(--text-soft)]">{data.availabilityLabel}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--text-muted)]">Opportunity</dt>
            <dd className="text-[var(--text-soft)]">{data.opportunityLabel}</dd>
          </div>
          {data.activeDevelopmentFocus ? (
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Development focus</dt>
              <dd className="text-[var(--text-soft)]">{data.activeDevelopmentFocus}</dd>
            </div>
          ) : null}
        </dl>
      </TouchlineWidget>

      <PlayerPositionMapWidget positions={data.effectivePositions} />

      {data.latestObservationNote ? (
        <TouchlineWidget>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Latest observation</p>
          <p className="mt-1 text-[13px] italic leading-snug text-[var(--foreground)]">{data.latestObservationNote}</p>
        </TouchlineWidget>
      ) : null}

      <Link
        href={data.playerDetailHref}
        className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-center text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
      >
        Open player →
      </Link>
    </div>
  );
}
