import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { formatReflectionRating } from "@/lib/matches/match-detail-format";
import { getObservationLabel, isValidObservationCode, type ObservationPolarity } from "@/lib/evidence/observation-vocabulary";

/**
 * Post-Match Report "Summary" tab — real for both DRAFT and COMPLETED
 * (`05_POST_MATCH_DRAFT_SPEC.md`, `06_POST_MATCH_COMPLETED_SPEC.md`). Reconciliation, not a
 * ranking surface: "Player highlights... must not calculate a score, identify a best player, or
 * imply Player of the Match." Read-only — every mutation stays on the Players tab's existing
 * report editor.
 */
export function PostMatchSummaryTab({
  data,
  ownTeamName,
  opponentName,
  isDraft,
}: {
  data: MatchDetailAfterData;
  ownTeamName: string;
  opponentName: string;
  isDraft: boolean;
}) {
  // "Player highlights" — players appearing in captured goal/assist facts, factually summarized
  // (goals/assists count only), never a computed score or "best player" ranking.
  const highlighted = data.playerInvolvement.filter((p) => p.goals > 0 || p.assists > 0).slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Attendance" title={`${data.attendanceSummary.presentCount}/${data.attendanceSummary.totalCount} present`} />
          {data.attendanceSummary.noShowNames.length > 0 && (
            <p className="mt-2 text-[13px] text-[var(--danger)]">{data.attendanceSummary.noShowNames.join(", ")} (no-show)</p>
          )}
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader
            eyebrow="Quick facts"
            title={`${data.goalScorers.scorers.reduce((n, s) => n + s.count, 0)} goals`}
            description={`${data.assistProviders.scorers.reduce((n, s) => n + s.count, 0)} assists`}
          />
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Team reflection" title={isDraft ? (data.reflection ? "Draft — recorded" : "Draft — not recorded") : data.reflection ? "Complete" : "Not recorded"} />
          {data.reflection && (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              Effort {formatReflectionRating(data.reflection.effort)} · Cohesion {formatReflectionRating(data.reflection.teamCohesion)}
            </p>
          )}
        </TouchlineWidget>
      </div>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Timeline (goals)" title={`${data.timeline.length} events`} />
        <div className="mt-2">
          <MatchTimelineList items={data.timeline} ownTeamName={ownTeamName} opponentName={opponentName} limit={6} />
        </div>
      </TouchlineWidget>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Player highlights" title={highlighted.length > 0 ? `${highlighted.length} involved` : "None recorded yet"} />
        {highlighted.length > 0 && (
          <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
            {highlighted.map((p) => (
              <li key={p.participantKey} className="flex items-center justify-between py-1.5 text-[13px]">
                <span className="text-[var(--foreground)]">{p.playerName}</span>
                <span className="text-[var(--text-muted)]">
                  {p.goals > 0 ? `${p.goals} goal${p.goals === 1 ? "" : "s"}` : ""}
                  {p.goals > 0 && p.assists > 0 ? " · " : ""}
                  {p.assists > 0 ? `${p.assists} assist${p.assists === 1 ? "" : "s"}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TouchlineWidget>

      {data.footballObservations.length > 0 && (
        <TouchlineWidget>
          <WidgetHeader eyebrow="Football observations" title={`${data.footballObservations.length} recorded`} />
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.footballObservations.slice(0, 6).map((o) => (
              <li key={o.id} className="text-[13px]">
                <span className="text-[var(--foreground)]">{o.playerName}</span>
                <span className="ml-2 text-[var(--text-muted)]">
                  {isValidObservationCode(o.observationCode)
                    ? getObservationLabel(o.observationCode, o.polarity as ObservationPolarity)
                    : o.observationCode}
                </span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>
      )}
    </div>
  );
}
