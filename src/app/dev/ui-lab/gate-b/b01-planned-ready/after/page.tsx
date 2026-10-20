import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { identity, matchIdentity, timeline, opponentName } from "./fixtures";

/**
 * B01 AFTER state — independent review remediation (B1-R4). Same match identity as
 * `b01-planned-ready` (same id/teamName/opponentName/kickoffAt/isHome), now `done` with a
 * recorded 2-1 result, demonstrating the register-required before/after lifecycle continuity
 * within one fixture family. Read-only — no "Edit lineup" button or any other mutation entry
 * point, matching the real completed-match Overview's own read-only contract.
 */
export default function B01AfterPage() {
  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "recorded-events", label: "Recorded events", value: String(timeline.length) },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b/b01-planned-ready" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Back to BEFORE state
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate B — B01 Before/After identity comparison (AFTER state)</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor="#C8102E" />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <TouchlineWidget>
        <WidgetHeader eyebrow="Match story" title={`${timeline.length} recorded events`} />
        <div className="mt-2">
          <MatchTimelineList items={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={opponentName} />
        </div>
      </TouchlineWidget>

      <MatchFlowPanel timeline={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={opponentName} />
    </div>
  );
}
