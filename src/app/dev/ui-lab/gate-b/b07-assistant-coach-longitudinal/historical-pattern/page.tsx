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
import { useSourceInspector } from "../../../gate-a/a04-evidence-grammar/shared/use-source-inspector";
import { SourceInspector } from "../../../gate-a/a04-evidence-grammar/shared/source-inspector";
import { identity, matchIdentity, timeline, sourceRecords, advisorViewModel } from "./fixtures";

/**
 * B07-A — Match Details, Assistant Coach longitudinal match context: "Historical pattern."
 * The real, unmodified `CompletedMatchAdvisorPanel` fed a fixture `viewModel` whose
 * `clarification` is `null` and `suggestions` is `[]` — the only two fields that ever render a
 * production-mutation-wired control (`ClarifyCard`/`DevelopmentSuggestionCard`), so this mount is
 * not an adapter, it is the real component with its entire action surface structurally
 * unreachable by construction (see `__tests__/page.test.tsx`'s own assertion of this).
 *
 * The primary insight cites two distinct evidence categories ("Match data" + "Coach observation")
 * from three distinct matches — never a repackaging of this match's own goal events as a
 * "discovery." `SourceInspector` (Gate A's A04 evidence grammar, reused unmodified) makes the
 * six underlying records inspectable rather than exposing only a reference count.
 */
export default function B07HistoricalPatternPage() {
  const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
  const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
  const evidenceInspector = useSourceInspector();
  const intentLabel: string | null = null;

  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "events", label: "Events", value: String(timeline.length) },
    { id: "against", label: "Against", value: String(goalsAgainst) },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">
          Gate B — B07-A Assistant Coach longitudinal context: historical pattern
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
        <WidgetHeader eyebrow="Coaching intent review" title={intentLabel ?? "No intent recorded"} />
        <div className="mt-3">
          <OrgSlugProvider orgSlug="uilab-demo-org">
            <CompletedMatchAdvisorPanel viewModel={advisorViewModel} />
          </OrgSlugProvider>
        </div>
        <button
          type="button"
          onClick={evidenceInspector.open}
          className="mt-2 self-start text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Inspect historical evidence <span aria-hidden="true">→</span>
        </button>
      </TouchlineWidget>

      <SourceInspector
        isOpen={evidenceInspector.isOpen}
        onClose={evidenceInspector.close}
        title="B07-A historical pattern evidence"
        description="Three distinct matches' own recorded debrief notes, plus each match's timed goal-against event — the pattern claim above is the coaching staff's own repeated observation, not a new fact this review invented."
        sources={sourceRecords}
      />

      <p className="text-[11px] text-[var(--text-muted)]">
        {goalsFor} goals for, {goalsAgainst} against this match — recorded in the two prior matches
        included in this review plus this one, not necessarily every match the team has played.
      </p>
    </div>
  );
}
