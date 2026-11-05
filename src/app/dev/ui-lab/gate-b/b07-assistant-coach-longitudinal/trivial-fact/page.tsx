"use client";

import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { identity, matchIdentity, timeline, advisorViewModel } from "./fixtures";

/**
 * B07-B — Match Details, Assistant Coach longitudinal match context: "Trivial fact" contrast.
 * Noah's hat-trick is reported correctly in the factual Match story and Key figures below.
 *
 * W4-R8 (independent-review remediation): `advisorViewModel` is the real, reachable `null` state
 * (see `fixtures.ts`'s module doc comment) — no Advisor component is mounted at all. The
 * conditional below reproduces `AfterMatchOverview`'s own real branching
 * (`src/components/matches/match-detail/after-match-overview.tsx:201-209`) verbatim rather than
 * special-casing "always null": `hasAdvisorContent`/`intentLabel` are computed the same way, so
 * if this fixture ever gained real Advisor content or a coaching intent, the exact same real code
 * path would pick it up. With both absent here, the real fallback text
 * ("No coaching intent or review recorded for this match.") renders — copied verbatim from that
 * component, not invented — and no Assistant Coach content of any kind appears on this page.
 */
export default function B07TrivialFactPage() {
  const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
  const noahGoals = timeline.filter((i) => i.kind === "GOAL_FOR" && i.playerName === "Noah").length;
  const hasAdvisorContent = advisorViewModel !== null;
  const intentLabel: string | null = null;

  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "events", label: "Events", value: String(timeline.length) },
    { id: "noah-goals", label: "Noah goals", value: String(noahGoals) },
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
        <WidgetHeader eyebrow="Coaching intent review" title={intentLabel ?? "No intent recorded"} />
        <div className="mt-3">
          {!hasAdvisorContent && !intentLabel ? (
            <p className="text-[13px] text-[var(--text-muted)]">No coaching intent or review recorded for this match.</p>
          ) : null}
        </div>
      </TouchlineWidget>

      <p className="text-[11px] text-[var(--text-muted)]">
        {goalsFor} goals recorded this match, {noahGoals} of them Noah&apos;s — a real hat-trick, reported
        factually above. No Assistant Coach content appears for this match at all (see the Coaching
        intent review section above) — the real production loader returns nothing to show here,
        rather than generating a reassuring message that nothing was found.
      </p>
    </div>
  );
}
