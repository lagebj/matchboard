"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { AppearanceControl } from "@/components/touchline";
import { PlayerIdentityHero } from "@/components/touchline/player/player-identity-hero";
import { PlayerParticipationStrip } from "@/components/touchline/player/player-participation-strip";
import { PlayerPositionMapWidget } from "@/components/touchline/player/player-position-map-widget";
import { PlayerDevelopmentFocus } from "@/components/touchline/player/player-development-focus";
import { PlayerObservationStory } from "@/components/touchline/player/player-observation-story";
import { PlayerRecentFootball } from "@/components/touchline/player/player-recent-football";
import { PlayerMatchTimeline } from "@/components/touchline/player/player-match-timeline";
import { PlayerPositionTimeline } from "@/components/touchline/player/player-position-timeline";
import { PlayerDevelopmentTimeline } from "@/components/touchline/player/player-development-timeline";
import { OpportunityWidget } from "@/components/touchline/widgets/opportunity-widget";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { EvidenceStory } from "@/components/touchline/evidence/evidence-story";
import { Sparkline } from "@/components/touchline/viz/sparkline";
import { StackedDistribution } from "@/components/touchline/viz/stacked-distribution";
import { buildPlayerIdentityViewModel } from "@/lib/touchline/presentation/player-identity-view-model";
import { buildPlayerOverviewViewModel } from "@/lib/touchline/presentation/player-overview-view-model";
import { buildPlayerMatchesViewModel } from "@/lib/touchline/presentation/player-matches-view-model";
import { buildPlayerDevelopmentViewModel } from "@/lib/touchline/presentation/player-development-view-model";
import { buildPlayerEvidenceViewModel } from "@/lib/touchline/presentation/player-evidence-view-model";
import { identityInput, overviewInput, matchesInput, developmentInput, evidenceInput } from "./fixtures";

type TabKey = "overview" | "matches" | "development" | "evidence";
const TABS: TabItem<TabKey>[] = [
  { key: "overview", label: "Overview", href: "?tab=overview" },
  { key: "matches", label: "Matches", href: "?tab=matches" },
  { key: "development", label: "Development", href: "?tab=development" },
  { key: "evidence", label: "Evidence", href: "?tab=evidence" },
];

const identity = buildPlayerIdentityViewModel(identityInput);
const overview = buildPlayerOverviewViewModel(overviewInput);
const matchesVm = buildPlayerMatchesViewModel(matchesInput);
const development = buildPlayerDevelopmentViewModel(developmentInput);
const evidence = buildPlayerEvidenceViewModel(evidenceInput);

function OverviewTab() {
  return (
    <div className="flex flex-col gap-4">
      <PlayerParticipationStrip {...overview.participation} />
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        {overview.opportunity ? <OpportunityWidget {...overview.opportunity} /> : null}
        <PlayerPositionMapWidget positions={overview.effectivePositions} />
      </div>
      <PlayerObservationStory observation={overview.latestObservation} />
      <PlayerDevelopmentFocus focus={overview.activeDevelopmentFocus} />
      <PlayerRecentFootball matches={overview.recentMatches} viewAllHref="?tab=matches" />
    </div>
  );
}

function MatchesTab() {
  return (
    <div className="flex flex-col gap-4">
      <PlayerParticipationStrip {...matchesVm.seasonSummary} />
      <PlayerPositionTimeline entries={matchesVm.positionTimeline} />
      <PlayerMatchTimeline matches={matchesVm.matches} />
    </div>
  );
}

function DevelopmentTab() {
  const focus = development.activeFocus;
  return (
    <div className="flex flex-col gap-4">
      <TouchlineWidget>
        <WidgetHeader eyebrow="Development focus" title={focus ? focus.focus : "No active focus"} />
        {focus ? (
          <div className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-soft)]">
            {focus.rationale ? <p>{focus.rationale}</p> : null}
            <p className="text-[12px] text-[var(--text-muted)]">
              Started {focus.startedAt} · {focus.observationCount} observations
              {focus.reviewDueAt ? ` · Review due ${focus.reviewDueAt}` : ""}
            </p>
          </div>
        ) : null}
        {development.positionalContextNotes.map((note) => (
          <p key={note} className="mt-2 text-[12px] text-[var(--text-muted)]">{note}</p>
        ))}
      </TouchlineWidget>
      <PlayerDevelopmentTimeline observations={development.observationTimeline} completedFocusHistory={development.completedFocusHistory} />
    </div>
  );
}

function EvidenceTab() {
  return (
    <div className="flex flex-col gap-4">
      {(["OPPORTUNITY", "POSITION", "MATCH_CONTEXT"] as const).map((group) => {
        const stories = evidence.storiesByGroup[group];
        if (stories.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {group === "OPPORTUNITY" ? "Opportunity" : group === "POSITION" ? "Position" : "Match context"}
            </p>
            {stories.map((s) => (
              <EvidenceStory
                key={s.id}
                question={s.question}
                label={group === "OPPORTUNITY" ? "Opportunity" : group === "POSITION" ? "Position" : "Match context"}
                title={s.title}
                value={s.value}
                valueCaption={s.valueCaption}
                sample={s.sample}
                confidence={s.confidence}
                interpretation={s.interpretation}
                detailHref={s.detailHref}
                visual={
                  s.sparkline ? (
                    <Sparkline question={s.question} values={s.sparkline} periodLabels={s.sparklineLabels ?? []} />
                  ) : s.positionShares ? (
                    <StackedDistribution
                      question={s.question}
                      segments={s.positionShares.map((p) => ({ label: p.code, value: p.sharePercent }))}
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlayerDetailFixturePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (["overview", "matches", "development", "evidence"] as const).includes(
    (searchParams.get("tab") as TabKey) ?? "overview",
  )
    ? ((searchParams.get("tab") as TabKey) ?? "overview")
    : "overview";

  return (
    <div className="touchline mx-auto flex max-w-[440px] flex-col gap-6 px-4 py-6 medium:max-w-[720px] large:max-w-[820px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <PlayerIdentityHero identity={identity} onBack={() => router.back()} />
      <TabRail items={TABS} activeKey={activeTab} ariaLabel="Player detail tabs" />

      {activeTab === "overview" ? <OverviewTab /> : null}
      {activeTab === "matches" ? <MatchesTab /> : null}
      {activeTab === "development" ? <DevelopmentTab /> : null}
      {activeTab === "evidence" ? <EvidenceTab /> : null}
    </div>
  );
}

/**
 * `/dev/ui-lab/atlas-followup/player-detail` — Phase F4 fixture, Hard Human Gate B.
 * Reference target: `02-player-detail-original-golden.png`. Static fixture data only.
 * Tab state is URL-backed (`?tab=overview|matches|development|evidence`, contract §3) via
 * `TabRail`'s href mode — real `<Link>` navigation, so browser Back/Forward works for free.
 */
export default function PlayerDetailFixturePage() {
  return (
    <Suspense fallback={<div className="touchline p-6 text-sm text-[var(--text-muted)]">Loading…</div>}>
      <PlayerDetailFixturePageInner />
    </Suspense>
  );
}
