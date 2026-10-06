import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import { buildMatchFlowChronology } from "@/lib/matches/completed-match-story";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

/**
 * Completed Match "Match flow" (`08_COMPLETED_MATCH.md`): a factual score/event chronology, not
 * a momentum model. Degrades to the plain Match story timeline (rendered elsewhere on this page)
 * whenever any goal's minute is unknown -- `buildMatchFlowChronology()` never interpolates a time
 * that was not actually recorded.
 */
export function MatchFlowPanel({
  timeline,
  ownTeamName,
  opponentName,
}: {
  timeline: MatchTimelineItem[];
  ownTeamName: string;
  opponentName: string;
}) {
  const chronology = buildMatchFlowChronology(timeline);

  return (
    <Surface padding="md">
      <SectionHeader title="Match flow" description={`${ownTeamName} vs ${opponentName} — cumulative score by event, in order.`} />
      <div className="mt-2">
        {!chronology.trustworthy && (
          <p className="text-xs text-[var(--text-muted)]">
            Event timing is incomplete for this match — see the Match story timeline above for the recorded events instead.
          </p>
        )}
        {chronology.trustworthy && chronology.points.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No goals recorded for this match.</p>
        )}
        {chronology.trustworthy && chronology.points.length > 0 && (
          <ol className="flex flex-col divide-y divide-[var(--border-soft)]">
            {chronology.points.map((point) => (
              <li key={point.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-[var(--text-muted)]">
                  {point.minuteLabel ?? "—"}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    point.kind === "GOAL_FOR" || point.kind === "GOAL_AGAINST" ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{point.label}</span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--foreground)]">
                  {point.ownGoals}-{point.opponentGoals}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Surface>
  );
}
