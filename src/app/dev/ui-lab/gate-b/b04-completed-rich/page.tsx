"use client";

import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { WhatThisMatchAddedPanel } from "@/components/matches/match-detail/what-this-match-added-panel";
import { MatchInsightCard } from "@/components/matches/match-insights/match-insight-card";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { buildMatchFlowChronology } from "@/lib/matches/completed-match-story";
import { chronologyReconcilesWithFinalScore } from "../shared/chronology-reconciliation";
import { useSourceInspector } from "../../gate-a/a04-evidence-grammar/shared/use-source-inspector";
import { SourceInspector } from "../../gate-a/a04-evidence-grammar/shared/source-inspector";
import { b04CombinationSourceRecords } from "../shared/match-b-fixture";
import { identity, matchIdentity, timeline, matchInsights, whatThisMatchAddedInput } from "./fixtures";

/**
 * B04 — Completed match, richer evidence. Real components fed a fixture whose chronology
 * reconciles exactly with the final score, demonstrating "earned findings with source
 * drilldown" — never a forced chart panel, never possession/xG/shots/cards/ratings/Player of the
 * Match.
 *
 * Design-audit (Phase 2): confirmed, not just assumed — `chronologyReconcilesWithFinalScore()`
 * (the same B03 helper) is run against this fixture and is `true` by construction (4-1 final,
 * four GOAL_FOR + one GOAL_AGAINST, all timed), so B03's proposed reconciliation note correctly
 * never renders here. No alternate composition proposed for this scenario.
 *
 * Independent review remediation (B1-R3): the real `MatchInsights` wrapper hardcodes a pre-match
 * heading ("What's useful to know when planning this match.") that is wrong for a completed
 * match — this composes the real, separately-exported `MatchInsightCard` directly instead, under
 * a completed-match-appropriate heading, without editing the production wrapper component. The
 * insight's own "Evidence" `<details>` disclosure (also real, unmodified) only ever showed a
 * count of references; this adds a genuine source-inspection trigger, reusing Gate A's approved
 * A04 evidence grammar (`SourceInspector`/`SourceRecordList`), so the coach can see the two actual
 * recorded goal events behind the "2 matches" claim, not just an internal id count.
 */
export default function B04CompletedRichPage() {
  const substitutionCount = timeline.filter((i) => i.kind === "ROTATION").length;
  const assistCount = timeline.filter((i) => i.assistPlayerName !== null).length;

  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "recorded-events", label: "Recorded events", value: String(timeline.length) },
    { id: "assists", label: "Assists", value: String(assistCount) },
    { id: "substitutions", label: "Substitutions", value: String(substitutionCount) },
    { id: "observations", label: "Observations", value: String(whatThisMatchAddedInput.observationCount) },
  ];

  const chronology = buildMatchFlowChronology(timeline);
  const chronologyReconciles = chronologyReconcilesWithFinalScore(matchIdentity, chronology);
  const evidenceInspector = useSourceInspector();

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Gate B — B04 Completed match, richer evidence</h1>
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
      {!chronologyReconciles && (
        <p className="text-xs text-[var(--text-muted)]" data-testid="match-flow-reconciliation-note">
          This chronology does not reconcile with the final score.
        </p>
      )}

      <Surface padding="md">
        <SectionHeader title="Match Insights" description="What this match's recorded evidence shows." />
        <div className="mt-3 divide-y divide-[var(--border-soft)]">
          {matchInsights.insights.map((insight) => (
            <MatchInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
        <button
          type="button"
          onClick={evidenceInspector.open}
          className="mt-2 self-start text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Inspect combination evidence <span aria-hidden="true">→</span>
        </button>
      </Surface>

      <SourceInspector
        isOpen={evidenceInspector.isOpen}
        onClose={evidenceInspector.close}
        title="B04 combination evidence"
        description="Two individually logged goal events — the AI's combined-pairing claim above is its own interpretation of these two separate facts, not a third recorded fact."
        sources={b04CombinationSourceRecords}
      />

      <WhatThisMatchAddedPanel input={whatThisMatchAddedInput} />
    </div>
  );
}
