"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TabRail } from "@/components/ui/tab-rail";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { PostMatchReportHeader } from "@/components/matches/match-detail/post-match-report-header";
import { PostMatchSummaryTab } from "@/components/matches/match-detail/post-match-summary-tab";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { PostMatchReviewTab } from "@/components/matches/match-detail/post-match-review-tab";
import { PostMatchReportShell } from "@/components/matches/post-match-report-shell";
import { PostMatchUnresolvedBanner } from "@/components/live-match/post-match-unresolved-banner";
import { GoalAttributionGapBanner } from "@/components/matches/goal-attribution-gap-banner";
import { PostMatchDebrief } from "@/components/post-match/debrief/post-match-debrief";
import { FootballObservationSection } from "@/components/player-development/football-observation-section";
import { MatchCombinationEvidencePanel } from "@/components/matches/match-combination-evidence-panel";
import { getPostMatchReportTabs, resolvePostMatchReportTab, type PostMatchTabKey } from "@/lib/matches/match-detail-tabs";
import { aggregateGoalScorers, aggregateAssistProviders, buildPlayerInvolvement } from "@/lib/matches/match-detail-view-model";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { PostMatchReportViewModel, PostMatchReportCapabilities, PostMatchAvailablePlayer } from "@/lib/reports/post-match-report-view-model";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { useSafeReportLifecycle, type SafeReportLocalState } from "./use-safe-report-lifecycle";
import {
  b05PresentParticipants,
  b05MinutesByParticipant,
  b05ObservationCountByParticipant,
} from "./report-data";

const CAPABILITIES: PostMatchReportCapabilities = { hasUnplannedReason: true };

/**
 * B2-R3/B2-R5/B2-R6 remediation. Replicates `PostMatchReportPageShell`'s own JSX structure
 * (same header, banners, tab rail, every tab EXCEPT Players) because that production component
 * offers no seam to substitute what it renders for the Players tab — it always mounts the real,
 * unsafe `PostMatchPage` there. Every other tab renders the exact same real components the
 * production shell uses, unmodified. The Players tab renders the shared `PostMatchReportShell`
 * (ARR-0034) directly, fed by `useSafeReportLifecycle`'s fixture-local state — never the real
 * `PostMatchPage`, never a production server action.
 *
 * Also resolves B2-R6 for this candidate specifically: the banners render exactly once here
 * (production renders them twice — once in the shell, once inside the nested `PostMatchPage` —
 * a separately tracked, real production defect; see BLOCKERS.md). This candidate does not claim
 * that duplication is fixed in production.
 */
