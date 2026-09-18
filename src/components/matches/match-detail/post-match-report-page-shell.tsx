"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { TabRail } from "@/components/ui/tab-rail";
import { PostMatchReportHeader } from "@/components/matches/match-detail/post-match-report-header";
import { PostMatchSummaryTab } from "@/components/matches/match-detail/post-match-summary-tab";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { PostMatchReviewTab } from "@/components/matches/match-detail/post-match-review-tab";
import { PostMatchPage } from "@/components/assistant/post-match-page";
import { PostMatchUnresolvedBanner } from "@/components/live-match/post-match-unresolved-banner";
import { GoalAttributionGapBanner } from "@/components/matches/goal-attribution-gap-banner";
import { TeamReflectionSection } from "@/components/matches/team-reflection-section";
import { FootballObservationSection } from "@/components/player-development/football-observation-section";
import { ObservationSection } from "@/components/opponents/observation-section";
import { LegacyMatchFeedbackSection } from "@/components/matches/legacy-match-feedback-section";
import { MatchCombinationEvidencePanel } from "@/components/matches/match-combination-evidence-panel";
import { getPostMatchReportTabs, resolvePostMatchReportTab, type PostMatchReportSurfaceState, type PostMatchTabKey } from "@/lib/matches/match-detail-tabs";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { MatchReportDetail } from "@/app/(app)/matches/[matchId]/post-match/actions";
import type { GoalAttributionGap } from "@/lib/reports/report-mutations";
import type { PostMatchReportTimingReviewRow } from "@/lib/reports/post-match-report-view-model";

/**
 * PostMatchReportPageShell — the lifecycle-aware Post-Match Report orchestrator
 * (`05_POST_MATCH_DRAFT_SPEC.md` / `06_POST_MATCH_COMPLETED_SPEC.md`). Every existing mutation
 * workflow (`PostMatchPage`/`PostMatchReportShell`, `TeamReflectionSection`,
 * `FootballObservationSection`, `ObservationSection`, `LegacyMatchFeedbackSection`,
 * `MatchCombinationEvidencePanel`) is reused completely unchanged — this shell only decides
 * *where in the tab tree* each already-working component renders, plus adds the new read-only
 * Summary/Timeline reconciliation tabs built from already-loaded facts.
 */
export function PostMatchReportPageShell({
  matchId,
  breadcrumbHref,
  title,
  surfaceState,
  completedByLabel,
  presentation,
  ownKitColor,
  afterData,
  reviewHref,
  matchDetailHref,
  ownTeamName,
  opponentName,
  postMatchPageProps,
  observationSectionProps,
  teamReflectionProps,
  footballObservationProps,
  legacyFeedbackProps,
  combinationEvidenceProps,
}: {
  matchId: string;
  breadcrumbHref: string;
  title: string;
  surfaceState: PostMatchReportSurfaceState;
  completedByLabel: string | null;
  presentation: MatchPresentation;
  ownKitColor: string | null;
  afterData: MatchDetailAfterData;
  reviewHref: string;
  matchDetailHref: string;
  ownTeamName: string;
  opponentName: string;
  postMatchPageProps: {
    matchId: string;
    initialReport: MatchReportDetail | null;
    allPlayers: Array<{ id: string; name: string; teamName: string }>;
    hasFinalizedSelections?: boolean;
    goalAttributionGap?: GoalAttributionGap | null;
    timingReview?: PostMatchReportTimingReviewRow[];
    outOfRangeEventCount?: number;
  };
  observationSectionProps: React.ComponentProps<typeof ObservationSection>;
  teamReflectionProps: React.ComponentProps<typeof TeamReflectionSection>;
  footballObservationProps: React.ComponentProps<typeof FootballObservationSection>;
  legacyFeedbackProps: React.ComponentProps<typeof LegacyMatchFeedbackSection>;
  combinationEvidenceProps: React.ComponentProps<typeof MatchCombinationEvidencePanel>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabs = getPostMatchReportTabs(surfaceState);
  const requestedTab = searchParams.get("tab");
  const activeTab = resolvePostMatchReportTab(surfaceState, requestedTab);

  // Pin the resolved default into the URL the first time it's used (no `?tab=` present yet).
  // Without this, the default tab is a *live* function of `surfaceState`, which itself changes
  // mid-session as a direct side effect of an action taken ON the currently-viewed tab —
  // completing the report (DRAFT -> COMPLETED) would otherwise silently re-derive a different
  // default (`summary`) after the very `router.refresh()` that completion triggers, yanking the
  // coach off the Players tab immediately after they just used it
  // (`e2e/post-match-evidence-parity.spec.ts` proved this against the real UI: the "Locked"
  // status pill never appeared because the page had already navigated away from it). Once
  // pinned, `?tab=players` stays valid and selected through the DRAFT -> COMPLETED transition
  // (`players` is a real tab in both tab sets).
  useEffect(() => {
    if (requestedTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
    // Intentionally depends only on `requestedTab` — re-running this whenever
    // `activeTab`/`surfaceState` change is exactly the bug this effect exists to prevent.
  }, [requestedTab]);

  function selectTab(tab: PostMatchTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const playerNameById = Object.fromEntries(postMatchPageProps.allPlayers.map((p) => [p.id, p.name]));
  const isDraft = surfaceState === "DRAFT";

  return (
    // Touchline island (theme-aware — ADR-0134).
    <div className="touchline flex flex-col gap-5">
      <a href={matchDetailHref} className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
        ‹ Back to match
      </a>

      <PostMatchReportHeader
        breadcrumbLabel="Matches"
        breadcrumbHref={breadcrumbHref}
        title={title}
        surfaceState={surfaceState}
        completedByLabel={completedByLabel}
        presentation={presentation}
        ownKitColor={ownKitColor}
        presentCount={afterData.attendanceSummary.presentCount}
        totalCount={afterData.attendanceSummary.totalCount}
        noShowCount={afterData.attendanceSummary.noShowCount}
        goalsCount={afterData.goalScorers.scorers.reduce((n, s) => n + s.count, 0)}
        assistsCount={afterData.assistProviders.scorers.reduce((n, s) => n + s.count, 0)}
      />

      {isDraft && <PostMatchUnresolvedBanner subjectId={matchId} playerNameById={playerNameById} />}
      {isDraft && <GoalAttributionGapBanner gap={afterData.goalAttributionGap} />}

      <TabRail items={tabs} activeKey={activeTab} variant="pill" ariaLabel="Report sections" onSelect={selectTab} />

      {activeTab === "summary" && (
        <PostMatchSummaryTab data={afterData} ownTeamName={ownTeamName} opponentName={opponentName} isDraft={isDraft} />
      )}

      {activeTab === "timeline" && (
        <MatchTimelineList items={afterData.timeline} ownTeamName={ownTeamName} opponentName={opponentName} />
      )}

      {activeTab === "players" && <PostMatchPage {...postMatchPageProps} />}

      {activeTab === "reflection" && (
        <div className="flex flex-col gap-4">
          <TeamReflectionSection {...teamReflectionProps} />
          <FootballObservationSection {...footballObservationProps} />
          <ObservationSection {...observationSectionProps} />
          <LegacyMatchFeedbackSection {...legacyFeedbackProps} />
        </div>
      )}

      {activeTab === "review" && <PostMatchReviewTab reviewHref={reviewHref} />}

      {activeTab === "combinations" && <MatchCombinationEvidencePanel {...combinationEvidenceProps} />}
    </div>
  );
}
