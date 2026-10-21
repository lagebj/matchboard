"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { TabRail } from "@/components/ui/tab-rail";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { PostMatchReportHeader } from "@/components/matches/match-detail/post-match-report-header";
import { PostMatchSummaryTab } from "@/components/matches/match-detail/post-match-summary-tab";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { PostMatchReportShell } from "@/components/matches/post-match-report-shell";
import { PostMatchUnresolvedBanner } from "@/components/live-match/post-match-unresolved-banner";
import { GoalAttributionGapBanner } from "@/components/matches/goal-attribution-gap-banner";
import { PostMatchDebrief } from "@/components/post-match/debrief/post-match-debrief";
import { FootballObservationSection } from "@/components/player-development/football-observation-section";
import { MatchCombinationEvidencePanel } from "@/components/matches/match-combination-evidence-panel";
import { getPostMatchReportTabs, resolvePostMatchReportTab, type PostMatchTabKey } from "@/lib/matches/match-detail-tabs";
import { aggregateGoalScorers, aggregateAssistProviders, buildPlayerInvolvement, summarizeMatchAttendance } from "@/lib/matches/match-detail-view-model";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { PostMatchReportViewModel, PostMatchReportCapabilities, PostMatchAvailablePlayer } from "@/lib/reports/post-match-report-view-model";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { useSafeReportLifecycle, type SafeReportLocalState } from "./use-safe-report-lifecycle";
import { b05MinutesByParticipant, b05ObservationCountByParticipant } from "./report-data";

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
  completionTimestamp,
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
  /** B5/R3 — the fixed, deterministic real-world completion instant to stamp if/when `complete()`
   * succeeds from this page (never `Date.now()`). This match has exactly one true completion
   * moment; reusing the same constant here as the static completed fixture uses is the honest
   * choice, not a second invented one. */
  completionTimestamp: string;
  debriefAnswers: DebriefAnswersSection;
  allPlayers: Array<{ id: string; name: string; teamName: string }>;
  footballObservations: Array<{ id: string; playerId: string; playerName: string; observationCode: string; polarity: string; note: string }>;
  combinationEvidence: CombinationEvidenceRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useSafeReportLifecycle(initialLocalState, initialCompletedBy, completionTimestamp);

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
  // B5/R4 — derived live from the CURRENT roster (`state.players`), never the static fixture
  // constant: an added/removed player or a toggled attendance status must be reflected here too,
  // not just in the header's own `totalCount={state.players.length}`.
  const livePresentParticipants = useMemo(
    () => state.players.filter((p) => p.attendanceStatus === "PRESENT").map((p) => ({ participantKey: p.playerId, playerName: p.playerName })),
    [state.players],
  );
  const livePlayerInvolvement = useMemo(
    () =>
      buildPlayerInvolvement({
        presentParticipants: livePresentParticipants,
        goals: state.goals.map((g) => ({ id: g.id, participantKey: g.playerId, playerName: g.playerName, minute: g.minute, type: "NORMAL" as const })),
        assists: state.assists.map((a) => ({ id: a.id, participantKey: a.playerId, playerName: a.playerName, type: "NORMAL" as const })),
        observationCountByParticipant: b05ObservationCountByParticipant,
        minutesByParticipant: b05MinutesByParticipant,
      }),
    [livePresentParticipants, state.goals, state.assists],
  );
  const liveCombinationEvidence = surfaceState === "COMPLETED" ? combinationEvidence : [];
  // B5/R4 — the identity card's own score/outcome must track `state.ourScore`/`opponentScore`
  // too: before this fix, editing the Result section's score (a real, reachable "Save" action)
  // changed the Players tab and Summary tab but left the header's `MatchIdentityCard` showing
  // the ORIGINAL fixture score — the exact "official match identity can display an old result"
  // contradiction. Reuses `presentation`'s own `ownTeamSide` (never re-guesses home/away) and the
  // same WON/DRAWN/LOST comparison `buildMatchPresentation()` itself would make from these scores.
  const livePresentation = useMemo((): MatchPresentation => {
    const isHome = presentation.ownTeamSide !== "away";
    const score = isHome ? { home: state.ourScore, away: state.opponentScore } : { home: state.opponentScore, away: state.ourScore };
    const resultOutcomeForOwnTeam = state.ourScore > state.opponentScore ? "win" : state.ourScore < state.opponentScore ? "loss" : "draw";
    const outcomeLabel = state.ourScore > state.opponentScore ? "WON" : state.ourScore < state.opponentScore ? "LOST" : "DRAW";
    return { ...presentation, score, resultOutcomeForOwnTeam, outcomeLabel };
  }, [presentation, state.ourScore, state.opponentScore]);
  // B5/R4 — the FULL attendance summary (including `totalCount`/`noShowNames`), recomputed from
  // the current roster every time, not a partial `presentCount`/`noShowCount` patch over a
  // static snapshot (which went stale the moment a player was added, removed, or re-marked).
  const liveAttendanceSummary = useMemo(
    () => summarizeMatchAttendance(state.players.map((p) => ({ attendanceStatus: p.attendanceStatus, playerName: p.playerName }))),
    [state.players],
  );

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
    attendanceSummary: liveAttendanceSummary,
  };
  const presentCount = liveAttendanceSummary.presentCount;
  const noShowCount = liveAttendanceSummary.noShowCount;

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
      {/* B5/R5: a real `next/link` to this match's own Match Details stand-in
          (`b05-post-match-report/match-details`), matching the real destination production's
          `breadcrumbHref` actually points to (`/o/${orgSlug}/matches/${matchId}` — verified in
          `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`), not a fragment and
          not another match's identity. */}
      <Link
        href="/dev/ui-lab/gate-b/b05-post-match-report/match-details"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
      >
        &lsaquo; Back to match
      </Link>

      <PostMatchReportHeader
        breadcrumbLabel="Matches"
        breadcrumbHref="/dev/ui-lab/gate-b/b05-post-match-report/match-details"
        title={title}
        surfaceState={surfaceState}
        completedByLabel={state.completedBy ? `Completed by ${state.completedBy}` : null}
        presentation={livePresentation}
        ownKitColor={ownKitColor}
        presentCount={presentCount}
        totalCount={state.players.length}
        noShowCount={noShowCount}
        goalsCount={liveGoalScorers.scorers.reduce((n, s) => n + s.count, 0)}
        assistsCount={liveAssistProviders.scorers.reduce((n, s) => n + s.count, 0)}
      />

      {isDraft && <PostMatchUnresolvedBanner subjectId={matchId} playerNameById={playerNameById} />}
      {/* B5/R1 — a proposed candidate-only visual correction, NOT already-shipped production
          behavior: the real `PostMatchReportPageShell` gates this banner the identical
          `isDraft &&` way (verified directly), so a report that reaches LOCKED with the
          goal-attribution gap still open (a real, legally reachable path — `complete()` never
          blocks on this) shows no disclosure in production today either. This candidate shows it
          whenever `hasGap` is true, regardless of lock state, so a completed-but-unreconciled
          report never looks silently fully reconciled. See DATA_TRUTH_AND_FIXTURES.md. */}
      {liveGoalAttributionGap.hasGap && <GoalAttributionGapBanner gap={liveGoalAttributionGap} />}

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
        <Surface padding="md" className="flex flex-col gap-3">
          <SectionHeader title="Plan integrity review" description="Compare the planned squad and rotations against what actually happened." />
          {/* B5/R5: the real `PostMatchReviewTab` component always renders a working-looking
              `<Link>`/button to `reviewHref` with no way to omit it — there is no real `/review`
              route for this match's identity in this UI Lab bundle, and a fragment href would be
              a fake link. Omitted rather than faked (option 3): this disclosure replaces the real
              component entirely for this one tab, not an "Open review" control pointing nowhere. */}
          <p className="text-[13px] text-[var(--text-muted)]">
            &ldquo;Open review&rdquo; opens this match&apos;s own plan-integrity review route in production. Not reproduced in this
            candidate — no working destination exists for it here.
          </p>
        </Surface>
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
