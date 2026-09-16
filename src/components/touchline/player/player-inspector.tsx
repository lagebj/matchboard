import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { TouchlineButton } from "@/components/touchline/controls/touchline-button";
import { PlayerPositionMapWidget } from "./player-position-map-widget";
import type { PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * `PlayerInspector` (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §4`; recomposed into one
 * cohesive surface by the Players Operating Surface visual-convergence follow-up, §10). Selecting
 * a roster row updates this panel — must feel like a preview, not a duplicate full profile
 * (contract's own instruction). Desktop-only; mobile taps straight through to Player Detail
 * instead (§7).
 *
 * One outer `TouchlineWidget` — identity, compact metrics, compact position profile, current
 * context and the "Open player" CTA are internal sections separated by hairline dividers, never
 * separate stacked cards (the prior three-widget composition was the main reason the Overview
 * still read as an intermediate/old-page state).
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

  // Identity line pairs the full label with its compact code (e.g. "Winger (W)") — but never
  // repeats itself when the compact and full labels already coincide (broad codes like
  // "Defender").
  const positionLine =
    data.currentPrimaryPositionFull && data.currentPrimaryPosition && data.currentPrimaryPositionFull !== data.currentPrimaryPosition
      ? `${data.currentPrimaryPositionFull} (${data.currentPrimaryPosition})`
      : (data.currentPrimaryPositionFull ?? data.currentPrimaryPosition ?? "No position set");

  return (
    <TouchlineWidget className={className} padding="normal">
      <div className="flex items-center gap-3">
        <TeamKitMark color={data.kitColor} number={data.shirtNumber} size="lg" ariaLabel={`${data.displayName}'s shirt`} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-[700] text-[var(--foreground)]">{data.displayName}</p>
          <p className="truncate text-[12px] text-[var(--text-soft)]">{positionLine}</p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {data.coreTeamName ?? "No core team"} · {data.availabilityLabel}
          </p>
        </div>
      </div>

      {/* Compact season metrics — the inspector's own snapshot, not a duplicate of the
          roster row (03_PLAYER_OVERVIEW_CONTRACT.md §4.7). */}
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-[var(--border-soft)] pt-3 text-center text-[12px]">
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

      <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Position profile</p>
        <div className="mt-2">
          <PlayerPositionMapWidget layout="compact" positions={data.effectivePositions} />
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current context</p>
        <dl className="mt-2 flex flex-col gap-1 text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Opportunity</dt>
            <dd className="truncate text-[var(--text-soft)]">{data.opportunityLabel}</dd>
          </div>
          {data.activeDevelopmentFocus ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Development focus</dt>
              <dd className="truncate text-[var(--text-soft)]">{data.activeDevelopmentFocus}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-muted)]">Season usage</dt>
            <dd className="text-right text-[var(--text-soft)]">
              Core {data.core} · Support {data.support} · Development {data.development}
            </dd>
          </div>
        </dl>
      </div>

      <TouchlineButton as="a" href={data.playerDetailHref} variant="primary" size="sm" fullWidth className="mt-3">
        Open player →
      </TouchlineButton>
    </TouchlineWidget>
  );
}