export function SafePostMatchReportShell({
  matchId,
  title,
  presentation,
  ownKitColor,
  ownTeamName,
  opponentName,
  staticAfterData,
  initialLocalState,
  completedByLabel: initialCompletedBy,
  debriefAnswers,
  allPlayers,
  footballObservations,
  combinationEvidence,
}: {
  matchId: string;
  title: string;
  presentation: MatchPresentation;
  ownKitColor: string | null;
  ownTeamName: string;
  opponentName: string;
  staticAfterData: MatchDetailAfterData;
  initialLocalState: SafeReportLocalState;
  completedByLabel: string;
  debriefAnswers: DebriefAnswersSection;
  allPlayers: Array<{ id: string; name: string; teamName: string }>;
  footballObservations: Array<{ id: string; playerId: string; playerName: string; observationCode: string; polarity: string; note: string }>;
  combinationEvidence: CombinationEvidenceRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useSafeReportLifecycle(initialLocalState, initialCompletedBy);

  const surfaceState = state.status === "LOCKED" ? "COMPLETED" : "DRAFT";
  const isDraft = surfaceState === "DRAFT";
  const tabs = getPostMatchReportTabs(surfaceState);
  const requestedTab = searchParams.get("tab");
  const activeTab = resolvePostMatchReportTab(surfaceState, requestedTab);

  // Same URL-pinning behaviour the real shell has (ADR-0147 §1b) — pins the resolved default on
  // first load so `?tab=players` survives the DRAFT -> COMPLETED transition.
  useEffect(() => {
    if (requestedTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [requestedTab]);

  function selectTab(tab: PostMatchTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Live-derived facts — recomputed from the lifecycle state via the real production pure
  // functions, never hand-maintained duplicates. Attendance/timeline/reflection stay static
  // (not affected by the Players tab's own goal/assist/attendance edits in this scenario).
  const liveGoalScorers = useMemo(
    () => aggregateGoalScorers(state.goals.map((g) => ({ id: g.id, participantKey: g.playerId, playerName: g.playerName, minute: g.minute, type: "NORMAL" as const }))),
    [state.goals],
  );
  const liveAssistProviders = useMemo(
    () => aggregateAssistProviders(state.assists.map((a) => ({ id: a.id, participantKey: a.playerId, playerName: a.playerName, type: "NORMAL" as const }))),
    [state.assists],
  );
  const liveGoalAttributionGap = useMemo(
    () => ({
      liveGoalsRecorded: staticAfterData.goalAttributionGap?.liveGoalsRecorded ?? state.goals.length,
      attributedGoals: state.goals.length,
      hasGap: state.goals.length < (staticAfterData.goalAttributionGap?.liveGoalsRecorded ?? state.goals.length),
    }),
    [state.goals, staticAfterData.goalAttributionGap],
  );
  const livePlayerInvolvement = useMemo(
    () =>
      buildPlayerInvolvement({
        presentParticipants: b05PresentParticipants,
        goals: state.goals.map((g) => ({ id: g.id, participantKey: g.playerId, playerName: g.playerName, minute: g.minute, type: "NORMAL" as const })),
        assists: state.assists.map((a) => ({ id: a.id, participantKey: a.playerId, playerName: a.playerName, type: "NORMAL" as const })),
        observationCountByParticipant: b05ObservationCountByParticipant,
        minutesByParticipant: b05MinutesByParticipant,
      }),
    [state.goals, state.assists],
  );
  const liveCombinationEvidence = surfaceState === "COMPLETED" ? combinationEvidence : [];
  const presentCount = state.players.filter((p) => p.attendanceStatus === "PRESENT").length;
  const noShowCount = state.players.filter((p) => p.attendanceStatus === "NO_SHOW").length;

  const liveAfterData: MatchDetailAfterData = {
    ...staticAfterData,
    homeGoals: state.ourScore,
    awayGoals: state.opponentScore,
    completedBy: state.completedBy,
    completedAt: state.completedAt,
    goalScorers: liveGoalScorers,
    assistProviders: liveAssistProviders,
    playerInvolvement: livePlayerInvolvement,
    goalAttributionGap: liveGoalAttributionGap,
    combinationEvidence: liveCombinationEvidence,
    timingNeedsReviewCount: state.timingReview.filter((t) => t.needsReview).length,
    attendanceSummary: { ...staticAfterData.attendanceSummary, presentCount, noShowCount },
  };

  const playerNameById = Object.fromEntries(allPlayers.map((p) => [p.id, p.name]));

  const reportViewModel: PostMatchReportViewModel = {
    id: "report-gate-b-05",
    status: state.status,
    teamLabel: ownTeamName,
    opponentLabel: opponentName,
    ourScore: state.ourScore,
    opponentScore: state.opponentScore,
    players: state.players.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.meta })),
    goals: state.goals,
    assists: state.assists,
    completedBy: state.completedBy,
    completedAt: state.completedAt,
    timingReview: state.timingReview,
    outOfRangeEventCount: state.outOfRangeEventCount,
  };
  const availablePlayers: PostMatchAvailablePlayer[] = allPlayers.filter((p) => !state.players.some((pl) => pl.playerId === p.id));

  return (
    <div className="touchline flex flex-col gap-5">
      {/* B2-R7: no real destination exists for this match's own Match Details page within this
          UI Lab bundle (B01-B04 are different match identities) — a fragment href would be a
          fake working link, so this is deliberately plain text, not an anchor. In production,
          this always returns to the same match-scoped route this report belongs to. */}
      <span className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--text-muted)]">&lsaquo; Back to match</span>

      <PostMatchReportHeader
        breadcrumbLabel="Matches"
        breadcrumbHref="#matches"
        title={title}
        surfaceState={surfaceState}
        completedByLabel={state.completedBy ? `Completed by ${state.completedBy}` : null}
        presentation={presentation}
        ownKitColor={ownKitColor}
        presentCount={presentCount}
        totalCount={state.players.length}
        noShowCount={noShowCount}
        goalsCount={liveGoalScorers.scorers.reduce((n, s) => n + s.count, 0)}
        assistsCount={liveAssistProviders.scorers.reduce((n, s) => n + s.count, 0)}
      />

      {isDraft && <PostMatchUnresolvedBanner subjectId={matchId} playerNameById={playerNameById} />}
      {isDraft && <GoalAttributionGapBanner gap={liveGoalAttributionGap} />}

      <TabRail items={tabs} activeKey={activeTab} variant="pill" ariaLabel="Report sections" onSelect={selectTab} />

      {activeTab === "summary" && <PostMatchSummaryTab data={liveAfterData} ownTeamName={ownTeamName} opponentName={opponentName} isDraft={isDraft} />}

      {activeTab === "timeline" && <MatchTimelineList items={liveAfterData.timeline} ownTeamName={ownTeamName} opponentName={opponentName} />}

      {activeTab === "players" && (
        <PostMatchReportShell
          report={reportViewModel}
          actions={actions}
          capabilities={CAPABILITIES}
          availablePlayers={availablePlayers}
          onChanged={() => {}}
          extraSections={<LeagueOnlyExtras state={state} />}
        />
      )}

      {activeTab === "reflection" && (
        <div className="flex flex-col gap-4">
          {/* Always `readOnly` — unlocked, `PostMatchDebrief` wires its save/submit controls to
              real server actions (dynamically imported `saveDebriefDraftAction`/
              `submitDebriefAction`), the same class of exposure B2-R5 closes. The debrief being
              already-submitted is a precondition fact for this scenario's completion gate, not
              something this redesign explores interactively. */}
          <PostMatchDebrief
            reportRef={{ kind: "LEAGUE", matchId }}
            debriefId="debrief-gate-b-05"
            status="SUBMITTED"
            initialAnswers={{ version: DEBRIEF_SCHEMA_VERSION, answers: debriefAnswers }}
            opponentName={opponentName}
            matchupLabel={`${ownTeamName} vs ${opponentName}`}
            playerOptions={allPlayers.map((p) => ({ id: p.id, name: p.name }))}
            periodOptions={["First half", "Second half"]}
            readOnly
          />
          <details className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)]">
            <summary className="cursor-pointer select-none p-4 text-sm font-medium text-[var(--foreground)]">Additional observations (optional)</summary>
            <div className="flex flex-col gap-4 border-t border-[var(--border-soft)] p-4">
              {/* Always `isLocked` — unlocked, this component renders its own "add observation"
                  form wired to a real server action (`saveFootballObservationsAction`), the
                  same class of production-mutation exposure this whole redesign exists to
                  close (B2-R5). Not this scenario's own focus; displayed read-only. */}
              <FootballObservationSection
                matchId={matchId}
                players={allPlayers.map((p) => ({ id: p.id, name: p.name }))}
                existingObservations={footballObservations.map((o) => ({ ...o, observedAt: state.completedAt ?? presentation.kickoffDate ?? "" }))}
                isLocked
              />
            </div>
          </details>
        </div>
      )}

      {activeTab === "review" && (
        <div className="flex flex-col gap-2">
          <PostMatchReviewTab reviewHref="#review" />
          {/* B2-R7: "Open review" is the real production component, but no `/review` route
              exists for this match's own identity in this UI Lab bundle — disclosed rather than
              left as a fake working link. */}
          <p className="text-[11px] text-[var(--text-muted)]">
            Design note: in production, &ldquo;Open review&rdquo; opens this match&apos;s own plan-integrity review route. Not reproduced in this candidate.
          </p>
        </div>
      )}

      {activeTab === "combinations" && (
        <MatchCombinationEvidencePanel evidence={liveCombinationEvidence} players={allPlayers.map((p) => ({ id: p.id, name: p.name }))} />
      )}
    </div>
  );
}

/**
 * League-only extras (team note, planned squad, absences) — presented read-only, deliberately:
 * these are secondary to the P1 scenario this redesign targets (goal attribution, timing
 * blockers, safe completion) and reusing their real interactive sub-controls would mean either
 * wiring yet more fixture-local mutation handlers for a secondary feature, or risking the same
 * class of production-mutation exposure this whole redesign exists to close. A disclosed,
 * narrow scope reduction — not fake editability (nothing here looks interactive and isn't).
 */
function LeagueOnlyExtras({ state }: { state: SafeReportLocalState }) {
  return (
    <Surface variant="default" padding="lg">
      <SectionHeader title="Team notes" />
      <p className="mt-2 text-sm text-[var(--text-soft)]">Follow up on positional shape in training this week.</p>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Squad</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {state.players.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-soft)]">{p.playerName}</span>
            {p.attendanceStatus !== "PRESENT" && (
              <StatusPill variant="danger" size="sm">
                {p.attendanceStatus === "NO_SHOW" ? "No-show" : p.attendanceStatus}
              </StatusPill>
            )}
          </div>
        ))}
      </div>
    </Surface>
  );
}
