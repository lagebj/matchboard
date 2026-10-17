import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { WhatThisMatchAddedPanel } from "@/components/matches/match-detail/what-this-match-added-panel";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { identity, matchIdentity, timeline, whatThisMatchAddedInput } from "./fixtures";

/**
 * B03 — Completed match, sparse events. Real components (`MatchIdentityCard`,
 * `MatchTimelineList`, `MatchFlowPanel`, `WhatThisMatchAddedPanel`) fed a fixture where the
 * recorded score (6-4) and the recorded chronology (1 event) genuinely disagree in completeness
 * — demonstrating the real "result vs. partial chronology" split, not a simulated one.
 * `MatchTacticsPanel`/`PlanVsRealityPanel` (final lineup, plan-vs-reality) are not reused here —
 * see DATA_TRUTH_AND_FIXTURES.md for why.
 */
export default function B03CompletedSparsePage() {
  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "recorded-events", label: "Recorded events", value: String(timeline.length) },
    { id: "assists", label: "Assists", value: "0" },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gate B — B03 Completed match, sparse events</p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor="#C8102E" />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <TouchlineWidget>
        <WidgetHeader eyebrow="Match story" title={`${timeline.length} recorded event${timeline.length === 1 ? "" : "s"}`} />
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          The 6-4 result is the final recorded score. Only {timeline.length} individual event was logged for this match — the two are tracked
          separately, never merged into an invented play-by-play.
        </p>
        <div className="mt-2">
          <MatchTimelineList items={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={matchIdentity.awayTeam} />
        </div>
      </TouchlineWidget>

      <MatchFlowPanel timeline={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={matchIdentity.awayTeam} />

      <WhatThisMatchAddedPanel input={whatThisMatchAddedInput} />
    </div>
  );
}
