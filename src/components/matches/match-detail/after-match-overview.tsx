import Link from "next/link";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchTacticsPanel } from "@/components/matches/match-tactics-panel";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { TouchlineButton } from "@/components/touchline";
import { StatusPill } from "@/components/ui/status-pill";
import { CompletedMatchAdvisorPanel } from "@/components/ai/completed-match-advisor-panel";
import { AdvisorPanelStale } from "@/components/ai/advisor-panel";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { formatOpponentEnvironment, formatMatchFit, formatReflectionRating } from "@/lib/matches/match-detail-format";

type SelectionRow = {
  playerId: string;
  playerName: string;
  role: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  coreTeamName: string;
  absenceReason?: string | null;
  source?: "planned" | "helper" | "match_day_addition" | "guest";
};

/**
 * Match Details AFTER-match Overview tab
 * (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md`, golden: `references/golden/crops/
 * 04_match_details_after_recorded_desktop.png`). Read-only — no report mutation controls live
 * here; every action routes to `/post-match`.
 *
 * Post-launch correction (2026-09-18): "Final lineup" now embeds the real, unchanged
 * `MatchTacticsPanel` (read-only, `planningEditable={false}`) rather than a formation-name/
 * filled-count summary — the same fix applied to the before-match Overview, for the same reason.
 * It is still the *planned/finalised* lineup, clearly a read-only historical view here — actual
 * per-player position/minutes data is not overlaid on it (ADR-0147 §5: no reliable capability
 * exists for that yet).
 */
export function AfterMatchOverview({
  presentation,
  ownKitColor,
  data,
  ownTeamName,
  opponentName,
  matchFit,
  matchId,
  teamId,
  gameFormat,
  selections,
  tabHref,
  postMatchHref,
  advisorViewModel,
}: {
  presentation: MatchPresentation;
  ownKitColor: string | null;
  data: MatchDetailAfterData;
  ownTeamName: string;
  opponentName: string;
  matchFit: string;
  matchId: string;
  teamId: string;
  gameFormat: string;
  selections: SelectionRow[];
  tabHref: (tab: string) => string;
  postMatchHref: string;
  /** `null` when there is nothing for the Advisor to show (no connection, AI disabled,
   * `post_match_review` toggle off, or no useful persisted review). */
  advisorViewModel: CompletedMatchAdvisorViewModel | null;
}) {
  const env = formatOpponentEnvironment(data.opponentObservation?.overallEnvironment ?? null);

  const factsItems: MetricStripItem[] = [
    {
      id: "goals",
      label: "Goals",
      value: presentation.score ? `${presentation.score.home}-${presentation.score.away}` : "—",
    },
    { id: "present", label: "Present", value: `${data.attendanceSummary.presentCount}/${data.attendanceSummary.totalCount}` },
    { id: "no-show", label: "No-show", value: String(data.attendanceSummary.noShowCount), tone: data.attendanceSummary.noShowCount > 0 ? "attention" : "neutral" },
    { id: "assists", label: "Assists", value: String(data.assistProviders.scorers.reduce((n, s) => n + s.count, 0)) },
    { id: "observations", label: "Observations", value: String(data.footballObservations.length) },
  ];
  if (env) factsItems.push({ id: "environment", label: "Environment", value: env });
  if (matchFit !== "UNKNOWN") factsItems.push({ id: "fit", label: "Match fit", value: formatMatchFit(matchFit) });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
          <MatchIdentityCard presentation={presentation} ownKitColor={ownKitColor} />
        </div>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Match summary" title="Team note" />
          <p className="mt-2 text-[13px] text-[var(--text-soft)]">
            {data.teamNote ? data.teamNote : "No team note recorded for this match."}
          </p>
        </TouchlineWidget>
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      {advisorViewModel?.status === "fresh" && <CompletedMatchAdvisorPanel viewModel={advisorViewModel} />}
      {advisorViewModel?.status === "stale" && <AdvisorPanelStale />}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Final lineup (as planned)
        </p>
        <MatchTacticsPanel
          matchId={matchId}
          teamId={teamId}
          teamName={ownTeamName}
          gameFormat={gameFormat}
          planningEditable={false}
          selections={selections}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Key events" title={`${data.timeline.length} recorded`} />
          <div className="mt-2">
            <MatchTimelineList items={data.timeline} ownTeamName={ownTeamName} opponentName={opponentName} limit={6} />
          </div>
          {data.timeline.length > 6 && (
            <TouchlineButton as={Link} href={tabHref("events")} variant="ghost" size="sm" className="mt-2">
              Show all {data.timeline.length} events →
            </TouchlineButton>
          )}
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Player involvement" title={`${data.playerInvolvement.length} players`} />
          <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
            {data.playerInvolvement.slice(0, 8).map((row) => (
              <li key={row.participantKey} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                <span className="min-w-0 truncate text-[var(--foreground)]">{row.playerName}</span>
                <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                  {row.minutes != null ? `${row.minutes}′` : "—"}
                  {row.goals > 0 ? ` · ${row.goals}G` : ""}
                  {row.assists > 0 ? ` · ${row.assists}A` : ""}
                </span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Team reflection" title={data.reflection ? "Recorded" : "Not recorded"} />
          {data.reflection ? (
            <ReflectionRows reflection={data.reflection} />
          ) : (
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">No team reflection recorded yet.</p>
          )}
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Notes" title={data.teamNote ? "Recorded" : "None"} />
          <p className="mt-2 text-[13px] text-[var(--text-soft)]">{data.teamNote ?? "No notes recorded."}</p>
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Post-match report" title={reportStatusLabel(data.reportStatus)} />
          <TouchlineButton as={Link} href={postMatchHref} variant={data.reportStatus === "LOCKED" ? "secondary" : "primary"} size="sm" className="mt-3">
            {data.reportStatus === "LOCKED" ? "View full report" : "Continue report"}
          </TouchlineButton>
        </TouchlineWidget>
      </div>
    </div>
  );
}

function reportStatusLabel(status: MatchDetailAfterData["reportStatus"]): string {
  if (status === "LOCKED") return "Locked";
  if (status === "REPORTED" || status === "DRAFT") return "Needs work";
  return "Not started";
}

function ReflectionRows({ reflection }: { reflection: NonNullable<MatchDetailAfterData["reflection"]> }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "Effort", value: reflection.effort },
    { label: "Team cohesion", value: reflection.teamCohesion },
    { label: "Positional shape", value: reflection.positionalShape },
    { label: "Recovery behaviour", value: reflection.recoveryBehavior },
  ];
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-[var(--text-muted)]">{r.label}</span>
          <StatusPill size="sm" variant={r.value === "STRONG" ? "success" : r.value === "NEEDS_ATTENTION" ? "warning" : "neutral"}>
            {formatReflectionRating(r.value)}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}
