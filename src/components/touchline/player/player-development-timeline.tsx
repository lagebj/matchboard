import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import type {
  PlayerDevelopmentObservationEntry,
  PlayerCompletedFocusEntry,
} from "@/lib/touchline/presentation/player-development-view-model";

/**
 * `PlayerDevelopmentTimeline` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §6`) — the
 * chronological observation timeline and completed-focus history. Never a numeric ranking
 * (contract's own rule) — observations are shown as authored notes, in order, nothing else.
 */
export type PlayerDevelopmentTimelineProps = {
  observations: PlayerDevelopmentObservationEntry[];
  completedFocusHistory: PlayerCompletedFocusEntry[];
  className?: string;
};

export function PlayerDevelopmentTimeline({ observations, completedFocusHistory, className }: PlayerDevelopmentTimelineProps) {
  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <TouchlineWidget>
        <WidgetHeader eyebrow="Observations" title="Chronological timeline" />
        <ul className="mt-3 flex flex-col gap-3">
          {observations.map((o) => (
            <li key={o.id} className="border-l-2 border-[var(--border-soft)] pl-3">
              <p className="text-[13px] leading-snug text-[var(--foreground)]">{o.note}</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {o.createdAt}
                {o.matchLabel ? ` · ${o.matchLabel}` : ""}
              </p>
            </li>
          ))}
          {observations.length === 0 ? <li className="text-[12px] text-[var(--text-muted)]">No observations recorded yet.</li> : null}
        </ul>
      </TouchlineWidget>

      {completedFocusHistory.length > 0 ? (
        <TouchlineWidget>
          <WidgetHeader eyebrow="Completed focus history" title="Previously active focus areas" />
          <ul className="mt-3 flex flex-col divide-y divide-[var(--border-soft)]">
            {completedFocusHistory.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-[var(--foreground)]">{f.focus}</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {f.startedAt} – {f.completedAt}
                </span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>
      ) : null}
    </div>
  );
}
