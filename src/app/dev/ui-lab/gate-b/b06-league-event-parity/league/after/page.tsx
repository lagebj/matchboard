import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MATCH_B_TEAM_KIT_COLOR } from "../../../shared/match-b-fixture";
import { CompareNav } from "../../shared/compare-nav";
import { identity, matchIdentity, timeline, opponentName } from "./fixtures";

/**
 * B06 — League · After (completed, read-only Overview). fixtureVersion 2 — B3-R2/R4/R6
 * remediation. "Continue report" is deliberately NOT a link to the B05 candidate anymore — B05
 * is a different match (`match-gate-b-05`), and linking to it from here would silently swap
 * this match's own identity for an unrelated one under the guise of "continuing" it. League's
 * AFTER Overview never mutates the report itself regardless; it only routes onward to the
 * dedicated report workspace, disclosed here as a fact rather than a fake link.
 */
export default function B06LeagueAfterPage() {
  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: matchIdentity.score ? `${matchIdentity.score.home}-${matchIdentity.score.away}` : "—" },
    { id: "recorded-events", label: "Recorded events", value: String(timeline.length) },
    { id: "origin", label: "Origin", value: "League" },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <div className="flex items-center gap-3">
          <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; Gate B
          </Link>
          <Link
            href="/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details"
            className="text-[12px] text-[var(--text-muted)] hover:underline"
          >
            &larr; League Match Details
          </Link>
        </div>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — League · After, completed match</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <CompareNav active="league-after" />
      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor={MATCH_B_TEAM_KIT_COLOR} />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <TouchlineWidget>
        <WidgetHeader eyebrow="Match story" title={`${timeline.length} recorded events`} />
        <div className="mt-2">
          <MatchTimelineList items={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={opponentName} />
        </div>
      </TouchlineWidget>

      <MatchFlowPanel timeline={timeline} ownTeamName={matchIdentity.homeTeam} opponentName={opponentName} />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5">
        <p className="text-[12px] text-[var(--text-muted)]">
          This Overview is read-only. &ldquo;Continue report&rdquo; opens the dedicated Post-Match Report workspace for
          this same match — not reproduced as a working link here, since the only existing candidate for that
          workspace (B05) is a different match.
        </p>
        <span className="shrink-0 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-[700] text-[var(--text-muted)]">
          Continue report &rarr;
        </span>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">
        Leaving this match always returns the coach to{" "}
        <Link href="/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details" className="text-[var(--accent)] hover:underline">
          this same match&apos;s own page
        </Link>{" "}
        — the return destination is scoped to this specific match, not a generic list. See Event · After for the
        comparison.
      </p>
    </div>
  );
}
