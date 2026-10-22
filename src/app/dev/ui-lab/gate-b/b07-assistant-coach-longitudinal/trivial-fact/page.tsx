"use client";

import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { CompletedMatchAdvisorPanel } from "@/components/ai/completed-match-advisor-panel";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { identity, matchIdentity, timeline, advisorViewModel } from "./fixtures";

/**
 * B07-B — Match Details, Assistant Coach longitudinal match context: "Trivial fact" contrast.
 * Noah's hat-trick is reported correctly in the factual Match story and Key figures below. The
 * real, unmodified `CompletedMatchAdvisorPanel` renders only `viewModel.summary` here —
 * `insights: []` means `AdvisorInsightList` never mounts (same production gate B07-A relies on,
 * just the other side of it), so the hat-trick can never be surfaced a second time dressed up as
 * a longitudinal finding. `clarification: null` / `suggestions: []` keep the entire
 * mutation-wired action surface structurally unreachable, exactly as in B07-A.
 */
export default function B07TrivialFactPage() {
  const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
  const noahGoals = timeline.filter((i) => i.kind === "GOAL_FOR" && i.playerName === "Noah").length;

  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "recorded-events", label: "Recorded events", value: String(timeline.length) },
    { id: "noah-goals", label: "Noah — goals", value: String(noahGoals) },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">
          Gate B — B07-B Assistant Coach longitudinal context: trivial fact
        </h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor="#C8102E" />
      </div>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Match story" title={`${timeline.length} recorded events`} />
        <div className="mt-2">
          <MatchTimelineList items={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={matchIdentity.awayTeam} limit={10} />
        </div>
      </TouchlineWidget>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <MatchFlowPanel timeline={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={matchIdentity.awayTeam} />

      <TouchlineWidget>
        <WidgetHeader eyebrow="Coaching intent review" title="Assistant Coach" />
        <div className="mt-3">
          <OrgSlugProvider orgSlug="uilab-demo-org">
            <CompletedMatchAdvisorPanel viewModel={advisorViewModel} />
          </OrgSlugProvider>
        </div>
      </TouchlineWidget>

      <p className="text-[11px] text-[var(--text-muted)]">
        {goalsFor} goals recorded this match, {noahGoals} of them Noah&apos;s — a real hat-trick, reported
        factually above. The Assistant Coach review above does not repeat it as a finding.
      </p>
    </div>
  );
}
